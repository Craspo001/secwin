<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaybookStore } from '@/stores/playbook'
import { Card } from '@/components/ui/Card.vue'
import { ChevronLeft, Play, FileText, Copy, ExternalLink, Tag, Clock, GitBranch } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const playbookStore = usePlaybookStore()

const playbook = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const playbookId = computed(() => route.params.id as string)

async function fetchPlaybook() {
  loading.value = true
  error.value = null
  try {
    await playbookStore.fetchPlaybooks()
    playbook.value = playbookStore.playbooks.find((p) => p.name === playbookId.value) || null
    if (!playbook.value) {
      error.value = 'Playbook not found'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load playbook'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/playbooks')
}

function runPlaybook() {
  router.push({ name: 'PlaybookRun', params: { id: playbookId.value } })
}

function copyPlaybookPath() {
  navigator.clipboard.writeText(playbook.value?.path || '')
}

onMounted(() => {
  fetchPlaybook()
})
</script>

<template>
  <div class="playbook-detail-view">
    <!-- Header -->
    <div class="flex items-center gap-md mb-xl">
      <button class="btn btn-ghost btn-sm" @click="goBack">
        <ChevronLeft size="18" />
        Back
      </button>

      <div v-if="playbook" class="flex-1">
        <h1 class="text-3xl font-bold">{{ playbook.name }}</h1>
        <p class="text-muted">{{ playbook.description }}</p>
      </div>

      <div v-if="playbook" class="flex items-center gap-sm">
        <button class="btn btn-primary" @click="runPlaybook">
          <Play size="18" /> Run Playbook
        </button>
        <button class="btn btn-secondary" @click="copyPlaybookPath" title="Copy path">
          <Copy size="18" />
        </button>
        <a :href="playbook.path" target="_blank" class="btn btn-ghost" title="Open in editor">
          <ExternalLink size="18" />
        </a>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-2xl">
      <div class="animate-spin rounded-full border-4 border-primary border-t-transparent w-8 h-8" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="card text-center py-2xl">
      <AlertCircle size="48" class="text-danger mx-auto mb-md" />
      <h3 class="text-lg font-medium mb-sm">Failed to Load</h3>
      <p class="text-muted">{{ error }}</p>
      <button class="btn btn-primary mt-md" @click="fetchPlaybook">Retry</button>
    </div>

    <!-- Content -->
    <div v-else-if="playbook" class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      <!-- Main Content -->
      <div class="lg:col-span-2 space-y-lg">
        <!-- Metadata -->
        <Card>
          <template #header>
            <h3 class="card-title">Metadata</h3>
          </template>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div>
              <p class="text-sm text-muted">Version</p>
              <p class="font-medium">{{ playbook.version }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Tags</p>
              <div class="flex flex-wrap gap-sm">
                <span v-for="tag in playbook.tags" :key="tag" class="badge badge-neutral">
                  <Tag size="12" class="mr-1" /> {{ tag }}
                </span>
                <span v-if="playbook.tags.length === 0" class="text-muted text-sm">No tags</span>
              </div>
            </div>
            <div>
              <p class="text-sm text-muted">MITRE Tactics</p>
              <div class="flex flex-wrap gap-sm">
                <span
                  v-for="tactic in playbook.mitre_tactics"
                  :key="tactic"
                  class="badge badge-info"
                >
                  {{ tactic }}
                </span>
                <span v-if="playbook.mitre_tactics.length === 0" class="text-muted text-sm">
                  None specified
                </span>
              </div>
            </div>
            <div>
              <p class="text-sm text-muted">Source File</p>
              <p class="font-mono text-sm truncate">{{ playbook.path }}</p>
            </div>
          </div>
        </Card>

        <!-- Variables -->
        <Card v-if="playbook.variables && Object.keys(playbook.variables).length > 0">
          <template #header>
            <h3 class="card-title">Variables</h3>
          </template>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Default</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="[name, variable] in Object.entries(playbook.variables)" :key="name">
                  <td class="font-mono">{{ name }}</td>
                  <td><span class="badge badge-neutral">{{ variable.type }}</span></td>
                  <td>
                    <span :class="variable.required ? 'badge badge-success' : 'badge badge-neutral'">
                      {{ variable.required ? 'Yes' : 'No' }}
                    </span>
                  </td>
                  <td class="font-mono text-sm">
                    {{ variable.default !== undefined ? JSON.stringify(variable.default) : '—' }}
                  </td>
                  <td class="text-muted">{{ variable.description || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <!-- Steps -->
        <Card>
          <template #header>
            <h3 class="card-title">Steps ({{ playbook.steps?.length || 0 }})</h3>
          </template>
          <div v-if="playbook.steps && playbook.steps.length > 0" class="space-y-md">
            <div
              v-for="(step, index) in playbook.steps"
              :key="step.id"
              class="border border-border-light rounded-lg p-md hover:bg-bg-tertiary transition-colors"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-md flex-1">
                  <span class="badge badge-neutral text-sm font-mono">{{ index + 1 }}</span>
                  <div>
                    <h4 class="font-medium">{{ step.name || step.id }}</h4>
                    <p class="text-sm text-muted font-mono">{{ step.tool }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-sm">
                  <span v-if="step.mitre_techniques && step.mitre_techniques.length > 0" class="badge badge-info text-xs">
                    <GitBranch size="10" class="mr-1" />
                    {{ step.mitre_techniques.length }} technique(s)
                  </span>
                  <span v-if="step.condition" class="badge badge-warning text-xs">
                    Conditional
                  </span>
                  <span v-if="step.retry > 0" class="badge badge-neutral text-xs">
                    Retry ×{{ step.retry }}
                  </span>
                </div>
              </div>

              <div v-if="step.args && step.args.length > 0" class="mt-sm pt-sm border-t border-border-light">
                <p class="text-xs text-muted mb-xs">Arguments:</p>
                <div class="font-mono text-sm bg-bg-tertiary rounded p-sm overflow-x-auto">
                  {{ step.args.join(' ') }}
                </div>
              </div>

              <div v-if="step.artifacts && step.artifacts.length > 0" class="mt-sm pt-sm border-t border-border-light">
                <p class="text-xs text-muted mb-xs">Artifacts:</p>
                <div class="flex flex-wrap gap-sm">
                  <span
                    v-for="artifact in step.artifacts"
                    :key="artifact"
                    class="badge badge-neutral text-xs font-mono"
                  >
                    {{ artifact }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-muted text-center py-md">No steps defined</p>
        </Card>

        <!-- Outputs -->
        <Card v-if="playbook.outputs">
          <template #header>
            <h3 class="card-title">Outputs</h3>
          </template>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div v-if="playbook.outputs.report">
              <p class="text-sm text-muted">Report</p>
              <p class="font-mono text-sm">{{ playbook.outputs.report }}</p>
            </div>
            <div v-if="playbook.outputs.evidence_dir">
              <p class="text-sm text-muted">Evidence Directory</p>
              <p class="font-mono text-sm">{{ playbook.outputs.evidence_dir }}</p>
            </div>
            <div v-if="playbook.outputs.formats && playbook.outputs.formats.length > 0">
              <p class="text-sm text-muted">Formats</p>
              <div class="flex flex-wrap gap-sm">
                <span
                  v-for="format in playbook.outputs.formats"
                  :key="format"
                  class="badge badge-info"
                >
                  {{ format }}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Sidebar Info -->
      <div class="space-y-lg">
        <Card>
          <template #header>
            <h3 class="card-title">Quick Actions</h3>
          </template>
          <div class="space-y-sm">
            <button class="btn btn-primary w-full justify-start" @click="runPlaybook">
              <Play size="18" /> Run Playbook
            </button>
            <button class="btn btn-secondary w-full justify-start" @click="copyPlaybookPath">
              <Copy size="18" /> Copy Path
            </button>
            <a :href="playbook?.path" target="_blank" class="btn btn-ghost w-full justify-start">
              <ExternalLink size="18" /> Open in Editor
            </a>
          </div>
        </Card>

        <Card>
          <template #header>
            <h3 class="card-title">Requirements</h3>
          </template>
          <ul class="space-y-sm text-sm">
            <li v-if="playbook?.outputs?.evidence_dir" class="flex items-center gap-sm text-muted">
              <Clock size="16" /> Evidence directory needed
            </li>
            <li v-if="playbook?.variables && Object.values(playbook.variables).some((v: any) => v.required)" class="flex items-center gap-sm text-warning">
              <AlertCircle size="16" /> Required variables must be provided
            </li>
            <li class="flex items-center gap-sm text-muted">
              <FileText size="16" /> secwin CLI installed
            </li>
            <li v-if="playbook?.steps?.some((s: any) => s.tool)" class="flex items-center gap-sm text-muted">
              <GitBranch size="16" /> Tools from manifests
            </li>
          </ul>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playbook-detail-view {
  animation: fadeIn 0.3s ease;
}
</style>