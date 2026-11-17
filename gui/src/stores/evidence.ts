import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface EvidenceArtifact {
  name: string
  path: string
  size: number
  sha256: string
  step_id: string
  timestamp: string
  modified: string
}

export interface EvidenceManifest {
  generated_at: string
  evidence_dir: string
  artifacts: EvidenceArtifact[]
}

export const useEvidenceStore = defineStore('evidence', () => {
  const artifacts = ref<EvidenceArtifact[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchEvidence(dir?: string) {
    loading.value = true
    error.value = null
    try {
      const list = await invoke<EvidenceArtifact[]>('list_evidence', { dir })
      artifacts.value = list
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch evidence'
      console.error('Failed to fetch evidence:', e)
    } finally {
      loading.value = false
    }
  }

  async function verifyEvidence(dir?: string, strict = false) {
    loading.value = true
    error.value = null
    try {
      const result = await invoke('verify_evidence', { dir, strict })
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to verify evidence'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function exportEvidence(dir?: string, output?: string, format?: string) {
    loading.value = true
    error.value = null
    try {
      const result = await invoke('export_evidence', { dir, output, format })
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to export evidence'
      throw e
    } finally {
      loading.value = false
    }
  }

  function getArtifactByName(name: string) {
    return artifacts.value.find((a) => a.name === name)
  }

  function getArtifactsByStep(stepId: string) {
    return artifacts.value.filter((a) => a.step_id === stepId)
  }

  return {
    artifacts,
    loading,
    error,
    fetchEvidence,
    verifyEvidence,
    exportEvidence,
    getArtifactByName,
    getArtifactsByStep,
  }
})