import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<'light' | 'dark' | 'system'>('system')
  const sidebarCollapsed = ref(false)
  const sidebarOpen = ref(false)

  function init() {
    const saved = localStorage.getItem('secwin-theme') as 'light' | 'dark' | 'system' | null
    if (saved) {
      theme.value = saved
    }
    applyTheme()

    const savedSidebar = localStorage.getItem('secwin-sidebar-collapsed')
    if (savedSidebar) {
      sidebarCollapsed.value = savedSidebar === 'true'
    }
  }

  function setTheme(newTheme: 'light' | 'dark' | 'system') {
    theme.value = newTheme
    localStorage.setItem('secwin-theme', newTheme)
    applyTheme()
  }

  function toggleTheme() {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme.value)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  function applyTheme() {
    const root = document.documentElement
    if (theme.value === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme.value)
    }
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('secwin-sidebar-collapsed', sidebarCollapsed.value.toString())
  }

  function openSidebar() {
    sidebarOpen.value = true
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  // Watch for system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (theme.value === 'system') {
        applyTheme()
      }
    })
  }

  return {
    theme,
    sidebarCollapsed,
    sidebarOpen,
    init,
    setTheme,
    toggleTheme,
    toggleSidebar,
    openSidebar,
    closeSidebar,
  }
})