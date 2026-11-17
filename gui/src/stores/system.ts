import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface SystemInfo {
  os: string
  os_version: string
  arch: string
  hostname: string
  username: string
  secwin_version: string | null
  secwin_path: string | null
  wsl_available: boolean
  wsl_distros: string[]
  ollama_available: boolean
  ollama_models: string[]
}

export const useSystemStore = defineStore('system', () => {
  const systemInfo = ref<SystemInfo | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isSecwinInstalled = computed(() => !!systemInfo.value?.secwin_path)
  const isWSLAvailable = computed(() => systemInfo.value?.wsl_available ?? false)
  const isOllamaAvailable = computed(() => systemInfo.value?.ollama_available ?? false)

  async function fetchSystemInfo() {
    loading.value = true
    error.value = null
    try {
      const info = await invoke<SystemInfo>('get_system_info')
      systemInfo.value = info
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch system info'
      console.error('Failed to fetch system info:', e)
    } finally {
      loading.value = false
    }
  }

  async function runSecwinCommand(args: string[], workingDir?: string) {
    return await invoke('run_secwin_command', { args, working_dir: workingDir })
  }

  return {
    systemInfo,
    loading,
    error,
    isSecwinInstalled,
    isWSLAvailable,
    isOllamaAvailable,
    fetchSystemInfo,
    runSecwinCommand,
  }
})