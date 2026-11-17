import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface ProfileInfo {
  name: string
  vpn_config: string | null
  mac_spoof: boolean
  hostname: string | null
  timezone: string | null
  dns: string | null
  proxy: string | null
  active: boolean
}

export interface OpSecStatus {
  mac_addresses: Record<string, string>
  hostname: string
  timezone: string
  vpn: string
  http_proxy: string | null
  https_proxy: string | null
  dns: string
}

export const useProfileStore = defineStore('profile', () => {
  const profiles = ref<ProfileInfo[]>([])
  const opsecStatus = ref<OpSecStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeProfile = computed(() => profiles.value.find((p) => p.active) || null)

  async function fetchProfiles() {
    loading.value = true
    error.value = null
    try {
      const list = await invoke<ProfileInfo[]>('list_profiles')
      profiles.value = list
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch profiles'
      console.error('Failed to fetch profiles:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchOpSecStatus() {
    try {
      const status = await invoke<OpSecStatus>('get_opsec_status')
      opsecStatus.value = status
    } catch (e) {
      console.error('Failed to fetch OpSec status:', e)
    }
  }

  async function engageProfile(name: string) {
    loading.value = true
    error.value = null
    try {
      await invoke('engage_profile', { name })
      await fetchProfiles()
      await fetchOpSecStatus()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to engage profile'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function disengageProfile() {
    loading.value = true
    error.value = null
    try {
      await invoke('disengage_profile')
      await fetchProfiles()
      await fetchOpSecStatus()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to disengage profile'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createProfile(data: Partial<ProfileInfo> & { name: string }) {
    loading.value = true
    error.value = null
    try {
      const args = ['profile', 'create', data.name]
      if (data.vpn_config) args.push('--vpn', data.vpn_config)
      if (data.mac_spoof) args.push('--mac-spoof')
      if (data.hostname) args.push('--hostname', data.hostname)
      if (data.timezone) args.push('--timezone', data.timezone)
      if (data.dns) args.push('--dns', data.dns)
      if (data.proxy) args.push('--proxy', data.proxy)

      await invoke('run_secwin_command', { args })
      await fetchProfiles()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create profile'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteProfile(name: string) {
    loading.value = true
    error.value = null
    try {
      await invoke('run_secwin_command', { args: ['profile', 'delete', name] })
      await fetchProfiles()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete profile'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    profiles,
    opsecStatus,
    activeProfile,
    loading,
    error,
    fetchProfiles,
    fetchOpSecStatus,
    engageProfile,
    disengageProfile,
    createProfile,
    deleteProfile,
  }
})