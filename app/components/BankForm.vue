<script setup lang="ts">
import { ArrowLeft, Landmark, LoaderCircle } from 'lucide-vue-next'
import type { BankFormDetails } from '~/composables/useRedemption'

const props = defineProps<{ busy?: boolean }>()

const emit = defineEmits<{
  (e: 'save', details: BankFormDetails): void
  (e: 'cancel'): void
}>()

const accountHolderName = ref('')
const bankName = ref('')
const sortCode = ref('')
const accountNumber = ref('')
const nickname = ref('')
const touched = ref(false)

const errors = computed(() => {
  const errs: Record<string, string> = {}
  if (!accountHolderName.value.trim())
    errs.accountHolderName = 'Enter the account holder name.'
  if (!bankName.value.trim()) errs.bankName = 'Enter the bank name.'
  if (!/^\d{2}-?\d{2}-?\d{2}$/.test(sortCode.value.trim()))
    errs.sortCode = 'Sort code must be 6 digits.'
  if (!/^\d{8}$/.test(accountNumber.value.trim()))
    errs.accountNumber = 'Account number must be exactly 8 digits.'
  return errs
})

const valid = computed(() => Object.keys(errors.value).length === 0)

function fieldError(name: string) {
  return touched.value ? (errors.value[name] ?? null) : null
}

function onSortCodeInput(e: Event) {
  const el = e.target as HTMLInputElement
  const cleaned = el.value.replace(/[^\d-]/g, '').slice(0, 8)
  sortCode.value = cleaned
  el.value = cleaned
}

function onAccountNumberInput(e: Event) {
  const el = e.target as HTMLInputElement
  const cleaned = el.value.replace(/\D/g, '').slice(0, 8)
  accountNumber.value = cleaned
  el.value = cleaned
}

function submit() {
  touched.value = true
  if (!valid.value || props.busy) return
  emit('save', {
    accountHolderName: accountHolderName.value.trim(),
    bankName: bankName.value.trim(),
    sortCode: sortCode.value.trim(),
    accountNumber: accountNumber.value.trim(),
    nickname: nickname.value.trim(),
  })
}
</script>

<template>
  <div class="card bank-form">
    <label class="field">
      <span class="field__label">Account holder name</span>
      <input
        v-model="accountHolderName"
        class="field__input"
        type="text"
        autocomplete="name"
        placeholder="Jane Smith"
        :disabled="busy"
      />
      <span v-if="fieldError('accountHolderName')" class="field__error">
        {{ fieldError('accountHolderName') }}
      </span>
    </label>

    <label class="field">
      <span class="field__label">Bank name</span>
      <input
        v-model="bankName"
        class="field__input"
        type="text"
        autocomplete="off"
        placeholder="HSBC Bank"
        :disabled="busy"
      />
      <span v-if="fieldError('bankName')" class="field__error">
        {{ fieldError('bankName') }}
      </span>
    </label>

    <div class="field-row">
      <label class="field">
        <span class="field__label">Sort code</span>
        <input
          :value="sortCode"
          class="field__input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="12-34-56"
          :disabled="busy"
          @input="onSortCodeInput"
        />
        <span v-if="fieldError('sortCode')" class="field__error">
          {{ fieldError('sortCode') }}
        </span>
      </label>

      <label class="field">
        <span class="field__label">Account number</span>
        <input
          :value="accountNumber"
          class="field__input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="12345678"
          :disabled="busy"
          @input="onAccountNumberInput"
        />
        <span v-if="fieldError('accountNumber')" class="field__error">
          {{ fieldError('accountNumber') }}
        </span>
      </label>
    </div>

    <label class="field">
      <span class="field__label">Nickname (optional)</span>
      <input
        v-model="nickname"
        class="field__input"
        type="text"
        autocomplete="off"
        placeholder="Personal account"
        :disabled="busy"
      />
    </label>
  </div>

  <button
    type="button"
    class="btn btn--primary page__cta"
    :disabled="busy"
    @click="submit"
  >
    <LoaderCircle v-if="busy" :size="16" class="spin" />
    <Landmark v-else :size="16" />
    {{ busy ? 'Saving account…' : 'Save bank account' }}
  </button>
  <button
    type="button"
    class="btn btn--ghost"
    :disabled="busy"
    @click="emit('cancel')"
  >
    <ArrowLeft :size="16" />
    Back
  </button>
</template>

<style scoped>
.bank-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-row {
  display: flex;
  gap: 12px;
}

.field-row .field {
  flex: 1;
}

.field__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.field__input {
  height: 44px;
  border: 0;
  border-radius: var(--radius-card);
  background: var(--card-tint);
  padding: 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  outline: none;
}

.field__input:focus {
  outline: 2px solid var(--x-blue);
}

.field__input::placeholder {
  color: var(--gray-200);
  font-weight: 400;
}

.field__error {
  font-size: 12px;
  font-weight: 700;
  color: var(--x-pink);
}

.page__cta {
  margin-top: 20px;
}

.page__cta + .btn--ghost {
  margin-top: 10px;
}
</style>
