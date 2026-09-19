<script setup lang="ts">
const model = defineModel<string>({ required: true })

const props = defineProps<{ disabled?: boolean }>()

const emit = defineEmits<{ (e: 'submit'): void }>()

const quickAmounts = [50, 100, 250, 500]

const error = computed(() => {
  const raw = model.value.trim()
  if (!raw) return null
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return 'Enter a valid amount (max 2 decimals).'
  const value = Number(raw)
  if (value < 5) return 'Minimum amount is £5.00.'
  if (value > 1_000_000) return 'Amount is too large.'
  return null
})

const valid = computed(() => model.value.trim() !== '' && !error.value)

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  // keep only digits and a single dot
  const cleaned = el.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
  model.value = cleaned
  el.value = cleaned
}

function pick(amount: number) {
  model.value = String(amount)
  emit('submit')
}

defineExpose({ valid, error })
</script>

<template>
  <div>
    <div class="amount" :class="{ 'amount--invalid': error }">
      <span class="amount__currency">£</span>
      <input
        class="amount__input"
        :value="model"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        aria-label="Amount in GBP"
        :disabled="disabled"
        @input="onInput"
        @keyup.enter="valid && emit('submit')"
      />
      <span class="amount__suffix">GBP</span>
    </div>
    <p v-if="error" class="amount__error">{{ error }}</p>

    <div class="amount__quick">
      <button
        v-for="q in quickAmounts"
        :key="q"
        type="button"
        class="amount__chip"
        :disabled="disabled"
        @click="pick(q)"
      >
        £{{ q }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.amount {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--card-bg);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 0 16px;
  height: 64px;
}

.amount--invalid {
  outline: 2px solid var(--x-pink);
}

.amount__currency {
  font-size: 24px;
  font-weight: 900;
  color: var(--x-blue);
}

.amount__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
}

.amount__input::placeholder {
  color: var(--gray-200);
}

.amount__suffix {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}

.amount__error {
  margin: 6px 10px 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--x-pink);
}

.amount__quick {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.amount__chip {
  flex: 1;
  height: 36px;
  border: 2px solid var(--x-blue);
  border-radius: var(--radius-button);
  background: #fff;
  color: var(--x-blue);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.amount__chip:active {
  background: var(--blue-tint);
}
</style>
