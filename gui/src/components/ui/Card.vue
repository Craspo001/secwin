<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  hoverable?: boolean
  padded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hoverable: false,
  padded: true,
})

const slots = defineSlots<{
  header: () => any
  default: () => any
  footer: () => any
}>()
</script>

<template>
  <div class="card" :class="{ 'card-hoverable': props.hoverable }" :style="{ padding: props.padded ? 'var(--space-lg)' : '0' }">
    <div v-if="slots.header || props.title" class="card-header">
      <div v-if="slots.header">
        <slot name="header" />
      </div>
      <div v-else class="flex items-start justify-between">
        <div>
          <h3 v-if="props.title" class="card-title">{{ props.title }}</h3>
          <p v-if="props.subtitle" class="card-subtitle">{{ props.subtitle }}</p>
        </div>
      </div>
    </div>

    <div class="card-body">
      <slot />
    </div>

    <div v-if="slots.footer" class="card-footer border-t border-border-light mt-lg pt-lg">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.card-hoverable {
  transition: box-shadow var(--transition-base), border-color var(--transition-base), transform var(--transition-fast);
}

.card-hoverable:hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--color-brand-accent);
  transform: translateY(-2px);
}

.card-header {
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
}

.card-body {
  min-height: 1px;
}

.card-footer {
  margin-top: var(--space-lg);
  padding-top: var(--space-lg);
}
</style>