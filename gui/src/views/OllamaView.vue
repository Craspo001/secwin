<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useOllamaStore } from '@/stores/ollama'
import { useEvidenceStore } from '@/stores/evidence'
import { usePlaybookStore } from '@/stores/playbook'
import { Card } from '@/components/ui/Card.vue'
import { Brain, RefreshCw, Sparkles, FileText, Copy, Download, ExternalLink, AlertCircle, CheckCircle, Clock, Search, Trash2 } from 'lucide-vue-next'

const ollamaStore = useOllamaStore()
const evidenceStore = useEvidenceStore()
const playbookStore = usePlaybookStore()

const selectedModel = ref('')
const context = ref('')
const findingsInput = ref('')
const triaging = ref(false)
const showRawOutput = ref(false)
const findings = ref<any[]>([])

const availableModels = computed(() => ollamaStore.models.map(m => m.name))

async function fetchData() {
  await Promise.all([
    ollamaStore.fetchModels(),
    evidenceStore.fetchEvidence(),
    playbookStore.fetchPlaybooks(),
  ])
  if (ollamaStore.models.length > 0 && !selectedModel.value) {
    selectedModel.value = ollamaStore.models[0].name
  }
}

function loadFindingsFromEvidence() {
  // Parse evidence artifacts for findings
  const evidenceFindings = evidenceStore.artifacts
    .filter(a => a.name.includes('finding') || a.name.includes('result') || a.name.endsWith('.json'))
    .slice(0, 10)

  findings.value = evidenceFindings.map((artifact, index) => ({
    id: `finding-${index}`,
    title: `Finding from ${artifact.name}`,
    description: `Artifact collected during step ${artifact.step_id}`,
    severity: 'medium',
    mitre_techniques: [],
    evidence: { artifact: artifact.path, sha256: artifact.sha256 },
  }))

  findingsInput.value = JSON.stringify(findings.value, null, 2)
}

function loadSampleFindings() {
  findings.value = [
    {
      id: 'finding-1',
      title: 'SQL Injection in Login Form',
      description: 'The login form at /login is vulnerable to SQL injection via the username parameter. Input is not properly sanitized before being used in database queries.',
      severity: 'critical',
      mitre_techniques: ['T1190', 'T1059'],
      evidence: { url: 'http://target/login', parameter: 'username', payload: "' OR '1'='1" },
    },
    {
      id: 'finding-2',
      title: 'Outdated OpenSSL Version',
      description: 'Server runs OpenSSL 1.1.1k which is vulnerable to CVE-2022-0778 (infinite loop in BN_mod_sqrt).',
      severity: 'high',
      mitre_techniques: ['T1068'],
      evidence: { version: '1.1.1k', cve: 'CVE-2022-0778' },
    },
    {
      id: 'finding-3',
      title: 'Missing Security Headers',
      description: 'HTTP responses lack security headers: X-Frame-Options, Content-Security-Policy, X-Content-Type-Options.',
      severity: 'medium',
      mitre_techniques: ['T1550'],
      evidence: { headers: ['X-Frame-Options', 'CSP', 'X-Content-Type-Options'] },
    },
  ]
  findingsInput.value = JSON.stringify(findings.value, null, 2)
}

async function runTriage() {
  if (!selectedModel.value) {
    alert('Please select a model')
    return
  }

  let parsedFindings
  try {
    parsedFindings = JSON.parse(findingsInput.value)
  } catch (e) {
    alert('Invalid JSON in findings input')
    return
  }

  if (!Array.isArray(parsedFindings) || parsedFindings.length === 0) {
    alert('Please provide findings to triage')
    return
  }

  triaging.value = true
  try {
    await ollamaStore.triageFindings({
      findings: parsedFindings,
      model: selectedModel.value,
      context: context.value || undefined,
    })
  } catch (e) {
    console.error('Triage failed:', e)
  } finally {
    triaging.value = false
  }
}

function copyTriageResult() {
  if (ollamaStore.lastTriageResult) {
    navigator.clipboard.writeText(JSON.stringify(ollamaStore.lastTriageResult, null, 2))
  }
}

function downloadTriageResult() {
  if (ollamaStore.lastTriageResult) {
    const blob = new Blob([JSON.stringify(ollamaStore.lastTriageResult, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `triage-results-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

function clearFindings() {
  findings.value = []
  findingsInput.value = ''
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'badge-critical'
    case 'high': return 'badge-high'
    case 'medium': return 'badge-medium'
    case 'low': return 'badge-low'
    default: return 'badge-info-sev'
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="ollama-view">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl">
      <div>
        <h1 class="text-3xl font-bold">AI Triage</h1>
        <p class="text-muted mt-xs">Analyze findings with local Ollama models</p>
      </div>
      <button class="btn btn-secondary" @click="fetchData" :disabled="ollamaStore.loading">
        <RefreshCw size="16" :class="{ 'animate-spin': ollamaStore.loading }" />
        Refresh Models
      </button>
    </div>

    <!-- Model Selection & Status -->
    <Card class="mb-lg">
      <template #header>
        <h3 class="card-title">Ollama Configuration</h3>
      </template>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-md">
        <div>
          <label class="block text-sm font-medium mb-sm">Model</label>
          <select v-model="selectedModel" class="input select" :disabled="ollamaStore.loading">
            <option v-for="model in availableModels" :key="model" :value="model">{{ model }}</option>
            <option v-if="availableModels.length === 0" value="" disabled>No models found - run `ollama pull <model>`</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-sm">Status</label>
          <div class="flex items-center gap-sm">
            <span :class="ollamaStore.models.length > 0 ? 'badge badge-success' : 'badge badge-warning'">
              <CheckCircle v-if="ollamaStore.models.length > 0" size="12" />
              <AlertCircle v-else size="12" />
              {{ ollamaStore.models.length > 0 ? `${ollamaStore.models.length} model(s) available` : 'Ollama not running' }}
            </span>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-sm">Context (Optional)</label>
          <textarea v-model="context" class="input" rows="2" placeholder="Engagement context, scope, rules of engagement..." />
        </div>
      </div>
    </Card>

    <!-- Main Content -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg">
      <!-- Findings Input -->
      <Card>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="card-title">Findings to Triage</h3>
            <div class="flex items-center gap-sm">
              <button class="btn btn-ghost btn-sm" @click="loadFindingsFromEvidence" :disabled="evidenceStore.loading">
                <FileText size="16" /> Load from Evidence
              </button>
              <button class="btn btn-ghost btn-sm" @click="loadSampleFindings">
                <Sparkles size="16" /> Load Samples
              </button>
              <button v-if="findingsInput.value" class="btn btn-ghost btn-sm" @click="clearFindings">
                <Trash2 size="16" /> Clear
              </button>
            </div>
          </div>
        </template>
        <div class="space-y-md">
          <textarea
            v-model="findingsInput"
            class="input font-mono text-sm"
            rows="20"
            placeholder='Enter findings as JSON array:
[
  {
    "id": "finding-1",
    "title": "SQL Injection",
    "description": "Login form vulnerable to SQLi...",
    "severity": "critical",
    "mitre_techniques": ["T1190"],
    "evidence": {"url": "http://target/login"}
  }
]'
          />
          <p class="text-xs text-muted">
            {{ findingsInput.value ? JSON.parse(findingsInput.value).length : 0 }} finding(s) ready
          </p>
        </div>
      </Card>

      <!-- Triage Results -->
      <Card>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="card-title">Triage Results</h3>
            <div v-if="ollamaStore.lastTriageResult" class="flex items-center gap-sm">
              <button class="btn btn-ghost btn-sm" @click="copyTriageResult" title="Copy JSON">
                <Copy size="16" />
              </button>
              <button class="btn btn-ghost btn-sm" @click="downloadTriageResult" title="Download JSON">
                <Download size="16" />
              </button>
              <button class="btn btn-ghost btn-sm" @click="showRawOutput = !showRawOutput">
                <ExternalLink size="16" />
              </button>
            </div>
          </div>
        </template>

        <div v-if="ollamaStore.triaging" class="flex flex-col items-center justify-center py-2xl">
          <div class="animate-spin rounded-full border-4 border-primary border-t-transparent w-12 h-12 mb-md" />
          <p class="text-muted">Analyzing findings with {{ selectedModel }}...</p>
          <p class="text-xs text-muted mt-sm">This may take a moment depending on model size</p>
        </div>

        <div v-else-if="ollamaStore.lastTriageResult" class="space-y-lg">
          <!-- Summary -->
          <div class="card p-md" :class="[
            ollamaStore.lastTriageResult.risk_score >= 7 && 'border-danger',
            ollamaStore.lastTriageResult.risk_score >= 4 && ollamaStore.lastTriageResult.risk_score < 7 && 'border-warning',
            ollamaStore.lastTriageResult.risk_score < 4 && 'border-success',
          ]">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">Overall Risk Score</p>
                <p class="text-3xl font-bold" :class="[
                  ollamaStore.lastTriageResult.risk_score >= 7 && 'text-danger',
                  ollamaStore.lastTriageResult.risk_score >= 4 && 'text-warning',
                  ollamaStore.lastTriageResult.risk_score < 4 && 'text-success',
                ]">
                  {{ ollamaStore.lastTriageResult.risk_score.toFixed(1) }} / 10
                </p>
              </div>
              <div class="text-right">
                <p class="text-sm text-muted">Findings Analyzed</p>
                <p class="text-2xl font-bold">{{ ollamaStore.lastTriageResult.findings.length }}</p>
              </div>
            </div>
            <p class="text-sm mt-sm">{{ ollamaStore.lastTriageResult.summary }}</p>
          </div>

          <!-- Recommendations -->
          <div v-if="ollamaStore.lastTriageResult.recommendations.length > 0">
            <h4 class="font-medium mb-sm">Recommendations</h4>
            <ul class="space-y-sm">
              <li
                v-for="(rec, index) in ollamaStore.lastTriageResult.recommendations"
                :key="index"
                class="flex items-start gap-sm text-sm"
              >
                <CheckCircle class="text-success mt-0.5" size="16" />
                <span>{{ rec }}</span>
              </li>
            </ul>
          </div>

          <!-- Individual Findings -->
          <div class="space-y-md">
            <h4 class="font-medium">Analyzed Findings</h4>
            <div
              v-for="finding in ollamaStore.lastTriageResult.findings"
              :key="finding.original_id"
              class="card p-md"
              :class="['border-l-4', getSeverityColor(finding.severity)]"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-sm mb-sm">
                    <h4 class="font-medium">{{ finding.title }}</h4>
                    <span :class="getSeverityColor(finding.severity)">{{ finding.severity }}</span>
                    <span class="badge badge-info text-xs">
                      {{ formatConfidence(finding.confidence) }} confidence
                    </span>
                  </div>
                  <p class="text-sm text-muted mb-sm">{{ finding.analysis }}</p>
                  <div class="flex items-center gap-sm text-xs text-muted mb-sm">
                    <Clock size="12" />
                    <span>False positive likelihood: {{ Math.round(finding.false_positive_likelihood * 100) }}%</span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-md mt-md pt-md border-t border-border-light">
                <div>
                  <p class="text-xs text-muted mb-xs">Remediation</p>
                  <p class="text-sm">{{ finding.remediation }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted mb-xs">MITRE Mapping</p>
                  <div class="flex flex-wrap gap-xs">
                    <span v-for="t in finding.mitre_mapping" :key="t" class="badge badge-info text-xs">{{ t }}</span>
                    <span v-if="finding.mitre_mapping.length === 0" class="text-muted text-xs">None</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Raw Output -->
          <div v-if="showRawOutput" class="mt-md">
            <h4 class="font-medium mb-sm">Raw JSON Output</h4>
            <pre class="bg-bg-primary p-md rounded font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
{{ JSON.stringify(ollamaStore.lastTriageResult, null, 2) }}
            </pre>
          </div>
        </div>

        <div v-else class="text-center py-2xl text-muted">
          <Brain size="48" class="mx-auto mb-md opacity-50" />
          <p>Configure findings and click "Run Triage" to analyze</p>
        </div>
      </Card>
    </div>

    <!-- Run Triage Button (Full Width) -->
    <div class="mt-lg">
      <button
        class="btn btn-primary btn-lg w-full sm:w-auto"
        @click="runTriage"
        :disabled="ollamaStore.triaging || !selectedModel.value || !findingsInput.value.trim()"
      >
        <Sparkles v-if="!ollamaStore.triaging" size="20" />
        <RefreshCw v-else class="animate-spin" size="20" />
        {{ ollamaStore.triaging ? 'Triaging...' : 'Run AI Triage' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ollama-view {
  animation: fadeIn 0.3s ease;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.border-l-4 {
  border-left-width: 4px;
}
</style>