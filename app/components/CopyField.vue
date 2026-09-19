<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next'

const props = defineProps<{
  label: string
  value: string
  emphasized?: boolean
}>()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.value)
    } else {
      // Fallback for webviews without the async clipboard API
      const el = document.createElement('textarea')
      el.value = props.value
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1600)
  } catch {
    // clipboard blocked — leave the value selectable
  }
}

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div class="copy-field" :class="{ 'copy-field--emphasized': emphasized }">
    <div class="copy-field__text">
      <span class="copy-field__label">{{ label }}</span>
      <span class="copy-field__value">{{ value }}</span>
    </div>
    <button
      type="button"
      class="copy-field__btn"
      :aria-label="`Copy ${label}`"
      @click="copy"
    >
      <Check v-if="copied" :size="16" color="#357461" />
      <Copy v-else :size="16" />
    </button>
  </div>
</template>

<style scoped>
.copy-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
}

.copy-field + .copy-field {
  border-top: 1px solid var(--x-gray);
}

.copy-field__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.copy-field__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.copy-field__value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  overflow-wrap: anywhere;
}

.copy-field--emphasized .copy-field__value {
  color: var(--x-blue);
  font-size: 16px;
}

.copy-field__btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  border: 0;
  border-radius: 50%;
  background: rgba(78, 78, 78, 0.1);
  color: var(--x-blue);
  cursor: pointer;
}
</style>
