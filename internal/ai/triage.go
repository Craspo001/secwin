package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"
)

type CacheEntry struct {
	Response  *TriageResponse
	ExpiresAt time.Time
}

type Cache struct {
	mu      sync.RWMutex
	entries map[string]CacheEntry
	maxSize int
	ttl     time.Duration
}

func NewCache(maxSize int, ttl time.Duration) *Cache {
	if maxSize <= 0 {
		maxSize = 1000
	}
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &Cache{
		entries: make(map[string]CacheEntry),
		maxSize: maxSize,
		ttl:     ttl,
	}
}

func (c *Cache) Get(key string) (*TriageResponse, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.ExpiresAt) {
		return nil, false
	}
	return entry.Response, true
}

func (c *Cache) Set(key string, response *TriageResponse) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.entries) >= c.maxSize {
		c.evictOldest()
	}

	c.entries[key] = CacheEntry{
		Response:  response,
		ExpiresAt: time.Now().Add(c.ttl),
	}
}

func (c *Cache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time
	first := true

	for k, v := range c.entries {
		if first || v.ExpiresAt.Before(oldestTime) {
			oldestKey = k
			oldestTime = v.ExpiresAt
			first = false
		}
	}
	if oldestKey != "" {
		delete(c.entries, oldestKey)
	}
}

func (c *Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]CacheEntry)
}

func (c *Cache) Stats() (size int, hitRate float64) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries), 0
}

func cacheKey(finding FindingInput) string {
	data := finding.Title + "|" + finding.Description + "|" + finding.Tool
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

type TriageEngine struct {
	client     *Client
	cache      *Cache
	ruleEngine *RuleEngine
}

func (e *TriageEngine) Cache() *Cache {
	return e.cache
}

func (e *TriageEngine) RuleEngine() *RuleEngine {
	return e.ruleEngine
}

func (e *TriageEngine) SetCache(cache *Cache) {
	e.cache = cache
}

func (e *TriageEngine) SetRuleEngine(ruleEngine *RuleEngine) {
	e.ruleEngine = ruleEngine
}

type TriageResult struct {
	Finding   FindingInput
	Response  *TriageResponse
	FromCache bool
	FromRules bool
	Error     string
}

func NewTriageEngine(client *Client) *TriageEngine {
	return &TriageEngine{
		client:     client,
		cache:      NewCache(1000, 24*time.Hour),
		ruleEngine: NewRuleEngine(),
	}
}

func (e *TriageEngine) Triage(ctx context.Context, finding FindingInput, contextStr string) (*TriageResult, error) {
	key := cacheKey(finding)

	if cached, ok := e.cache.Get(key); ok {
		return &TriageResult{
			Finding:   finding,
			Response:  cached,
			FromCache: true,
		}, nil
	}

	resp, err := e.client.TriageFinding(ctx, finding, contextStr)
	if err == nil {
		e.cache.Set(key, resp)
		return &TriageResult{
			Finding:  finding,
			Response: resp,
		}, nil
	}

	ruleResp := e.ruleEngine.Classify(finding)
	return &TriageResult{
		Finding:   finding,
		Response:  ruleResp,
		FromRules: true,
		Error:     err.Error(),
	}, nil
}

func (e *TriageEngine) TriageBatch(ctx context.Context, findings []FindingInput, contextStr string) ([]*TriageResult, error) {
	results := make([]*TriageResult, len(findings))
	var wg sync.WaitGroup
	var mu sync.Mutex

	for i, f := range findings {
		wg.Add(1)
		go func(idx int, finding FindingInput) {
			defer wg.Done()
			res, err := e.Triage(ctx, finding, contextStr)
			if err != nil {
				res = &TriageResult{
					Finding: finding,
					Response: &TriageResponse{
						Classification: "unknown",
						Confidence:     0,
						Reasoning:      "Triage failed: " + err.Error(),
					},
					Error: err.Error(),
				}
			}
			mu.Lock()
			results[idx] = res
			mu.Unlock()
		}(i, f)
	}
	wg.Wait()
	return results, nil
}

type RuleEngine struct {
	rules []Rule
}

type Rule struct {
	Name      string
	Condition func(FindingInput) bool
	Response  *TriageResponse
}

func NewRuleEngine() *RuleEngine {
	return &RuleEngine{
		rules: []Rule{
			{
				Name: "critical_cve",
				Condition: func(f FindingInput) bool {
					return containsIgnoreCase(f.Title, "cve-") || containsIgnoreCase(f.Description, "cve-")
				},
				Response: &TriageResponse{
					Classification:    "true_positive",
					Confidence:        0.85,
					Reasoning:         "CVE reference detected - likely exploitable vulnerability",
					SuggestedSeverity: "high",
					Remediation:       "Verify exploitability, apply patches, check for compensating controls",
				},
			},
			{
				Name: "rce_keyword",
				Condition: func(f FindingInput) bool {
					return containsIgnoreCase(f.Title, "rce") || containsIgnoreCase(f.Description, "remote code execution")
				},
				Response: &TriageResponse{
					Classification:    "true_positive",
					Confidence:        0.9,
					Reasoning:         "Remote code execution indicator - critical severity",
					SuggestedSeverity: "critical",
					Remediation:       "Immediate isolation, patch verification, incident response",
				},
			},
			{
				Name: "sql_injection",
				Condition: func(f FindingInput) bool {
					return containsIgnoreCase(f.Title, "sql") || containsIgnoreCase(f.Description, "sql injection")
				},
				Response: &TriageResponse{
					Classification:    "true_positive",
					Confidence:        0.8,
					Reasoning:         "SQL injection pattern detected",
					SuggestedSeverity: "high",
					Remediation:       "Parameterized queries, input validation, WAF rules",
				},
			},
			{
				Name: "xss_keyword",
				Condition: func(f FindingInput) bool {
					return containsIgnoreCase(f.Title, "xss") || containsIgnoreCase(f.Description, "cross-site scripting")
				},
				Response: &TriageResponse{
					Classification:    "true_positive",
					Confidence:        0.75,
					Reasoning:         "Cross-site scripting indicator",
					SuggestedSeverity: "medium",
					Remediation:       "Output encoding, CSP headers, input sanitization",
				},
			},
			{
				Name: "info_disclosure",
				Condition: func(f FindingInput) bool {
					return containsIgnoreCase(f.Title, "information disclosure") ||
						containsIgnoreCase(f.Description, "information disclosure") ||
						containsIgnoreCase(f.Title, "exposed") ||
						containsIgnoreCase(f.Description, "directory listing")
				},
				Response: &TriageResponse{
					Classification:    "informational",
					Confidence:        0.7,
					Reasoning:         "Information disclosure - low exploitability",
					SuggestedSeverity: "low",
					Remediation:       "Remove sensitive data from responses, configure server headers",
				},
			},
			{
				Name: "open_port",
				Condition: func(f FindingInput) bool {
					return containsIgnoreCase(f.Title, "open port") ||
						containsIgnoreCase(f.Description, "port open")
				},
				Response: &TriageResponse{
					Classification:    "informational",
					Confidence:        0.6,
					Reasoning:         "Open port detected - requires service enumeration",
					SuggestedSeverity: "info",
					Remediation:       "Verify service necessity, apply firewall rules",
				},
			},
			{
				Name: "default_creds",
				Condition: func(f FindingInput) bool {
					return containsIgnoreCase(f.Title, "default") && containsIgnoreCase(f.Description, "credential") ||
						containsIgnoreCase(f.Title, "default password")
				},
				Response: &TriageResponse{
					Classification:    "true_positive",
					Confidence:        0.95,
					Reasoning:         "Default credentials found - immediately actionable",
					SuggestedSeverity: "critical",
					Remediation:       "Change default credentials immediately, enforce password policy",
				},
			},
			{
				Name: "nuclei_template",
				Condition: func(f FindingInput) bool {
					return f.Tool == "nuclei" || containsIgnoreCase(f.Title, "nuclei")
				},
				Response: &TriageResponse{
					Classification:    "true_positive",
					Confidence:        0.8,
					Reasoning:         "Nuclei template match - generally reliable",
					SuggestedSeverity: "medium",
					Remediation:       "Review template logic, verify manually if critical",
				},
			},
		},
	}
}

func (re *RuleEngine) Classify(finding FindingInput) *TriageResponse {
	for _, rule := range re.rules {
		if rule.Condition(finding) {
			resp := *rule.Response
			resp.Reasoning = "[Rule: " + rule.Name + "] " + resp.Reasoning
			return &resp
		}
	}
	return &TriageResponse{
		Classification:    "unknown",
		Confidence:        0.3,
		Reasoning:         "No matching rule - manual review required",
		SuggestedSeverity: "info",
		Remediation:       "Manual triage recommended",
	}
}

func containsIgnoreCase(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || findSubstringIgnoreCase(s, substr))
}

func findSubstringIgnoreCase(s, substr string) bool {
	sLower := toLower(s)
	subLower := toLower(substr)
	for i := 0; i <= len(sLower)-len(subLower); i++ {
		if sLower[i:i+len(subLower)] == subLower {
			return true
		}
	}
	return false
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := range s {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			b[i] = c + 32
		} else {
			b[i] = c
		}
	}
	return string(b)
}

func (e *TriageEngine) ExportCache() ([]byte, error) {
	e.cache.mu.RLock()
	defer e.cache.mu.RUnlock()

	type CacheExport struct {
		Entries map[string]CacheEntry `json:"entries"`
	}
	exp := CacheExport{Entries: e.cache.entries}
	return json.MarshalIndent(exp, "", "  ")
}

func (e *TriageEngine) ImportCache(data []byte) error {
	type CacheExport struct {
		Entries map[string]CacheEntry `json:"entries"`
	}
	var exp CacheExport
	if err := json.Unmarshal(data, &exp); err != nil {
		return err
	}
	e.cache.mu.Lock()
	defer e.cache.mu.Unlock()
	e.cache.entries = exp.Entries
	return nil
}
