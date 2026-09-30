<script setup lang="ts">
import { Check } from 'lucide-vue-next'

defineProps<{ current: number }>()

const steps = ['Amount', 'Bank account', 'Review']
</script>

<template>
  <div class="steps" aria-hidden="true">
    <template v-for="(label, i) in steps" :key="label">
      <div
        class="steps__item"
        :class="{
          'steps__item--active': i + 1 === current,
          'steps__item--done': i + 1 < current,
        }"
      >
        <span class="steps__dot">
          <Check v-if="i + 1 < current" :size="12" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="steps__label">{{ label }}</span>
      </div>
      <span
        v-if="i < steps.length - 1"
        class="steps__line"
        :class="{ 'steps__line--done': i + 1 < current }"
      />
    </template>
  </div>
</template>

<style scoped>
.steps {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.steps__item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.steps__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--x-gray);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.steps__item--active .steps__dot {
  background: var(--x-blue);
  color: #fff;
}

.steps__item--done .steps__dot {
  background: var(--blue-tint);
  color: var(--x-blue);
}

.steps__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  white-space: nowrap;
}

.steps__item--active .steps__label {
  color: var(--x-blue);
}

.steps__line {
  flex: 1;
  height: 2px;
  margin: 0 8px;
  border-radius: 1px;
  background: var(--x-gray);
}

.steps__line--done {
  background: var(--x-blue);
}
</style>
