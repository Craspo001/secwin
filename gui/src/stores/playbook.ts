import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface PlaybookInfo {
  name: string
  path: string
  version: string
  description: string
  mitre_tactics: string[]
  tags: string[]
}

export interface PlaybookRunRequest {
  playbook: string
  variables: Record<string, unknown>
  output_dir?: string
  dry_run: boolean
}

export interface PlaybookStatus {
  id: string
  playbook: string
  status: 'running' | 'completed' | 'failed' | 'stopped'
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  current_step: string | null
  progress: number
  steps_completed: number
  steps_total: number
  findings_count: number
  artifacts_count: number
  report_path: string | null
  error: string | null
}

export const usePlaybookStore = defineStore('playbook', () => {
  const playbooks = ref<PlaybookInfo[]>([])
  const runningPlaybooks = ref<Map<string, PlaybookStatus>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeRuns = computed(() =>
    Array.from(runningPlaybooks.value.values()).filter(
      (p) => p.status === 'running'
    )
  )

  const completedRuns = computed(() =>
    Array.from(runningPlaybooks.value.values()).filter(
      (p) => p.status !== 'running'
    )
  )

  async function fetchPlaybooks() {
    loading.value = true
    error.value = null
    try {
      const list = await invoke<PlaybookInfo[]>('list_playbooks')
      playbooks.value = list
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch playbooks'
      console.error('Failed to fetch playbooks:', e)
    } finally {
      loading.value = false
    }
  }

  async function runPlaybook(request: PlaybookRunRequest) {
    const runId = await invoke<string>('run_playbook', { request })
    return runId
  }

  async function getPlaybookStatus(runId: string) {
    return await invoke<PlaybookStatus | null>('get_playbook_status', { run_id: runId })
  }

  async function stopPlaybook(runId: string) {
    return await invoke<boolean>('stop_playbook', { run_id: runId })
  }

  function updatePlaybookStatus(status: PlaybookStatus) {
    runningPlaybooks.value.set(status.id, status)
  }

  function removePlaybookStatus(runId: string) {
    runningPlaybooks.value.delete(runId)
  }

  return {
    playbooks,
    runningPlaybooks,
    activeRuns,
    completedRuns,
    loading,
    error,
    fetchPlaybooks,
    runPlaybook,
    getPlaybookStatus,
    stopPlaybook,
    updatePlaybookStatus,
    removePlaybookStatus,
  }
})