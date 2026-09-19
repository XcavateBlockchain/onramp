<script setup lang="ts">
import { CircleCheck, CircleX, Clock, Ban } from 'lucide-vue-next'
import type { MintStatus } from '#shared/types'

const props = defineProps<{ status: MintStatus }>()

const map = {
  pending: { label: 'Pending', cls: 'pill--blue', icon: Clock },
  confirmed: { label: 'Confirmed', cls: 'pill--green', icon: CircleCheck },
  failed: { label: 'Failed', cls: 'pill--pink', icon: CircleX },
  cancelled: { label: 'Cancelled', cls: 'pill--gold', icon: Ban },
} as const

const entry = computed(() => map[props.status] ?? map.pending)
</script>

<template>
  <span class="pill" :class="entry.cls">
    <component :is="entry.icon" :size="12" />
    {{ entry.label }}
  </span>
</template>
