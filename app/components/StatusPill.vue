<script setup lang="ts">
import { CircleCheck, CircleX, Clock, Ban } from 'lucide-vue-next'
import type { MintStatus, RedemptionStatus } from '#shared/types'

const props = defineProps<{ status: MintStatus | RedemptionStatus }>()

const map = {
  pending: { label: 'Pending', cls: 'pill--blue', icon: Clock },
  paid: { label: 'Paid', cls: 'pill--blue', icon: CircleCheck },
  confirmed: { label: 'Confirmed', cls: 'pill--green', icon: CircleCheck },
  failed: { label: 'Failed', cls: 'pill--pink', icon: CircleX },
  cancelled: { label: 'Cancelled', cls: 'pill--gold', icon: Ban },
  pending_compliance_review: { label: 'In review', cls: 'pill--gold', icon: Clock },
  complete: { label: 'Complete', cls: 'pill--green', icon: CircleCheck },
  payout_skipped: { label: 'Payout skipped', cls: 'pill--gold', icon: Ban },
} as const

const entry = computed(
  () => map[props.status as keyof typeof map] ?? map.pending,
)
</script>

<template>
  <span class="pill" :class="entry.cls">
    <component :is="entry.icon" :size="12" />
    {{ entry.label }}
  </span>
</template>
