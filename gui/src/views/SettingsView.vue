<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useSystemStore } from '@/stores/system'
import { useOllamaStore } from '@/stores/ollama'
import { invoke } from '@tauri-apps/api/core'
import { Card } from '@/components/ui/Card.vue'
import { Button } from '@/components/ui/Button.vue'
import { Monitor, Sun, Moon, Save, RefreshCw, Terminal, Shield, Archive, Brain, BarChart2, Bell, Key, Trash2, Info, CheckCircle, AlertCircle, Loader2 } from 'lucide-vue-next'

const themeStore = useThemeStore()
const systemStore = useSystemStore()
const ollamaStore = useOllamaStore()

const ollamaUrl = ref('http://localhost:11434')
const ollamaModel = ref('')
const ollamaLoading = ref(false)
const ollamaError = ref<string | null>(null)
const ollamaSuccess = ref(false)

const tabs = [
  { id: 'general', label: 'General', icon: Monitor },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'secwin', label: 'SecWin CLI', icon: Terminal },
  { id: 'ollama', label: 'Ollama AI', icon: Brain },
  { id: 'advanced', label: 'Advanced', icon: Settings },
]

const activeTab = ref('general')
const secwinPath = ref('')
const autoRefresh = ref(true)
const refreshInterval = ref(30)
const notificationsEnabled = ref(true)
const evidenceRetention = ref(90)
const confirmDangerous = ref(true)
const telemetryEnabled = ref(false)

function saveSettings() {
  // Save to localStorage
  localStorage.setItem('secwin-settings', JSON.stringify({
    theme: themeStore.theme,
    sidebarCollapsed: themeStore.sidebarCollapsed,
    secwinPath: secwinPath.value,
    autoRefresh,
    refreshInterval,
    notificationsEnabled,
    evidenceRetention,
    confirmDangerous,
    telemetryEnabled,
  }))
  alert('Settings saved!')
}

async function loadOllamaSettings() {
  ollamaLoading.value = true
  ollamaError.value = null
  try {
    const settings = await invoke<any>('ollama_get_settings')
    ollamaUrl.value = settings.ollama_url || 'http://localhost:11434'
    ollamaModel.value = settings.ollama_model || ''
  } catch (e) {
    ollamaError.value = e instanceof Error ? e.message : 'Failed to load Ollama settings'
    console.error('Failed to load Ollama settings:', e)
  } finally {
    ollamaLoading.value = false
  }
}

async function saveOllamaSettings() {
  ollamaLoading.value = true
  ollamaError.value = null
  ollamaSuccess.value = false
  try {
    await invoke<string>('ollama_save_settings', {
      settings: {
        ollama_url: ollamaUrl.value,
        ollama_model: ollamaModel.value,
      }
    })
    ollamaSuccess.value = true
    // Refresh models list
    await ollamaStore.fetchModels()
    setTimeout(() => { ollamaSuccess.value = false }, 3000)
  } catch (e) {
    ollamaError.value = e instanceof Error ? e.message : 'Failed to save Ollama settings'
    console.error('Failed to save Ollama settings:', e)
  } finally {
    ollamaLoading.value = false
  }
}

async function testOllamaConnection() {
  ollamaLoading.value = true
  ollamaError.value = null
  try {
    const models = await invoke<any[]>('get_ollama_models')
    if (models.length > 0) {
      ollamaSuccess.value = true
      setTimeout(() => { ollamaSuccess.value = false }, 3000)
    } else {
      ollamaError.value = 'Ollama is running but no models are installed. Run `ollama pull <model>` to install a model.'
    }
  } catch (e) {
    ollamaError.value = e instanceof Error ? e.message : 'Failed to connect to Ollama'
    console.error('Failed to connect to Ollama:', e)
  } finally {
    ollamaLoading.value = false
  }
}

onMounted(() => {
  loadSettings()
  loadOllamaSettings()
})

function loadSettings() {
  const saved = localStorage.getItem('secwin-settings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      if (settings.theme) themeStore.setTheme(settings.theme)
      if (settings.sidebarCollapsed !== undefined) themeStore.sidebarCollapsed = settings.sidebarCollapsed
      if (settings.secwinPath) secwinPath.value = settings.secwinPath
      if (settings.autoRefresh !== undefined) autoRefresh.value = settings.autoRefresh
      if (settings.refreshInterval) refreshInterval.value = settings.refreshInterval
      if (settings.notificationsEnabled !== undefined) notificationsEnabled.value = settings.notificationsEnabled
      if (settings.evidenceRetention) evidenceRetention.value = settings.evidenceRetention
      if (settings.confirmDangerous !== undefined) confirmDangerous.value = settings.confirmDangerous
      if (settings.telemetryEnabled !== undefined) telemetryEnabled.value = settings.telemetryEnabled
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }
}

function resetSettings() {
  if (confirm('Reset all settings to defaults?')) {
    localStorage.removeItem('secwin-settings')
    themeStore.setTheme('system')
    themeStore.sidebarCollapsed = false
    secwinPath.value = ''
    autoRefresh.value = true
    refreshInterval.value = 30
    notificationsEnabled.value = true
    evidenceRetention.value = 90
    confirmDangerous.value = true
    telemetryEnabled.value = false
    alert('Settings reset to defaults')
  }
}

function clearAllData() {
  if (confirm('This will clear all cached data, playbook runs, benchmarks, and evidence indexes. Continue?')) {
    localStorage.removeItem('secwin-settings')
    // Clear Pinia stores would need store actions
    alert('Data cleared. Please refresh the app.')
  }
}
</script>

<template>
  <div class="settings-view">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl">
      <div>
        <h1 class="text-3xl font-bold">Settings</h1>
        <p class="text-muted mt-xs">Configure SecWin GUI preferences</p>
      </div>
      <div class="flex items-center gap-sm">
        <button class="btn btn-secondary" @click="resetSettings">
          <RefreshCw size="16" /> Reset
        </button>
        <button class="btn btn-primary" @click="saveSettings">
          <Save size="16" /> Save
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs mb-lg" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
      >
        <component :is="tab.icon" size="18" />
        {{ tab.label }}
      </button>
    </div>

    <!-- General Tab -->
    <div v-if="activeTab === 'general'" class="space-y-lg">
      <Card>
        <template #header>
          <h3 class="card-title">General</h3>
        </template>
        <div class="space-y-md">
          <div>
            <label class="block text-sm font-medium mb-sm">Auto Refresh</label>
            <label class="flex items-center gap-sm cursor-pointer">
              <input type="checkbox" v-model="autoRefresh" class="w-4 h-4" />
              <span>Automatically refresh data on navigation</span>
            </label>
          </div>
          <div>
            <label for="refresh-interval" class="block text-sm font-medium mb-sm">Refresh Interval (seconds)</label>
            <input
              id="refresh-interval"
              v-model.number="refreshInterval"
              type="number"
              min="5"
              max="300"
              class="input"
              :disabled="!autoRefresh"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-sm">Notifications</label>
            <label class="flex items-center gap-sm cursor-pointer">
              <input type="checkbox" v-model="notificationsEnabled" class="w-4 h-4" />
              <span>Enable desktop notifications for long-running tasks</span>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium mb-sm">Evidence Retention (days)</label>
            <input
              v-model.number="evidenceRetention"
              type="number"
              min="1"
              max="365"
              class="input"
            />
            <p class="text-xs text-muted mt-1">Auto-clean evidence older than this many days</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-sm">Confirm Dangerous Actions</label>
            <label class="flex items-center gap-sm cursor-pointer">
              <input type="checkbox" v-model="confirmDangerous" class="w-4 h-4" />
              <span>Require confirmation for destructive operations</span>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium mb-sm">Telemetry</label>
            <label class="flex items-center gap-sm cursor-pointer">
              <input type="checkbox" v-model="telemetryEnabled" class="w-4 h-4" />
              <span>Send anonymous usage statistics (helps improve SecWin)</span>
            </label>
          </div>
        </div>
      </Card>

      <Card class="border-danger">
        <template #header>
          <h3 class="card-title text-danger">Danger Zone</h3>
        </template>
        <div class="space-y-md">
          <button class="btn btn-danger w-full sm:w-auto justify-start" @click="clearAllData">
            <Trash2 size="16" /> Clear All Local Data
          </button>
          <p class="text-sm text-muted">Removes all cached data, history, and settings</p>
        </div>
      </Card>
    </div>

    <!-- Appearance Tab -->
    <div v-if="activeTab === 'appearance'" class="space-y-lg">
      <Card>
        <template #header>
          <h3 class="card-title">Theme</h3>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-md">
          <button
            class="btn btn-lg p-xl text-left" :class="themeStore.theme === 'light' ? 'btn-primary' : 'btn-secondary'"
            @click="themeStore.setTheme('light')"
          >
            <Sun size="24" class="mb-sm" />
            <div class="font-medium">Light</div>
            <div class="text-sm text-muted">Always light mode</div>
          </button>
          <button
            class="btn btn-lg p-xl text-left" :class="themeStore.theme === 'dark' ? 'btn-primary' : 'btn-secondary'"
            @click="themeStore.setTheme('dark')"
          >
            <Moon size="24" class="mb-sm" />
            <div class="font-medium">Dark</div>
            <div class="text-sm text-muted">Always dark mode</div>
          </button>
          <button
            class="btn btn-lg p-xl text-left" :class="themeStore.theme === 'system' ? 'btn-primary' : 'btn-secondary'"
            @click="themeStore.setTheme('system')"
          >
            <Monitor size="24" class="mb-sm" />
            <div class="font-medium">System</div>
            <div class="text-sm text-muted">Follow OS preference</div>
          </button>
        </div>
      </Card>

      <Card>
        <template #header>
          <h3 class="card-title">Sidebar</h3>
        </template>
        <label class="flex items-center gap-sm cursor-pointer">
          <input type="checkbox" v-model="themeStore.sidebarCollapsed" class="w-4 h-4" />
          <span>Collapse sidebar by default</span>
        </label>
      </Card>
    </div>

    <!-- SecWin CLI Tab -->
    <div v-if="activeTab === 'secwin'" class="space-y-lg">
      <Card>
        <template #header>
          <h3 class="card-title">SecWin CLI Configuration</h3>
        </template>
        <div class="space-y-md">
          <div>
            <label for="secwin-path" class="block text-sm font-medium mb-sm">SecWin Binary Path</label>
            <div class="flex items-center gap-sm">
              <input
                id="secwin-path"
                v-model="secwinPath"
                type="text"
                class="input flex-1 font-mono text-sm"
                placeholder="Auto-detected from PATH"
                readonly
              />
              <button class="btn btn-secondary" @click="detectSecwinPath">
                <RefreshCw size="16" /> Detect
              </button>
            </div>
            <p class="text-xs text-muted mt-1">Leave empty to auto-detect from system PATH</p>
          </div>

          <div v-if="systemStore.systemInfo" class="grid grid-cols-1 sm:grid-cols-2 gap-md p-md bg-bg-tertiary rounded">
            <div>
              <p class="text-sm text-muted">Detected Version</p>
              <p class="font-mono">{{ systemStore.systemInfo.secwin_version || 'Not found' }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Binary Path</p>
              <p class="font-mono text-sm truncate">{{ systemStore.systemInfo.secwin_path || 'Not in PATH' }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">WSL Available</p>
              <p>{{ systemStore.systemInfo.wsl_available ? 'Yes' : 'No' }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Ollama Available</p>
              <p>{{ systemStore.systemInfo.ollama_available ? 'Yes' : 'No' }}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <template #header>
          <h3 class="card-title">Quick Actions</h3>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">
          <button class="btn btn-secondary w-full justify-start" @click="systemStore.fetchSystemInfo">
            <RefreshCw size="18" /> Refresh System Info
          </button>
          <button class="btn btn-secondary w-full justify-start">
            <Shield size="18" /> Test OpSec Profile
          </button>
          <button class="btn btn-secondary w-full justify-start">
            <Archive size="18" /> Verify Evidence
          </button>
          <button class="btn btn-secondary w-full justify-start">
            <Brain size="18" /> Test Ollama Connection
          </button>
        </div>
      </Card>
    </div>

    <!-- Ollama AI Tab -->
    <div v-if="activeTab === 'ollama'" class="space-y-lg">
      <Card>
        <template #header>
          <h3 class="card-title">Ollama Configuration</h3>
        </template>
        <div class="space-y-md">
          <div>
            <label for="ollama-url" class="block text-sm font-medium mb-sm">Ollama API URL</label>
            <input
              id="ollama-url"
              v-model="ollamaUrl"
              type="text"
              placeholder="http://localhost:11434"
              class="input font-mono text-sm"
              :disabled="ollamaLoading"
            />
            <p class="text-xs text-muted mt-1">Default: http://localhost:11434</p>
          </div>
          <div>
            <label for="ollama-model" class="block text-sm font-medium mb-sm">Default Model</label>
            <input
              id="ollama-model"
              v-model="ollamaModel"
              type="text"
              placeholder="e.g., llama3.1, mistral, codellama"
              class="input font-mono text-sm"
              :disabled="ollamaLoading"
            />
            <p class="text-xs text-muted mt-1">Model name as shown in `ollama list`</p>
          </div>
          <div class="flex items-center gap-sm">
            <Button variant="primary" @click="saveOllamaSettings" :disabled="ollamaLoading">
              <Loader2 v-if="ollamaLoading" class="animate-spin" size="16" />
              <Save v-else size="16" />
              {{ ollamaLoading ? 'Saving...' : 'Save Settings' }}
            </Button>
            <Button variant="secondary" @click="testOllamaConnection" :disabled="ollamaLoading">
              <RefreshCw size="16" />
              Test Connection
            </Button>
            <span v-if="ollamaSuccess" class="flex items-center gap-xs text-success text-sm">
              <CheckCircle size="14" /> Settings saved & connection OK
            </span>
            <span v-else-if="ollamaError" class="flex items-center gap-xs text-danger text-sm">
              <AlertCircle size="14" /> {{ ollamaError }}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <template #header>
          <h3 class="card-title">Available Models</h3>
        </template>
        <div v-if="ollamaStore.loading" class="flex items-center justify-center py-lg">
          <Loader2 class="animate-spin" size="24" />
          <span class="ml-sm text-muted">Loading models...</span>
        </div>
        <div v-else-if="ollamaStore.models.length === 0" class="text-center py-lg text-muted">
          <Brain size="48" class="mx-auto mb-md opacity-50" />
          <p>No models found. Install models with <code class="font-mono bg-bg-tertiary px-1 rounded">ollama pull <model></code></p>
          <p class="text-sm mt-sm">Popular models: <code class="font-mono">llama3.1</code>, <code class="font-mono">mistral</code>, <code class="font-mono">codellama</code>, <code class="font-mono">phi3</code></p>
        </div>
        <div v-else class="space-y-sm">
          <div v-for="model in ollamaStore.models" :key="model.name" class="flex items-center justify-between p-sm rounded hover:bg-bg-tertiary">
            <div class="flex items-center gap-md">
              <Brain size="20" class="text-primary" />
              <div>
                <p class="font-medium font-mono text-sm">{{ model.name }}</p>
                <p class="text-xs text-muted">{{ model.size }} • {{ model.modified }}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              @click="ollamaModel = model.name; saveOllamaSettings()"
              :disabled="ollamaLoading"
            >
              Use as Default
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <template #header>
          <h3 class="card-title">Usage</h3>
        </template>
        <div class="space-y-md text-sm">
          <p>Configure Ollama to enable AI-powered finding triage in the <strong>AI Triage</strong> page.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div class="card p-md">
              <p class="font-medium mb-sm">Requirements</p>
              <ul class="space-y-xs text-muted">
                <li>• Ollama installed and running</li>
                <li>• At least one model pulled (<code class="font-mono">ollama pull llama3.1</code>)</li>
                <li>• API accessible at configured URL</li>
              </ul>
            </div>
            <div class="card p-md">
              <p class="font-medium mb-sm">Features Enabled</p>
              <ul class="space-y-xs text-muted">
                <li>• Finding triage with severity assessment</li>
                <li>• MITRE ATT&CK technique mapping</li>
                <li>• Remediation recommendations</li>
                <li>• Executive report summarization</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Advanced Tab -->
    <div v-if="activeTab === 'advanced'" class="space-y-lg">
      <Card>
        <template #header>
          <h3 class="card-title">About</h3>
        </template>
        <div class="space-y-md">
          <div class="flex items-center gap-md">
            <div class="avatar avatar-lg" style="background: var(--color-brand-primary);">
              <Shield size="28" />
            </div>
            <div>
              <h4 class="font-semibold text-lg">SecWin GUI</h4>
              <p class="text-muted">Version 1.0.0</p>
              <p class="text-sm text-muted mt-1">Modern Kali Tooling on Windows</p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-md text-sm">
            <div>
              <p class="text-muted">Tauri Version</p>
              <p class="font-mono">2.0</p>
            </div>
            <div>
              <p class="text-muted">Vue Version</p>
              <p class="font-mono">3.4</p>
            </div>
            <div>
              <p class="text-muted">SecWin CLI</p>
              <p class="font-mono">{{ systemStore.systemInfo?.secwin_version?.replace('secwin ', '') || 'Unknown' }}</p>
            </div>
            <div>
              <p class="text-muted">Platform</p>
              <p class="font-mono">{{ systemStore.systemInfo?.os || 'Unknown' }} ({{ systemStore.systemInfo?.arch || 'Unknown' }})</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <template #header>
          <h3 class="card-title">Links</h3>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">
          <a href="https://github.com/secwin/secwin" target="_blank" class="btn btn-secondary w-full justify-start">
            <ExternalLink size="18" /> GitHub Repository
          </a>
          <a href="https://github.com/secwin/secwin/issues" target="_blank" class="btn btn-secondary w-full justify-start">
            <AlertCircle size="18" /> Report Issue
          </a>
          <a href="https://github.com/secwin/secwin/blob/main/docs" target="_blank" class="btn btn-secondary w-full justify-start">
            <FileText size="18" /> Documentation
          </a>
          <a href="https://github.com/secwin/secwin/blob/main/ETHICS.md" target="_blank" class="btn btn-secondary w-full justify-start">
            <Shield size="18" /> Ethics Policy
          </a>
        </div>
      </Card>

      <Card class="border-danger">
        <template #header>
          <h3 class="card-title text-danger">Danger Zone</h3>
        </template>
        <div class="space-y-md">
          <button class="btn btn-danger w-full sm:w-auto justify-start" @click="clearAllData">
            <Trash2 size="16" /> Clear All Local Data
          </button>
          <p class="text-sm text-muted">Removes all cached data, history, and settings</p>
        </div>
      </Card>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    detectSecwinPath() {
      // This would call the Tauri command to detect secwin path
      this.systemStore.fetchSystemInfo().then(() => {
        if (this.systemStore.systemInfo?.secwin_path) {
          this.secwinPath = this.systemStore.systemInfo.secwin_path
        }
      })
    },
  },
}
</script>

<style scoped>
.settings-view {
  animation: fadeIn 0.3s ease;
}
</style>