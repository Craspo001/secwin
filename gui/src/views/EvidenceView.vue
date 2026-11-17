<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useEvidenceStore } from '@/stores/evidence'
import { Card } from '@/components/ui/Card.vue'
import { Search, RefreshCw, Download, FileText, CheckCircle, AlertCircle, Clock, Copy, ExternalLink } from 'lucide-vue-next'

const evidenceStore = useEvidenceStore()

const searchQuery = ref('')
const evidenceDir = ref('')
const verifying = ref(false)
const verifyResult = ref<any>(null)
const exporting = ref(false)
const exportFormat = ref('json')

const filteredArtifacts = computed(() => {
  if (!searchQuery.value) return evidenceStore.artifacts
  const query = searchQuery.value.toLowerCase()
  return evidenceStore.artifacts.filter(a =>
    a.name.toLowerCase().includes(query) ||
    a.step_id.toLowerCase().includes(query) ||
    a.sha256.toLowerCase().includes(query)
  )
})

async function fetchEvidence() {
  await evidenceStore.fetchEvidence(evidenceDir.value || undefined)
}

async function verifyAll() {
  verifying.value = true
  verifyResult.value = null
  try {
    const result = await evidenceStore.verifyEvidence(evidenceDir.value || undefined, false)
    verifyResult.value = result
  } catch (e) {
    verifyResult.value = { success: false, stderr: e instanceof Error ? e.message : 'Verification failed' }
  } finally {
    verifying.value = false
  }
}

async function exportManifest() {
  exporting.value = true
  try {
    await evidenceStore.exportEvidence(evidenceDir.value || undefined, undefined, exportFormat.value)
  } catch (e) {
    console.error('Export failed:', e)
  } finally {
    exporting.value = false
  }
}

function copyHash(hash: string) {
  navigator.clipboard.writeText(hash)
}

function openArtifact(artifact: any) {
  window.open(artifact.path, '_blank')
}

onMounted(() => {
  fetchEvidence()
})
</script>

<template>
  <div class="evidence-view">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl">
      <div>
        <h1 class="text-3xl font-bold">Evidence Locker</h1>
        <p class="text-muted mt-xs">Manage and verify collected artifacts</p>
      </div>
      <div class="flex items-center gap-sm">
        <button class="btn btn-secondary" @click="fetchEvidence" :disabled="evidenceStore.loading">
          <RefreshCw size="16" :class="{ 'animate-spin': evidenceStore.loading }" />
          Refresh
        </button>
        <button class="btn btn-primary" @click="verifyAll" :disabled="verifying">
          <CheckCircle size="16" /> Verify All
        </button>
        <div class="flex items-center gap-sm">
          <select v-model="exportFormat" class="input input-sm select" style="width: auto;">
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
          </select>
          <button class="btn btn-secondary" @click="exportManifest" :disabled="exporting">
            <Download size="16" /> Export
          </button>
        </div>
      </div>
    </div>

    <!-- Evidence Directory -->
    <Card class="mb-lg">
      <template #header>
        <h3 class="card-title">Evidence Directory</h3>
      </template>
      <div class="flex items-center gap-md">
        <input
          v-model="evidenceDir"
          type="text"
          class="input flex-1 font-mono text-sm"
          placeholder="~/.secwin/evidence (default)"
        />
        <button class="btn btn-secondary" @click="fetchEvidence" :disabled="evidenceStore.loading">
          <RefreshCw size="16" :class="{ 'animate-spin': evidenceStore.loading }" />
          Load
        </button>
      </div>
      <p class="text-xs text-muted mt-sm">{{ filteredArtifacts.length }} artifact(s) found</p>
    </Card>

    <!-- Verification Result -->
    <Card v-if="verifyResult" :class="verifyResult.success ? 'border-success' : 'border-danger'">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="card-title">Verification Result</h3>
          <span :class="verifyResult.success ? 'badge badge-success' : 'badge badge-danger'">
            {{ verifyResult.success ? 'PASSED' : 'FAILED' }}
          </span>
        </div>
      </template>
      <pre class="bg-bg-primary p-md rounded font-mono text-sm overflow-x-auto">{{ verifyResult.stdout || verifyResult.stderr }}</pre>
    </Card>

    <!-- Artifacts List -->
    <div v-if="evidenceStore.loading" class="flex items-center justify-center py-2xl">
      <div class="animate-spin rounded-full border-4 border-primary border-t-transparent w-8 h-8" />
    </div>

    <div v-else-if="filteredArtifacts.length === 0" class="card text-center py-2xl">
      <FileText size="48" class="text-muted mx-auto mb-md" />
      <h3 class="text-lg font-medium mb-sm">No artifacts found</h3>
      <p class="text-muted">
        {{ searchQuery.value ? 'Try adjusting your search' : 'Run a playbook to collect evidence' }}
      </p>
    </div>

    <div v-else class="space-y-md">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 40px;"></th>
              <th>Name</th>
              <th>Step</th>
              <th>Size</th>
              <th>SHA256</th>
              <th>Modified</th>
              <th style="width: 80px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="artifact in filteredArtifacts"
              :key="artifact.name"
              class="hover:bg-bg-tertiary"
            >
              <td>
                <div class="w-8 h-8 rounded flex items-center justify-center text-xs font-medium"
                  :class="[
                    artifact.name.endsWith('.json') && 'bg-info-bg text-info',
                    artifact.name.endsWith('.txt') && 'bg-success-bg text-success',
                    artifact.name.endsWith('.xml') && 'bg-warning-bg text-warning',
                    artifact.name.endsWith('.html') && 'bg-primary-bg text-primary',
                    artifact.name.match(/\.(png|jpg|jpeg|gif)$/i) && 'bg-danger-bg text-danger',
                    'bg-bg-tertiary text-muted'
                  ]"
                >
                  <FileText size="14" v-if="!artifact.name.match(/\.(png|jpg|jpeg|gif)$/i)" />
                  <Image size="14" v-else />
                </div>
              </td>
              <td class="font-mono text-sm">{{ artifact.name }}</td>
              <td>
                <span class="badge badge-neutral text-xs">{{ artifact.step_id }}</span>
              </td>
              <td class="text-sm">{{ (artifact.size / 1024).toFixed(1) }} KB</td>
              <td class="font-mono text-xs">
                <span @click="copyHash(artifact.sha256)" class="cursor-pointer hover:text-primary" title="Click to copy">
                  {{ artifact.sha256.slice(0, 16) }}...
                </span>
              </td>
              <td class="text-sm text-muted">{{ new Date(artifact.modified).toLocaleString() }}</td>
              <td>
                <div class="flex items-center gap-xs">
                  <button class="btn btn-ghost btn-sm" @click="openArtifact(artifact)" title="Open">
                    <ExternalLink size="14" />
                  </button>
                  <button class="btn btn-ghost btn-sm" @click="copyHash(artifact.sha256)" title="Copy SHA256">
                    <Copy size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { Image } from 'lucide-vue-next'

export default {
  components: { Image },
}
</script>

<style scoped>
.evidence-view {
  animation: fadeIn 0.3s ease;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.input-sm {
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-sm);
}
</style>