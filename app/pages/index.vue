<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from 'lucide-vue-next'

const {
  step,
  errorMessage,
  customer,
  amount,
  mint,
  history,
  busy,
  wallet,
  isDevnet,
  resolve,
  review,
  backToForm,
  createMint,
  refreshMint,
  cancelMint,
  reset,
  explorerUrl,
  shortAddress,
} = useOnramp()

const amountInput = ref<{ valid: boolean } | null>(null)

onMounted(resolve)

const formattedAmount = computed(() => {
  const value = Number(amount.value)
  if (!Number.isFinite(value)) return amount.value
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value)
})

const mintedAmount = computed(() => {
  if (!mint.value) return ''
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: mint.value.amount.currency || 'GBP',
  }).format(mint.value.amount.value)
})

const bankDetails = computed(() => mint.value?.bankTransferDetails ?? null)

const greeting = computed(() => {
  const name = customer.value?.firstName || customer.value?.name
  return name ? `Hi ${name}` : 'Welcome'
})

const blockedContent = computed(() => {
  switch (customer.value?.status) {
    case 'pending':
      return {
        title: 'Verification in progress',
        body: 'Your identity is still being verified. This usually takes a few minutes — come back once it completes.',
      }
    case 'rejected':
      return {
        title: 'Verification unsuccessful',
        body:
          customer.value.rejectionReason ??
          'Your verification was not approved. Please contact support if you believe this is a mistake.',
      }
    default:
      return {
        title: 'Account unavailable',
        body: 'This account cannot mint tGBP at the moment. Please contact support.',
      }
  }
})
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="page__main">
      <Transition name="step" mode="out-in">
        <!-- Loading -------------------------------------------------- -->
        <section v-if="step === 'loading'" key="loading" class="center">
          <LoaderCircle :size="40" class="spin" color="#3B4F74" />
          <p class="muted">Preparing your mint…</p>
        </section>

        <!-- Error ---------------------------------------------------- -->
        <section v-else-if="step === 'error'" key="error" class="center">
          <div class="icon-badge icon-badge--pink">
            <TriangleAlert :size="22" />
          </div>
          <h1 class="page__heading">Something went wrong</h1>
          <p class="subdued center__text">{{ errorMessage }}</p>
          <button type="button" class="btn btn--primary" @click="resolve">
            <RefreshCw :size="16" />
            Try again
          </button>
        </section>

        <!-- Blocked (not verified) ------------------------------------ -->
        <section v-else-if="step === 'blocked'" key="blocked" class="center">
          <div class="icon-badge" :class="customer?.status === 'pending' ? 'icon-badge--blue' : 'icon-badge--pink'">
            <Clock v-if="customer?.status === 'pending'" :size="22" />
            <ShieldCheck v-else :size="22" />
          </div>
          <h1 class="page__heading">{{ blockedContent.title }}</h1>
          <p class="subdued center__text">{{ blockedContent.body }}</p>
          <button type="button" class="btn btn--ghost" @click="resolve">
            <RefreshCw :size="16" />
            Check again
          </button>
        </section>

        <!-- Amount form ----------------------------------------------- -->
        <section v-else-if="step === 'form'" key="form">
          <h1 class="page__heading">{{ greeting }}</h1>
          <p class="subdued page__lede">
            How much tGBP would you like to mint? You pay in GBP by bank
            transfer — 1 tGBP always equals £1.
          </p>

          <AmountInput
            ref="amountInput"
            v-model="amount"
            @submit="review"
          />

          <button
            type="button"
            class="btn btn--primary page__cta"
            :disabled="!amountInput?.valid"
            @click="review"
          >
            Continue
            <ArrowRight :size="16" />
          </button>

          <div class="card card--tint destination">
            <Wallet :size="16" color="#3B4F74" />
            <div>
              <p class="destination__label">Destination wallet</p>
              <p class="destination__value">
                {{ shortAddress(wallet) }}
                <span class="muted">· Solana {{ isDevnet ? 'Devnet' : 'Mainnet' }}</span>
              </p>
            </div>
          </div>

          <MintHistory :mints="history" />
        </section>

        <!-- Review ----------------------------------------------------- -->
        <section v-else-if="step === 'review'" key="review">
          <h1 class="page__heading">Review your mint</h1>
          <p class="subdued page__lede">Check the details before continuing.</p>

          <div class="card summary">
            <div class="summary__row">
              <span class="summary__label">You pay</span>
              <span class="summary__value">{{ formattedAmount }}</span>
            </div>
            <div class="summary__row">
              <span class="summary__label">You receive</span>
              <span class="summary__value summary__value--blue">
                {{ formattedAmount.replace('£', '') }} tGBP
              </span>
            </div>
            <div class="summary__row">
              <span class="summary__label">Rate</span>
              <span class="summary__value">1 tGBP = £1</span>
            </div>
            <div class="summary__row">
              <span class="summary__label">Network</span>
              <span class="summary__value">
                Solana {{ isDevnet ? 'Devnet' : 'Mainnet' }}
              </span>
            </div>
            <div class="summary__row">
              <span class="summary__label">Destination</span>
              <span class="summary__value">{{ shortAddress(wallet) }}</span>
            </div>
          </div>

          <p v-if="errorMessage" class="page__error">{{ errorMessage }}</p>

          <button
            type="button"
            class="btn btn--primary page__cta"
            :disabled="busy"
            @click="createMint"
          >
            <LoaderCircle v-if="busy" :size="16" class="spin" />
            <Banknote v-else :size="16" />
            {{ busy ? 'Creating mint…' : 'Get payment details' }}
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            :disabled="busy"
            @click="backToForm"
          >
            <ArrowLeft :size="16" />
            Back
          </button>
        </section>

        <!-- Payment instructions + status ------------------------------ -->
        <section v-else-if="step === 'pay' && mint" key="pay">
          <!-- Terminal states -->
          <div v-if="mint.status === 'confirmed'" class="center">
            <div class="icon-badge icon-badge--green">
              <CircleCheck :size="22" />
            </div>
            <h1 class="page__heading">tGBP on its way</h1>
            <p class="subdued center__text">
              {{ mintedAmount.replace('£', '') }} tGBP was minted to
              {{ shortAddress(mint.address) }}.
            </p>
            <a
              v-if="mint.txHash"
              class="explorer"
              :href="explorerUrl(mint.txHash)"
              target="_blank"
              rel="noopener"
            >
              View on Solscan
              <ExternalLink :size="14" />
            </a>
            <button type="button" class="btn btn--primary" @click="reset">
              Mint more
            </button>
          </div>

          <div v-else-if="mint.status === 'failed'" class="center">
            <div class="icon-badge icon-badge--pink">
              <CircleX :size="22" />
            </div>
            <h1 class="page__heading">Mint failed</h1>
            <p class="subdued center__text">
              {{ mint.failureReason || 'The mint could not be completed.' }}
            </p>
            <button type="button" class="btn btn--primary" @click="reset">
              <RefreshCw :size="16" />
              Try again
            </button>
          </div>

          <div v-else-if="mint.status === 'cancelled'" class="center">
            <div class="icon-badge icon-badge--gold">
              <CircleX :size="22" />
            </div>
            <h1 class="page__heading">Mint cancelled</h1>
            <p class="subdued center__text">
              This mint was cancelled. Do not send a payment for it.
            </p>
            <button type="button" class="btn btn--primary" @click="reset">
              Start a new mint
            </button>
          </div>

          <!-- Pending: bank transfer instructions -->
          <template v-else>
            <h1 class="page__heading">Complete your payment</h1>
            <p class="subdued page__lede">
              Send <strong>{{ mintedAmount }}</strong> by bank transfer. Your
              tGBP will arrive in your Solana wallet once we receive it.
            </p>

            <div class="status-banner">
              <LoaderCircle :size="16" class="spin" color="#3B4F74" />
              <span>Waiting for your payment…</span>
              <StatusPill :status="mint.status" />
            </div>

            <div v-if="bankDetails" class="card bank">
              <CopyField
                v-if="bankDetails.account_name"
                label="Account name"
                :value="bankDetails.account_name"
              />
              <CopyField
                v-if="bankDetails.sort_code"
                label="Sort code"
                :value="bankDetails.sort_code"
              />
              <CopyField
                v-if="bankDetails.account_number"
                label="Account number"
                :value="bankDetails.account_number"
              />
              <CopyField
                v-if="bankDetails.iban"
                label="IBAN"
                :value="bankDetails.iban"
              />
              <CopyField
                v-if="bankDetails.swift_code"
                label="SWIFT / BIC"
                :value="bankDetails.swift_code"
              />
              <CopyField
                v-if="bankDetails.bank_name"
                label="Bank"
                :value="bankDetails.bank_name"
              />
              <CopyField
                v-if="bankDetails.reference"
                label="Reference"
                :value="bankDetails.reference"
                emphasized
              />
            </div>

            <div class="card card--tint notice">
              <TriangleAlert :size="16" color="#DC7DA6" />
              <p>
                Include the <strong>reference</strong> exactly as shown —
                payments without it cannot be matched to your mint.
              </p>
            </div>

            <p v-if="errorMessage" class="page__error">{{ errorMessage }}</p>

            <button
              type="button"
              class="btn btn--primary page__cta"
              :disabled="busy"
              @click="refreshMint"
            >
              <RefreshCw :size="16" />
              I've sent the payment
            </button>
            <button
              type="button"
              class="btn btn--ghost"
              :disabled="busy"
              @click="cancelMint"
            >
              Cancel this mint
            </button>
          </template>
        </section>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.page__main {
  padding: 8px var(--page-padding-x) 40px;
  max-width: 460px;
  margin: 0 auto;
}

.page__heading {
  font-size: 20px;
  font-weight: 900;
  margin-bottom: 6px;
}

.page__lede {
  margin-bottom: 20px;
}

.page__cta {
  margin-top: 20px;
}

.page__error {
  margin: 12px 2px 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--x-pink);
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 56px;
  text-align: center;
}

.center__text {
  max-width: 300px;
}

.center .btn {
  margin-top: 10px;
}

.icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.icon-badge--pink { background: var(--pink-tint); color: var(--x-pink); }
.icon-badge--green { background: var(--green-tint); color: var(--x-leafgreen); }
.icon-badge--blue { background: var(--blue-tint); color: var(--x-blue); }
.icon-badge--gold { background: var(--gold-tint); color: #a06b2f; }

.destination {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 12px 16px;
}

.destination__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.destination__value {
  font-weight: 700;
}

.summary {
  padding: 8px 16px;
}

.summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
}

.summary__row + .summary__row {
  border-top: 1px solid var(--x-gray);
}

.summary__label {
  color: var(--text-muted);
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary__value {
  font-weight: 700;
}

.summary__value--blue {
  color: var(--x-blue);
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--blue-tint);
  border-radius: var(--radius-card);
  padding: 12px 16px;
  font-weight: 700;
  color: var(--x-blue);
  margin-bottom: 16px;
}

.bank {
  padding: 6px 16px;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 16px;
  font-size: 13px;
}

.explorer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--x-blue);
  font-weight: 700;
  text-decoration: none;
}

.page__cta + .btn--ghost {
  margin-top: 10px;
}
</style>
