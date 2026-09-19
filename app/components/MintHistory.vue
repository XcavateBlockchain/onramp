<script setup lang="ts">
import { History } from 'lucide-vue-next'
import type { MintDto } from '#shared/types'

defineProps<{ mints: MintDto[] }>()

function formatAmount(mint: MintDto) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: mint.amount.currency || 'GBP',
  }).format(mint.amount.value)
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
  <section v-if="mints.length" class="history">
    <h2 class="history__title">
      <History :size="16" />
      Recent mints
    </h2>
    <div class="card history__card">
      <div v-for="mint in mints" :key="mint.id" class="history__row">
        <div class="history__main">
          <span class="history__amount">{{ formatAmount(mint) }}</span>
          <span class="history__date">{{ formatDate(mint.createdAt) }}</span>
        </div>
        <StatusPill :status="mint.status" />
      </div>
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
  padding: 10px 0;
}

.history__row + .history__row {
  border-top: 1px solid var(--x-gray);
}

.history__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history__amount {
  font-weight: 700;
}

.history__date {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
