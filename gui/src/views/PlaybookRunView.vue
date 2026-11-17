<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaybookStore } from '@/stores/playbook'
import { Card } from '@/components/ui/Card.vue'
import { ChevronLeft, Play, RotateCw, X, FileText, Save, Settings } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const playbookStore = usePlaybookStore()

const playbookId = computed(() => route.params.id as string)
const playbook = ref<any>(null)
const variables = ref<Record<string, any>>({})
const outputDir = ref('')
const dryRun = ref(false)
const loading = ref(false)
const running = ref(false)
const runId = ref<string | null>(null)
const error = ref<string | null>(null)
const showAdvanced = ref(false)

async function fetchPlaybook() {
  await playbookStore.fetchPlaybooks()
  playbook.value = playbookStore.playbooks.find((p) => p.name === playbookId.value) || null
  if (playbook.value?.variables) {
    for (const [name, variable] of Object.entries(playbook.value.variables)) {
      variables.value[name] = variable.default ?? ''
    }
  }
  outputDir.value = `./engagements/${playbookId.value}-${Date.now()}`
}

function goBack() {
  router.push({ name: 'PlaybookDetail', params: { id: playbookId.value } })
}

async function startRun() {
  if (!playbook.value) return

  error.value = null
  running.value = true

  // Build variables object
  const vars: Record<string, any> = {}
  for (const [key, value] of Object.entries(variables.value)) {
    if (value !== '' && value !== null && value !== undefined) {
      vars[key] = value
    }
  }

  try {
    const id = await playbookStore.runPlaybook({
      playbook: playbookId.value,
      variables: vars,
      output_dir: outputDir.value || undefined,
      dry_run: dryRun.value,
    })
    runId.value = id
    router.push({ name: 'PlaybookRunStatus', params: { runId: id } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to start playbook'
  } finally {
    running.value = false
  }
}

function saveConfig() {
  const config = {
    playbook: playbookId.value,
    variables: variables.value,
    output_dir: outputDir.value,
    dry_run: dryRun.value,
  }
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${playbookId.value}-config.json`
  a.click()
  URL.revokeObjectURL(url)
}

function loadConfig(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target?.result as string)
      if (config.variables) variables.value = config.variables
      if (config.output_dir) outputDir.value = config.output_dir
      if (config.dry_run !== undefined) dryRun.value = config.dry_run
    } catch (err) {
      error.value = 'Invalid config file'
    }
  }
  reader.readAsText(file)
}

onMounted(() => {
  fetchPlaybook()
})
</script>

<template>
  <div class="playbook-run-view">
    <!-- Header -->
    <div class="flex items-center gap-md mb-xl">
      <button class="btn btn-ghost btn-sm" @click="goBack">
        <ChevronLeft size="18" />
        Back
      </button>

      <div v-if="playbook" class="flex-1">
        <h1 class="text-3xl font-bold">Run: {{ playbook.name }}</h1>
        <p class="text-muted">Configure and execute this playbook</p>
      </div>

      <div v-if="playbook" class="flex items-center gap-sm">
        <button class="btn btn-secondary" @click="showAdvanced = !showAdvanced">
          <Settings size="16" /> Advanced
        </button>
        <button class="btn btn-secondary" @click="saveConfig">
          <Save size="16" /> Save Config
        </button>
        <input type="file" accept=".json" @change="loadConfig" class="hidden" id="config-file" ref="configFile" />
        <button class="btn btn-ghost" @click="() => $refs.configFile.click()">
          <FileText size="16" /> Load Config
        </button>
      </div>
    </div>

    <!-- Loading/Error -->
    <div v-if="loading" class="flex items-center justify-center py-2xl">
      <div class="animate-spin rounded-full border-4 border-primary border-t-transparent w-8 h-8" />
    </div>

    <div v-else-if="error" class="card border-danger">
      <div class="flex items-center gap-md p-md">
        <X class="text-danger" size="24" />
        <div>
          <p class="font-medium">{{ error }}</p>
          <button class="btn btn-ghost btn-sm mt-sm" @click="fetchPlaybook">Retry</button>
        </div>
      </div>
    </div>

    <!-- Form -->
    <div v-else-if="playbook" class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      <!-- Main Form -->
      <div class="lg:col-span-2 space-y-lg">
        <!-- Variables -->
        <Card v-if="playbook.variables && Object.keys(playbook.variables).length > 0">
          <template #header>
            <h3 class="card-title">Variables</h3>
            <p class="text-sm text-muted">{{ Object.values(playbook.variables).filter((v: any) => v.required).length }} required</p>
          </template>
          <div class="space-y-md">
            <div
              v-for="[name, variable] in Object.entries(playbook.variables)"
              :key="name"
              class="grid grid-cols-1 sm:grid-cols-3 gap-md items-start"
            >
              <label :for="name" class="font-medium text-sm sm:pt-2">{{ name }}</label>
              <div class="sm:col-span-2">
                <input
                  v-if="variable.type === 'string' && variable.enum && variable.enum.length > 0"
                  :id="name"
                  v-model="variables[name]"
                  :list="name + '-options'"
                  class="input"
                  :placeholder="variable.description"
                  :required="variable.required"
                />
                <datalist :id="name + '-options'">
                  <option v-for="opt in variable.enum" :key="opt" :value="opt" />
                </datalist>

                <input
                  v-else-if="variable.type === 'string'"
                  :id="name"
                  v-model="variables[name]"
                  type="text"
                  class="input"
                  :placeholder="variable.description"
                  :required="variable.required"
                />

                <input
                  v-else-if="variable.type === 'number'"
                  :id="name"
                  v-model.number="variables[name]"
                  type="number"
                  class="input"
                  :placeholder="variable.description"
                  :required="variable.required"
                />

                <input
                  v-else-if="variable.type === 'boolean'"
                  :id="name"
                  v-model="variables[name]"
                  type="checkbox"
                  class="w-4 h-4"
                />

                <textarea
                  v-else
                  :id="name"
                  v-model="variables[name]"
                  class="input"
                  :placeholder="variable.description"
                  rows="3"
                ></textarea>

                <p v-if="variable.description" class="text-xs text-muted mt-1">{{ variable.description }}</p>
                <span v-if="variable.required" class="badge badge-danger text-xs">Required</span>
                <span v-else class="badge badge-neutral text-xs">Optional</span>
              </div>
            </div>
          </div>
        </Card>

        <Card v-else>
          <template #header>
            <h3 class="card-title">Variables</h3>
          </template>
          <p class="text-muted">No variables defined for this playbook.</p>
        </Card>

        <!-- Advanced Options -->
        <Card v-if="showAdvanced" class="space-y-md">
          <template #header>
            <h3 class="card-title">Advanced Options</h3>
          </template>
          <div class="space-y-md">
            <div>
              <label for="output-dir" class="block text-sm font-medium mb-sm">Output Directory</label>
              <input
                id="output-dir"
                v-model="outputDir"
                type="text"
                class="input"
                placeholder="./engagements/..."
              />
              <p class="text-xs text-muted mt-1">Directory for reports, evidence, and artifacts</p>
            </div>

            <div>
              <label class="flex items-center gap-sm cursor-pointer">
                <input type="checkbox" v-model="dryRun" class="w-4 h-4" />
                <span class="font-medium">Dry Run</span>
              </label>
              <p class="text-xs text-muted mt-1 ml-6">Validate playbook without executing tools</p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="space-y-lg">
        <!-- Playbook Info -->
        <Card>
          <template #header>
            <h3 class="card-title">Playbook Info</h3>
          </template>
          <div class="space-y-md">
            <div>
              <p class="text-sm text-muted">Version</p>
              <p class="font-medium">{{ playbook.version }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Steps</p>
              <p class="font-medium">{{ playbook.steps?.length || 0 }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">MITRE Tactics</p>
              <div class="flex flex-wrap gap-sm mt-1">
                <span
                  v-for="tactic in playbook.mitre_tactics"
                  :key="tactic"
                  class="badge badge-info text-xs"
                >
                  {{ tactic }}
                </span>
              </div>
            </div>
            <div>
              <p class="text-sm text-muted">Tags</p>
              <div class="flex flex-wrap gap-sm mt-1">
                <span
                  v-for="tag in playbook.tags"
                  :key="tag"
                  class="badge badge-neutral text-xs"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <!-- Run Button -->
        <Card>
          <div class="space-y-sm">
            <button
              class="btn btn-primary w-full justify-center py-lg text-lg"
              @click="startRun"
              :disabled="running"
            >
              <RotateCw v-if="running" class="animate-spin" size="20" />
              <Play v-else size="20" />
              {{ running ? 'Starting...' : 'Run Playbook' }}
            </button>

            <p v-if="dryRun" class="text-center text-sm text-warning">
              <RotateCw size="14" class="inline mr-1" /> Dry run mode - no tools will be executed
            </p>

            <div class="text-center text-xs text-muted">
              Output: {{ outputDir }}
            </div>
          </div>
        </Card>

        <!-- Requirements Check -->
        <Card>
          <template #header>
            <h3 class="card-title">Requirements</h3>
          </template>
          <ul class="space-y-sm text-sm">
            <li class="flex items-center gap-sm" :class="playbookStore.isSecwinInstalled ? 'text-success' : 'text-danger'">
              <CheckCircle v-if="playbookStore.isSecwinInstalled" size="16" />
              <X v-else size="16" />
              SecWin CLI installed
            </li>
            <li class="flex items-center gap-sm text-muted">
              <FileText size="16" />
              Playbook file accessible
            </li>
            <li v-if="playbook.variables && Object.values(playbook.variables).some((v: any) => v.required)" class="flex items-center gap-sm text-warning">
              <RotateCw size="16" />
              Required variables provided
            </li>
          </ul>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playbook-run-view {
  animation: fadeIn 0.3s ease;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>