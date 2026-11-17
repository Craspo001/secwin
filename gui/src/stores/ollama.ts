import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface OllamaModel {
  name: string
  size: string
  modified: string
  digest: string
}

export interface FindingInput {
  id: string
  title: string
  description: string
  severity: string
  mitre_techniques: string[]
  evidence: Record<string, string>
}

export interface TriageRequest {
  findings: FindingInput[]
  context?: string
}

export interface TriageFinding {
  original_id: string
  title: string
  severity: string
  confidence: number
  analysis: string
  remediation: string
  mitre_mapping: string[]
  false_positive_likelihood: number
}

export interface TriageResult {
  findings: TriageFinding[]
  summary: string
  risk_score: number
  recommendations: string[]
}

export const useOllamaStore = defineStore('ollama', () => {
  const models = ref<OllamaModel[]>([])
  const loading = ref(false)
  const triaging = ref(false)
  const error = ref<string | null>(null)
  const lastTriageResult = ref<TriageResult | null>(null)

  async function fetchModels() {
    loading.value = true
    error.value = null
    try {
      const list = await invoke<OllamaModel[]>('get_ollama_models')
      models.value = list
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch Ollama models'
      console.error('Failed to fetch Ollama models:', e)
    } finally {
      loading.value = false
    }
  }

  async function triageFindings(request: TriageRequest) {
    triaging.value = true
    error.value = null
    try {
      const result = await invoke<TriageResult>('ollama_triage_findings', {
        findings: request.findings,
        context: request.context
      })
      lastTriageResult.value = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to triage findings'
      throw e
    } finally {
      triaging.value = false
    }
  }

  function clearTriageResult() {
    lastTriageResult.value = null
  }

  return {
    models,
    loading,
    triaging,
    error,
    lastTriageResult,
    fetchModels,
    triageFindings,
    clearTriageResult,
  }
})