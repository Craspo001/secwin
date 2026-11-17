<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { useSystemStore } from '@/stores/system'
import { Menu, Sun, Moon, Monitor, Bell, User, ChevronDown, CheckCircle, AlertCircle, Info } from 'lucide-vue-next'
import { ref, computed } from 'vue'

const themeStore = useThemeStore()
const systemStore = useSystemStore()

const showUserMenu = ref(false)
const showNotifications = ref(false)

const themeIcon = computed(() => {
  if (themeStore.theme === 'dark') return Moon
  if (themeStore.theme === 'light') return Sun
  return Monitor
})

const secwinStatus = computed(() => {
  if (systemStore.isSecwinInstalled) return { icon: CheckCircle, color: 'text-success', label: 'SecWin Ready' }
  return { icon: AlertCircle, color: 'text-danger', label: 'SecWin Not Found' }
})

const wslStatus = computed(() => {
  if (systemStore.isWSLAvailable) return { icon: CheckCircle, color: 'text-success', label: 'WSL Available' }
  return { icon: Info, color: 'text-warning', label: 'WSL Not Available' }
})

const ollamaStatus = computed(() => {
  if (systemStore.isOllamaAvailable) return { icon: CheckCircle, color: 'text-success', label: 'Ollama Running' }
  return { icon: Info, color: 'text-muted', label: 'Ollama Not Running' }
})
</script>

<template>
  <header class="top-bar">
    <!-- Left Side -->
    <div class="flex items-center gap-md">
      <button
        class="mobile-menu-btn btn-ghost btn-sm"
        @click="themeStore.openSidebar"
        aria-label="Open menu"
      >
        <Menu size="20" />
      </button>

      <div class="flex items-center gap-sm hidden sm:flex" style="border-left: 1px solid var(--color-border-light); padding-left: var(--space-md);">
        <component :is="secwinStatus.icon" :class="secwinStatus.color" size="16" />
        <span class="text-sm text-muted">{{ secwinStatus.label }}</span>

        <div class="divider-vertical hidden sm:block" />

        <component :is="wslStatus.icon" :class="wslStatus.color" size="16" />
        <span class="text-sm text-muted">{{ wslStatus.label }}</span>

        <div class="divider-vertical hidden sm:block" />

        <component :is="ollamaStatus.icon" :class="ollamaStatus.color" size="16" />
        <span class="text-sm text-muted">{{ ollamaStatus.label }}</span>
      </div>
    </div>

    <!-- Right Side -->
    <div class="flex items-center gap-sm">
      <!-- Theme Toggle -->
      <button
        class="btn-ghost btn-sm relative"
        @click="themeStore.toggleTheme"
        :aria-label="`Current theme: ${themeStore.theme}. Click to cycle.`"
      >
        <component :is="themeIcon" size="18" />
        <span class="tooltip" :data-tooltip="`Theme: ${themeStore.theme}`"></span>
      </button>

      <!-- Notifications -->
      <button class="btn-ghost btn-sm relative" @click="showNotifications = !showNotifications">
        <Bell size="18" />
        <span class="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full text-[10px] flex items-center justify-center text-white">
          3
        </span>
      </button>

      <!-- User Menu -->
      <div class="relative">
        <button
          class="btn-ghost btn-sm flex items-center gap-sm"
          @click="showUserMenu = !showUserMenu"
        >
          <div class="avatar avatar-sm" style="background: var(--color-brand-accent);">
            {{ systemStore.systemInfo?.username?.charAt(0)?.toUpperCase() || 'U' }}
          </div>
          <span class="hidden sm:block text-sm font-medium">{{ systemStore.systemInfo?.username || 'User' }}</span>
          <ChevronDown size="16" class="hidden sm:block" />
        </button>

        <div
          v-if="showUserMenu"
          class="absolute right-0 top-full mt-2 w-48 card shadow-lg py-sm z-50"
          role="menu"
        >
          <div class="px-md py-sm border-b border-border-light">
            <p class="text-sm font-medium">{{ systemStore.systemInfo?.username }}</p>
            <p class="text-xs text-muted">{{ systemStore.systemInfo?.hostname }}</p>
          </div>
          <router-link to="/settings" class="nav-item block px-md" @click="showUserMenu = false">
            <Settings size="18" />
            <span>Settings</span>
          </router-link>
          <hr class="divider my-xs" />
          <button class="nav-item block w-full text-left px-md text-danger" @click="logout">
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
export default {
  methods: {
    logout() {
      // TODO: Implement logout
    },
  },
}
</script>

<style scoped>
.top-bar {
  backdrop-filter: blur(8px);
  background: rgba(var(--color-bg-secondary), 0.9);
}

.mobile-menu-btn {
  display: none;
}

@media (max-width: 1024px) {
  .mobile-menu-btn {
    display: flex;
  }
}
</style>