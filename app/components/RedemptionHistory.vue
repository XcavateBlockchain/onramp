<script setup lang="ts">
import { ChevronRight, History } from 'lucide-vue-next'
import type { RedemptionDto } from '#shared/types'

defineProps<{ redemptions: RedemptionDto[] }>()

const route = useRoute()

function formatAmount(redemption: RedemptionDto) {
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(redemption.amount.value)
  return `${formatted} tGBP`
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
</script>

<template>
  <section v-if="redemptions.length" class="history">
    <h2 class="history__title">
      <History :size="16" />
      Recent redemptions
    </h2>
    <div class="card history__card">
      <NuxtLink
        v-for="redemption in redemptions"
        :key="redemption.id"
        class="history__row"
        :to="{ path: `/redemption/${redemption.id}`, query: route.query }"
      >
        <div class="history__main">
          <span class="history__amount">{{ formatAmount(redemption) }}</span>
          <span class="history__date">{{ formatDate(redemption.createdAt) }}</span>
        </div>
        <div class="history__side">
          <StatusPill :status="redemption.status" />
          <ChevronRight :size="16" class="history__chevron" />
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.history {
  margin-top: 24px;
}

.history__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--text-subdued);
}

.history__card {
  padding: 6px 16px;
}

.history__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 -8px;
  padding: 10px 8px;
  border-radius: var(--radius-card);
  color: inherit;
  text-decoration: none;
}

.history__row:hover {
  background: var(--card-tint);
}

.history__row:active {
  background: var(--blue-tint);
}

.history__row + .history__row {
  border-top: 1px solid var(--x-gray);
}

.history__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history__side {
  display: flex;
  align-items: center;
  gap: 6px;
}

.history__chevron {
  color: var(--text-faint);
}

.history__amount {
  font-weight: 700;
}

.history__date {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
