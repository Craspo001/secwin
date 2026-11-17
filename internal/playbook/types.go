package playbook

import (
	"encoding/json"
	"fmt"
	"time"
)

type Playbook struct {
	Metadata  Metadata            `json:"metadata" yaml:"metadata"`
	Variables map[string]Variable `json:"variables,omitempty" yaml:"variables,omitempty"`
	Steps     []Step              `json:"steps" yaml:"steps"`
	Outputs   Outputs             `json:"outputs,omitempty" yaml:"outputs,omitempty"`
	Hooks     Hooks               `json:"hooks,omitempty" yaml:"hooks,omitempty"`
}

type Metadata struct {
	Name         string    `json:"name" yaml:"name"`
	Version      string    `json:"version" yaml:"version"`
	Author       string    `json:"author,omitempty" yaml:"author,omitempty"`
	Description  string    `json:"description,omitempty" yaml:"description,omitempty"`
	MITRETactics []string  `json:"mitre_tactics,omitempty" yaml:"mitre_tactics,omitempty"`
	Tags         []string  `json:"tags,omitempty" yaml:"tags,omitempty"`
	CreatedAt    time.Time `json:"created_at,omitempty" yaml:"created_at,omitempty"`
	UpdatedAt    time.Time `json:"updated_at,omitempty" yaml:"updated_at,omitempty"`
}

type Variable struct {
	Type        string      `json:"type" yaml:"type"`
	Required    bool        `json:"required,omitempty" yaml:"required,omitempty"`
	Default     interface{} `json:"default,omitempty" yaml:"default,omitempty"`
	Description string      `json:"description,omitempty" yaml:"description,omitempty"`
	Validation  string      `json:"validation,omitempty" yaml:"validation,omitempty"`
	Secret      bool        `json:"secret,omitempty" yaml:"secret,omitempty"`
	Enum        []string    `json:"enum,omitempty" yaml:"enum,omitempty"`
}

type Step struct {
	ID              string            `json:"id" yaml:"id"`
	Name            string            `json:"name" yaml:"name"`
	Tool            string            `json:"tool" yaml:"tool"`
	Args            []string          `json:"args,omitempty" yaml:"args,omitempty"`
	Condition       string            `json:"condition,omitempty" yaml:"condition,omitempty"`
	Retry           int               `json:"retry,omitempty" yaml:"retry,omitempty"`
	Timeout         string            `json:"timeout,omitempty" yaml:"timeout,omitempty"`
	Artifacts       []string          `json:"artifacts,omitempty" yaml:"artifacts,omitempty"`
	MITRETechniques []string          `json:"mitre_techniques,omitempty" yaml:"mitre_techniques,omitempty"`
	Env             map[string]string `json:"env,omitempty" yaml:"env,omitempty"`
	WorkingDir      string            `json:"working_dir,omitempty" yaml:"working_dir,omitempty"`
	ContinueOnError bool              `json:"continue_on_error,omitempty" yaml:"continue_on_error,omitempty"`

	Parallel []Step       `json:"parallel,omitempty" yaml:"parallel,omitempty"`
	Foreach  *ForeachSpec `json:"foreach,omitempty" yaml:"foreach,omitempty"`
	If       *IfSpec      `json:"if,omitempty" yaml:"if,omitempty"`
	Try      *TrySpec     `json:"try,omitempty" yaml:"try,omitempty"`
}

type ForeachSpec struct {
	Variable string `json:"variable" yaml:"variable"`
	In       string `json:"in" yaml:"in"`
	Steps    []Step `json:"steps" yaml:"steps"`
}

type IfSpec struct {
	Condition string `json:"condition" yaml:"condition"`
	Then      []Step `json:"then" yaml:"then"`
	Else      []Step `json:"else,omitempty" yaml:"else,omitempty"`
}

type TrySpec struct {
	Steps   []Step `json:"steps" yaml:"steps"`
	Catch   []Step `json:"catch,omitempty" yaml:"catch,omitempty"`
	Finally []Step `json:"finally,omitempty" yaml:"finally,omitempty"`
}

type Outputs struct {
	Findings    string   `json:"findings,omitempty" yaml:"findings,omitempty"`
	Report      string   `json:"report,omitempty" yaml:"report,omitempty"`
	EvidenceDir string   `json:"evidence_dir,omitempty" yaml:"evidence_dir,omitempty"`
	Formats     []string `json:"formats,omitempty" yaml:"formats,omitempty"`
}

type Hooks struct {
	PreStep   []HookSpec `json:"pre_step,omitempty" yaml:"pre_step,omitempty"`
	PostStep  []HookSpec `json:"post_step,omitempty" yaml:"post_step,omitempty"`
	OnFailure []HookSpec `json:"on_failure,omitempty" yaml:"on_failure,omitempty"`
	OnSuccess []HookSpec `json:"on_success,omitempty" yaml:"on_success,omitempty"`
}

type HookSpec struct {
	Tool string   `json:"tool" yaml:"tool"`
	Args []string `json:"args,omitempty" yaml:"args,omitempty"`
}

type ExecutionContext struct {
	Variables   map[string]interface{}
	Artifacts   map[string]string
	Findings    []Finding
	StepResults map[string]StepResult
	StartTime   time.Time
	CurrentStep string
	Playbook    *Playbook
}

type StepResult struct {
	StepID      string
	Success     bool
	Output      string
	Error       string
	Duration    time.Duration
	Artifacts   map[string]string
	StartedAt   time.Time
	CompletedAt time.Time
	Retries     int
}

type Finding struct {
	ID              string            `json:"id"`
	Title           string            `json:"title"`
	Description     string            `json:"description"`
	Severity        string            `json:"severity"`
	MITRETechniques []string          `json:"mitre_techniques"`
	Evidence        map[string]string `json:"evidence"`
	StepID          string            `json:"step_id"`
	CreatedAt       time.Time         `json:"created_at"`
}

type EvidenceManifest struct {
	GeneratedAt string             `json:"generated_at"`
	EvidenceDir string             `json:"evidence_dir"`
	Artifacts   []EvidenceArtifact `json:"artifacts"`
}

type EvidenceArtifact struct {
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	SHA256    string    `json:"sha256"`
	Size      int64     `json:"size"`
	StepID    string    `json:"step_id"`
	Timestamp time.Time `json:"timestamp"`
}

type PlaybookResult struct {
	Playbook    *Playbook
	Success     bool
	Error       string
	Duration    time.Duration
	StepResults map[string]StepResult
	Findings    []Finding
	Artifacts   map[string]string
	ReportPath  string
}

func (p *Playbook) Validate() error {
	if p.Metadata.Name == "" {
		return ErrInvalidPlaybook("name is required")
	}
	if len(p.Steps) == 0 {
		return ErrInvalidPlaybook("at least one step required")
	}
	seen := make(map[string]bool)
	for i, step := range p.Steps {
		if step.ID == "" {
			return ErrInvalidPlaybook(fmt.Sprintf("step %d: id required", i))
		}
		if seen[step.ID] {
			return ErrInvalidPlaybook(fmt.Sprintf("duplicate step id: %s", step.ID))
		}
		seen[step.ID] = true
		if step.Tool == "" && len(step.Parallel) == 0 && step.Foreach == nil && step.If == nil && step.Try == nil {
			return ErrInvalidPlaybook(fmt.Sprintf("step %s: tool or control flow required", step.ID))
		}
	}
	return nil
}

type ErrInvalidPlaybook string

func (e ErrInvalidPlaybook) Error() string {
	return "invalid playbook: " + string(e)
}

func (p *Playbook) MarshalJSON() ([]byte, error) {
	type Alias Playbook
	return json.Marshal(&struct {
		*Alias
		CreatedAt string `json:"created_at,omitempty"`
		UpdatedAt string `json:"updated_at,omitempty"`
	}{
		Alias:     (*Alias)(p),
		CreatedAt: p.Metadata.CreatedAt.Format(time.RFC3339),
		UpdatedAt: p.Metadata.UpdatedAt.Format(time.RFC3339),
	})
}
