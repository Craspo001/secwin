import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface ToolInfo {
  name: string
  description: string
  category: string
  installed: boolean
  version: string | null
  install_method: string | null
  wsl_preferred: boolean
}

export const useToolsStore = defineStore('tools', () => {
  const tools = ref<ToolInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const installing = ref<Set<string>>(new Set())

  const installedTools = computed(() => tools.value.filter((t) => t.installed))
  const availableTools = computed(() => tools.value.filter((t) => !t.installed))
  const toolsByCategory = computed(() => {
    const categories: Record<string, ToolInfo[]> = {}
    for (const tool of tools.value) {
      if (!categories[tool.category]) categories[tool.category] = []
      categories[tool.category].push(tool)
    }
    return categories
  })

  async function fetchTools() {
    loading.value = true
    error.value = null
    try {
      const list = await invoke<ToolInfo[]>('list_tools')
      tools.value = list
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch tools'
      console.error('Failed to fetch tools:', e)
    } finally {
      loading.value = false
    }
  }

  async function installTool(name: string, method?: string) {
    installing.value.add(name)
    error.value = null
    try {
      const result = await invoke('install_tool', { name, method })
      // Refresh tool list after install
      await fetchTools()
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to install tool'
      throw e
    } finally {
      installing.value.delete(name)
    }
  }

  async function searchTools(query: string) {
    loading.value = true
    error.value = null
    try {
      const results = await invoke<ToolInfo[]>('search_tools', { query })
      return results
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to search tools'
      console.error('Failed to search tools:', e)
      return []
    } finally {
      loading.value = false
    }
  }

  function isInstalling(name: string) {
    return installing.value.has(name)
  }

  function getTool(name: string) {
    return tools.value.find((t) => t.name === name)
  }

  return {
    tools,
    loading,
    error,
    installing,
    installedTools,
    availableTools,
    toolsByCategory,
    fetchTools,
    installTool,
    searchTools,
    isInstalling,
    getTool,
  }
})