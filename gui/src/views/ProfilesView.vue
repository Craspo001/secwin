<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { Card } from '@/components/ui/Card.vue'
import { Plus, Shield, Wifi, Globe, Clock, Wrench, Trash2, Play, RotateCw, X, CheckCircle, AlertCircle } from 'lucide-vue-next'

const profileStore = useProfileStore()

const showCreateModal = ref(false)
const newProfile = ref({
  name: '',
  vpn_config: '',
  mac_spoof: false,
  hostname: '',
  timezone: '',
  dns: '',
  proxy: '',
})
const creating = ref(false)

const activeProfile = computed(() => profileStore.activeProfile)

async function fetchData() {
  await Promise.all([
    profileStore.fetchProfiles(),
    profileStore.fetchOpSecStatus(),
  ])
}

async function createProfile() {
  if (!newProfile.value.name) return
  creating.value = true
  try {
    await profileStore.createProfile(newProfile.value)
    showCreateModal.value = false
    newProfile.value = {
      name: '',
      vpn_config: '',
      mac_spoof: false,
      hostname: '',
      timezone: '',
      dns: '',
      proxy: '',
    }
  } catch (e) {
    console.error('Create failed:', e)
  } finally {
    creating.value = false
  }
}

async function engageProfile(name: string) {
  try {
    await profileStore.engageProfile(name)
  } catch (e) {
    console.error('Engage failed:', e)
  }
}

async function disengageProfile() {
  try {
    await profileStore.disengageProfile()
  } catch (e) {
    console.error('Disengage failed:', e)
  }
}

async function deleteProfile(name: string) {
  if (!confirm(`Delete profile "${name}"?`)) return
  try {
    await profileStore.deleteProfile(name)
  } catch (e) {
    console.error('Delete failed:', e)
  }
}

onMounted(() => {
  fetchData()
})

const commonTimezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

const commonDNS = [
  '1.1.1.1, 1.0.0.1',        // Cloudflare
  '8.8.8.8, 8.8.4.4',        // Google
  '9.9.9.9, 149.112.112.112', // Quad9
  '208.67.222.222, 208.67.220.220', // OpenDNS
]
</script>

<template>
  <div class="profiles-view">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl">
      <div>
        <h1 class="text-3xl font-bold">OpSec Profiles</h1>
        <p class="text-muted mt-xs">Manage operational security profiles for engagements</p>
      </div>
      <button class="btn btn-primary" @click="showCreateModal = true">
        <Plus size="18" /> New Profile
      </button>
    </div>

    <!-- OpSec Status -->
    <Card class="mb-lg" v-if="profileStore.opsecStatus">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="card-title">Current OpSec Status</h3>
          <button class="btn btn-ghost btn-sm" @click="profileStore.fetchOpSecStatus" :disabled="profileStore.loading">
            <RotateCw size="16" :class="{ 'animate-spin': profileStore.loading }" />
          </button>
        </div>
      </template>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        <div class="p-sm rounded bg-bg-tertiary">
          <p class="text-xs text-muted">Hostname</p>
          <p class="font-mono text-sm">{{ profileStore.opsecStatus.hostname }}</p>
        </div>
        <div class="p-sm rounded bg-bg-tertiary">
          <p class="text-xs text-muted">Timezone</p>
          <p class="font-mono text-sm">{{ profileStore.opsecStatus.timezone }}</p>
        </div>
        <div class="p-sm rounded bg-bg-tertiary">
          <p class="text-xs text-muted">VPN</p>
          <p class="font-mono text-sm">{{ profileStore.opsecStatus.vpn }}</p>
        </div>
        <div class="p-sm rounded bg-bg-tertiary">
          <p class="text-xs text-muted">DNS</p>
          <p class="font-mono text-sm truncate">{{ profileStore.opsecStatus.dns }}</p>
        </div>
      </div>

      <div v-if="profileStore.opsecStatus.mac_addresses && Object.keys(profileStore.opsecStatus.mac_addresses).length > 0" class="mt-md">
        <p class="text-xs text-muted mb-sm">MAC Addresses</p>
        <div class="flex flex-wrap gap-sm">
          <span
            v-for="(mac, iface) in profileStore.opsecStatus.mac_addresses"
            :key="iface"
            class="badge badge-neutral font-mono text-xs"
          >
            {{ iface }}: {{ mac }}
          </span>
        </div>
      </div>

      <div v-if="profileStore.opsecStatus.http_proxy || profileStore.opsecStatus.https_proxy" class="mt-md">
        <p class="text-xs text-muted mb-sm">Proxy</p>
        <div class="flex flex-wrap gap-sm">
          <span v-if="profileStore.opsecStatus.http_proxy" class="badge badge-neutral font-mono text-xs">
            HTTP: {{ profileStore.opsecStatus.http_proxy }}
          </span>
          <span v-if="profileStore.opsecStatus.https_proxy" class="badge badge-neutral font-mono text-xs">
            HTTPS: {{ profileStore.opsecStatus.https_proxy }}
          </span>
        </div>
      </div>
    </Card>

    <!-- Active Profile Banner -->
    <div v-if="activeProfile" class="card border-primary mb-lg">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-md">
          <div class="w-12 h-12 rounded-lg bg-primary-bg flex items-center justify-center">
            <Shield class="text-primary" size="24" />
          </div>
          <div>
            <h3 class="font-semibold">Active Profile: {{ activeProfile.name }}</h3>
            <p class="text-sm text-muted">Operational security controls are engaged</p>
          </div>
        </div>
        <button class="btn btn-danger" @click="disengageProfile" :disabled="profileStore.loading">
          <X size="16" /> Disengage
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mt-md pt-md border-t border-border-light">
        <div v-if="activeProfile.vpn_config" class="flex items-center gap-sm text-sm">
          <Wifi class="text-muted" size="16" />
          <span>VPN: {{ activeProfile.vpn_config }}</span>
        </div>
        <div v-if="activeProfile.mac_spoof" class="flex items-center gap-sm text-sm">
          <Shield class="text-muted" size="16" />
          <span>MAC Spoofing: Enabled</span>
        </div>
        <div v-if="activeProfile.hostname" class="flex items-center gap-sm text-sm">
          <Globe class="text-muted" size="16" />
          <span>Hostname: {{ activeProfile.hostname }}</span>
        </div>
        <div v-if="activeProfile.timezone" class="flex items-center gap-sm text-sm">
          <Clock class="text-muted" size="16" />
          <span>Timezone: {{ activeProfile.timezone }}</span>
        </div>
        <div v-if="activeProfile.dns" class="flex items-center gap-sm text-sm sm:col-span-2">
          <Wifi class="text-muted" size="16" />
          <span>DNS: {{ activeProfile.dns }}</span>
        </div>
        <div v-if="activeProfile.proxy" class="flex items-center gap-sm text-sm sm:col-span-2">
          <Wrench class="text-muted" size="16" />
          <span>Proxy: {{ activeProfile.proxy }}</span>
        </div>
      </div>
    </div>

    <!-- Profiles List -->
    <div v-if="profileStore.loading" class="flex items-center justify-center py-2xl">
      <div class="animate-spin rounded-full border-4 border-primary border-t-transparent w-8 h-8" />
    </div>

    <div v-else-if="profileStore.profiles.length === 0" class="card text-center py-2xl">
      <Shield size="48" class="text-muted mx-auto mb-md" />
      <h3 class="text-lg font-medium mb-sm">No profiles configured</h3>
      <p class="text-muted mb-md">Create a profile to manage OpSec settings for your engagements</p>
      <button class="btn btn-primary" @click="showCreateModal = true">
        <Plus size="16" /> Create Profile
      </button>
    </div>

    <div v-else class="space-y-md">
      <Card
        v-for="profile in profileStore.profiles"
        :key="profile.name"
        class="hoverable"
        :class="profile.active && 'border-primary'"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-md flex-1">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="profile.active ? 'bg-primary-bg text-primary' : 'bg-bg-tertiary text-muted'">
              <Shield size="20" />
            </div>
            <div>
              <div class="flex items-center gap-sm">
                <h3 class="font-semibold">{{ profile.name }}</h3>
                <span v-if="profile.active" class="badge badge-success">
                  <CheckCircle size="12" /> Active
                </span>
              </div>
              <p class="text-sm text-muted mt-1">
                {{ profile.vpn_config ? 'VPN: ' + profile.vpn_config : 'No VPN' }}
                {{ profile.mac_spoof ? ' • MAC Spoofing' : '' }}
                {{ profile.hostname ? ' • Hostname: ' + profile.hostname : '' }}
                {{ profile.timezone ? ' • TZ: ' + profile.timezone : '' }}
                {{ profile.dns ? ' • DNS: ' + profile.dns : '' }}
                {{ profile.proxy ? ' • Proxy: ' + profile.proxy : '' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-sm">
            <button
              v-if="!profile.active"
              class="btn btn-primary btn-sm"
              @click="engageProfile(profile.name)"
              :disabled="profileStore.loading"
            >
              <Play size="16" /> Engage
            </button>
            <button
              v-else
              class="btn btn-danger btn-sm"
              @click="disengageProfile"
              :disabled="profileStore.loading"
            >
              <X size="16" /> Disengage
            </button>
            <button class="btn btn-ghost btn-sm" @click="deleteProfile(profile.name)" :disabled="profile.active || profileStore.loading">
              <Trash2 size="16" />
            </button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Create Profile Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h3 class="modal-title">Create OpSec Profile</h3>
          <button class="modal-close" @click="showCreateModal = false">
            <X size="20" />
          </button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="createProfile" class="space-y-md">
            <div>
              <label for="profile-name" class="block text-sm font-medium mb-sm">Profile Name *</label>
              <input
                id="profile-name"
                v-model="newProfile.name"
                type="text"
                class="input"
                placeholder="engagement-1"
                required
              />
            </div>

            <div>
              <label for="vpn-config" class="block text-sm font-medium mb-sm">VPN Config</label>
              <input
                id="vpn-config"
                v-model="newProfile.vpn_config"
                type="text"
                class="input"
                placeholder="/path/to/config.ovpn or .conf"
              />
              <p class="text-xs text-muted mt-1">WireGuard (.conf) or OpenVPN (.ovpn) config file</p>
            </div>

            <div>
              <label class="flex items-center gap-sm cursor-pointer">
                <input type="checkbox" v-model="newProfile.mac_spoof" class="w-4 h-4" />
                <span class="font-medium">Enable MAC Address Spoofing</span>
              </label>
              <p class="text-xs text-muted mt-1 ml-6">Randomize MAC addresses on active interfaces</p>
            </div>

            <div>
              <label for="hostname" class="block text-sm font-medium mb-sm">Custom Hostname</label>
              <input
                id="hostname"
                v-model="newProfile.hostname"
                type="text"
                class="input"
                placeholder="secwin-engagement-01"
              />
              <p class="text-xs text-muted mt-1">Requires system restart to take effect</p>
            </div>

            <div>
              <label for="timezone" class="block text-sm font-medium mb-sm">Timezone</label>
              <select
                id="timezone"
                v-model="newProfile.timezone"
                class="input select"
              >
                <option value="">Select timezone</option>
                <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
              </select>
            </div>

            <div>
              <label for="dns" class="block text-sm font-medium mb-sm">DNS Servers</label>
              <select
                id="dns"
                v-model="newProfile.dns"
                class="input select"
              >
                <option value="">Select DNS provider</option>
                <option v-for="dns in commonDNS" :key="dns" :value="dns">{{ dns }}</option>
                <option value="custom">Custom...</option>
              </select>
              <input
                v-if="newProfile.dns === 'custom'"
                v-model="newProfile.dns"
                type="text"
                class="input mt-sm"
                placeholder="1.1.1.1, 8.8.8.8"
              />
            </div>

            <div>
              <label for="proxy" class="block text-sm font-medium mb-sm">Proxy URL</label>
              <input
                id="proxy"
                v-model="newProfile.proxy"
                type="text"
                class="input"
                placeholder="http://proxy:8080"
              />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateModal = false">Cancel</button>
          <button class="btn btn-primary" @click="createProfile" :disabled="creating || !newProfile.name">
            <RotateCw v-if="creating" class="animate-spin" size="16" />
            <Plus v-else size="16" /> Create Profile
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profiles-view {
  animation: fadeIn 0.3s ease;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.border-primary {
  border-color: var(--color-brand-accent);
}

.primary-bg {
  background: var(--color-brand-primary);
}
</style>