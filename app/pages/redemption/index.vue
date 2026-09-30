<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  Flame,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from 'lucide-vue-next'
import type { BankFormDetails } from '~/composables/useRedemption'

useHead({ title: 'Redeem tGBP' })

const {
  step,
  errorMessage,
  customer,
  amount,
  banks,
  usableBanks,
  selectedBankId,
  selectedBank,
  redemption,
  history,
  busy,
  burnPhase,
  txSignature,
  wallet,
  connectedWallet,
  walletCount,
  walletDetected,
  isDevnet,
  resolve,
  selectBank,
  continueToBank,
  backToAmount,
  startAddBank,
  cancelAddBank,
  saveBank,
  review,
  backToBank,
  continueToBurn,
  backToReview,
  burn,
  refreshRedemption,
  cancelRedemption,
  reset,
  explorerUrl,
  shortAddress,
} = useRedemption()

const amountInput = ref<{ valid: boolean } | null>(null)

onMounted(resolve)

function onSaveBank(details: BankFormDetails) {
  saveBank(details)
}

const formattedAmount = computed(() => {
  const value = Number(amount.value)
  if (!Number.isFinite(value)) return amount.value
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value)
})

const redeemedAmount = computed(() => {
  if (!redemption.value) return ''
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(redemption.value.amount.value)
  return `${formatted} tGBP`
})

const burnAmountLabel = computed(
  () => redeemedAmount.value || `${formattedAmount.value.replace('£', '')} tGBP`,
)

const payoutAmount = computed(() => {
  if (!redemption.value) return formattedAmount.value
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: redemption.value.amount.currency || 'GBP',
  }).format(redemption.value.amount.value)
})

const feeAmount = computed(() => {
  if (!redemption.value?.fee) return null
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: redemption.value.fee.currency || 'GBP',
  }).format(redemption.value.fee.value)
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
        body: 'This account cannot redeem tGBP at the moment. Please contact support.',
      }
  }
})

const bankNote = computed(() => {
  if (banks.value.length === 0) {
    return 'No bank accounts yet — add one to receive your GBP payout.'
  }
  if (usableBanks.value.length === 0) {
    return 'Your bank accounts are pending approval — you can redeem once one is approved.'
  }
  return ''
})

function formatSortCode(sortCode: string) {
  return /^\d{6}$/.test(sortCode)
    ? `${sortCode.slice(0, 2)}-${sortCode.slice(2, 4)}-${sortCode.slice(4)}`
    : sortCode
}

function bankSubtitle(bank: {
  bankName: string
  sortCode: string | null
  accountNumber: string | null
}) {
  return [
    bank.bankName,
    bank.sortCode ? formatSortCode(bank.sortCode) : null,
    bank.accountNumber,
  ]
    .filter(Boolean)
    .join(' · ')
}

const selectedBankName = computed(
  () =>
    selectedBank.value &&
    (selectedBank.value.nickname ||
      selectedBank.value.accountHolderName ||
      selectedBank.value.bankName),
)

const walletMismatch = computed(
  () =>
    wallet.value &&
    connectedWallet.value &&
    connectedWallet.value.address !== wallet.value,
)

/** Wallet-connect burn UI, or manual instructions when no wallet exists. */
const burnActionAvailable = computed(
  () =>
    !redemption.value ||
    (redemption.value.status === 'pending' && !txSignature.value),
)

const manualMode = computed(
  () =>
    walletDetected.value &&
    walletCount.value === 0 &&
    !connectedWallet.value,
)

const showManualInstructions = computed(
  () =>
    manualMode.value &&
    redemption.value?.status === 'pending' &&
    !txSignature.value,
)

const burnBanner = computed(() => {
  switch (redemption.value?.status) {
    case 'pending_compliance_review':
      return 'Burn detected — compliance review in progress…'
    case 'complete':
      return 'Burn confirmed — sending GBP to your bank…'
    default:
      return txSignature.value
        ? 'Burn submitted — waiting for confirmation…'
        : 'Waiting for your burn…'
  }
})

const burnButtonLabel = computed(() => {
  switch (burnPhase.value) {
    case 'creating':
      return 'Creating redemption…'
    case 'signing':
      return 'Check your wallet…'
    case 'confirming':
      return 'Confirming payout…'
    default:
      return `Burn ${burnAmountLabel.value}`
  }
})

const burnTxHash = computed(
  () => txSignature.value || redemption.value?.txHash || '',
)
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="page__main">
      <Transition name="step" mode="out-in">
        <!-- Loading -------------------------------------------------- -->
        <section v-if="step === 'loading'" key="loading" class="center">
          <LoaderCircle :size="40" class="spin" color="#3B4F74" />
          <p class="muted">Preparing your redemption…</p>
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

        <!-- Step 1: amount -------------------------------------------- -->
        <section v-else-if="step === 'amount'" key="amount">
          <StepIndicator :current="1" />

          <p class="subdued page__lede">
            How much tGBP would you like to redeem?
          </p>

          <AmountInput
            ref="amountInput"
            v-model="amount"
            @submit="continueToBank"
          />

          <button
            type="button"
            class="btn btn--primary page__cta"
            :disabled="!amountInput?.valid"
            @click="continueToBank"
          >
            Continue
            <ArrowRight :size="16" />
          </button>

          <div v-if="wallet" class="card card--tint destination">
            <Wallet :size="16" color="#3B4F74" />
            <div>
              <p class="destination__label">Source wallet</p>
              <p class="destination__value">
                {{ shortAddress(wallet) }}
                <span class="muted">· Solana {{ isDevnet ? 'Devnet' : 'Mainnet' }}</span>
              </p>
            </div>
          </div>

          <RedemptionHistory :redemptions="history" />
        </section>

        <!-- Step 2: payout bank account -------------------------------- -->
        <section v-else-if="step === 'bank'" key="bank">
          <StepIndicator :current="2" />

          <h1 class="page__heading">Payout account</h1>
          <p class="subdued page__lede">
            Where should we send your {{ formattedAmount }}?
          </p>

          <div class="card banks__card">
            <button
              v-for="bank in banks"
              :key="bank.id"
              type="button"
              class="banks__row"
              :class="{
                'banks__row--selected': bank.id === selectedBankId,
                'banks__row--disabled': !bank.redemptionApproved,
              }"
              :disabled="!bank.redemptionApproved"
              @click="selectBank(bank.id)"
            >
              <div class="banks__main">
                <span class="banks__name">
                  {{ bank.nickname || bank.accountHolderName || bank.bankName }}
                </span>
                <span class="banks__detail">{{ bankSubtitle(bank) }}</span>
              </div>
              <span v-if="!bank.redemptionApproved" class="pill pill--gold">
                <Clock :size="12" />
                Pending approval
              </span>
              <CircleCheck
                v-else-if="bank.id === selectedBankId"
                :size="18"
                color="#3B4F74"
              />
            </button>

            <button type="button" class="banks__row banks__row--add" @click="startAddBank">
              <span class="banks__add-icon">
                <Plus :size="16" />
              </span>
              <span class="banks__name">Add a bank account</span>
            </button>
          </div>

          <p v-if="bankNote" class="banks__note">{{ bankNote }}</p>

          <button
            type="button"
            class="btn btn--primary page__cta"
            :disabled="!selectedBank"
            @click="review"
          >
            Continue
            <ArrowRight :size="16" />
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            :disabled="busy"
            @click="backToAmount"
          >
            <ArrowLeft :size="16" />
            Back
          </button>
        </section>

        <!-- Step 2b: add bank account ---------------------------------- -->
        <section v-else-if="step === 'addBank'" key="addBank">
          <StepIndicator :current="2" />

          <h1 class="page__heading">Add a bank account</h1>
          <p class="subdued page__lede">
            Your GBP payout lands here. Accounts are reviewed before the first
            redemption.
          </p>

          <BankForm :busy="busy" @save="onSaveBank" @cancel="cancelAddBank" />

          <p v-if="errorMessage" class="page__error">{{ errorMessage }}</p>
        </section>

        <!-- Step 3: review --------------------------------------------- -->
        <section v-else-if="step === 'review'" key="review">
          <StepIndicator :current="3" />

          <h1 class="page__heading">Review your redemption</h1>
          <p class="subdued page__lede">Check the details before continuing.</p>

          <div class="card summary">
            <div class="summary__row">
              <span class="summary__label">You burn</span>
              <span class="summary__value">
                {{ formattedAmount.replace('£', '') }} tGBP
              </span>
            </div>
            <div class="summary__row">
              <span class="summary__label">You receive</span>
              <span class="summary__value summary__value--blue">
                {{ formattedAmount }}
              </span>
            </div>
            <div class="summary__row">
              <span class="summary__label">Rate</span>
              <span class="summary__value">1 tGBP = £1</span>
            </div>
            <div v-if="selectedBank" class="summary__row">
              <span class="summary__label">Payout account</span>
              <span class="summary__value">
                {{ selectedBankName }}
                <span class="muted">{{ selectedBank.accountNumber }}</span>
              </span>
            </div>
            <div class="summary__row">
              <span class="summary__label">Network</span>
              <span class="summary__value">
                Solana {{ isDevnet ? 'Devnet' : 'Mainnet' }}
              </span>
            </div>
          </div>

          <button
            type="button"
            class="btn btn--primary page__cta"
            @click="continueToBurn"
          >
            Continue
            <ArrowRight :size="16" />
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            @click="backToBank"
          >
            <ArrowLeft :size="16" />
            Back
          </button>
        </section>

        <!-- Burn: connect wallet + sign, then status ------------------- -->
        <section v-else-if="step === 'burn'" key="burn">
          <!-- Terminal states -->
          <div v-if="redemption?.status === 'paid'" class="center">
            <div class="icon-badge icon-badge--green">
              <CircleCheck :size="22" />
            </div>
            <h1 class="page__heading">GBP on its way</h1>
            <p class="subdued center__text">
              {{ payoutAmount }} was sent to
              {{ redemption.bankAccount?.name || 'your bank account' }} by bank
              transfer.
            </p>
            <a
              v-if="burnTxHash"
              class="explorer"
              :href="explorerUrl(burnTxHash)"
              target="_blank"
              rel="noopener"
            >
              View burn on Solscan
              <ExternalLink :size="14" />
            </a>
            <button type="button" class="btn btn--primary" @click="reset">
              Redeem more
            </button>
          </div>

          <div v-else-if="redemption?.status === 'failed'" class="center">
            <div class="icon-badge icon-badge--pink">
              <CircleX :size="22" />
            </div>
            <h1 class="page__heading">Redemption failed</h1>
            <p class="subdued center__text">
              {{ redemption.failureReason || 'The redemption could not be completed.' }}
            </p>
            <button type="button" class="btn btn--primary" @click="reset">
              <RefreshCw :size="16" />
              Try again
            </button>
          </div>

          <div v-else-if="redemption?.status === 'cancelled'" class="center">
            <div class="icon-badge icon-badge--gold">
              <CircleX :size="22" />
            </div>
            <h1 class="page__heading">Redemption cancelled</h1>
            <p class="subdued center__text">
              This redemption was cancelled. Do not burn tGBP for it.
            </p>
            <button type="button" class="btn btn--primary" @click="reset">
              Start a new redemption
            </button>
          </div>

          <div v-else-if="redemption?.status === 'payout_skipped'" class="center">
            <div class="icon-badge icon-badge--gold">
              <CircleX :size="22" />
            </div>
            <h1 class="page__heading">Burn confirmed</h1>
            <p class="subdued center__text">
              Your tGBP was burned, but the bank payout was skipped. Please
              contact support.
            </p>
            <a
              v-if="burnTxHash"
              class="explorer"
              :href="explorerUrl(burnTxHash)"
              target="_blank"
              rel="noopener"
            >
              View burn on Solscan
              <ExternalLink :size="14" />
            </a>
            <button type="button" class="btn btn--primary" @click="reset">
              Back to redemption
            </button>
          </div>

          <!-- Burn action + in-flight status ---------------------------- -->
          <template v-else>
            <h1 class="page__heading">
              {{ redemption ? 'Complete your burn' : 'Burn your tGBP' }}
            </h1>
            <p class="subdued page__lede">
              Connect your Solana wallet and burn
              <strong>{{ burnAmountLabel }}</strong>. Your GBP payout starts
              once the burn confirms on-chain.
            </p>

            <div v-if="redemption" class="status-banner">
              <LoaderCircle :size="16" class="spin" color="#3B4F74" />
              <span>{{ burnBanner }}</span>
              <StatusPill :status="redemption.status" />
            </div>

            <div class="card summary">
              <div class="summary__row">
                <span class="summary__label">You burn</span>
                <span class="summary__value">{{ burnAmountLabel }}</span>
              </div>
              <div v-if="feeAmount" class="summary__row">
                <span class="summary__label">Fee</span>
                <span class="summary__value">{{ feeAmount }}</span>
              </div>
              <div class="summary__row">
                <span class="summary__label">You receive</span>
                <span class="summary__value summary__value--blue">
                  {{ payoutAmount }}
                </span>
              </div>
              <div class="summary__row">
                <span class="summary__label">Payout account</span>
                <span class="summary__value">
                  {{ redemption?.bankAccount?.name || selectedBankName }}
                </span>
              </div>
            </div>

            <div v-if="walletMismatch" class="card card--tint notice">
              <TriangleAlert :size="16" color="#a06b2f" />
              <p>
                The connected wallet is different from your app wallet. The
                burn will be sent from the connected wallet.
              </p>
            </div>

            <!-- Wallet connect / burn action -->
            <template v-if="burnActionAvailable && !manualMode">
              <div class="burn__wallets">
                <WalletConnect />
              </div>

              <p v-if="errorMessage" class="page__error">{{ errorMessage }}</p>

              <button
                v-if="connectedWallet"
                type="button"
                class="btn btn--primary page__cta"
                :disabled="busy"
                @click="burn"
              >
                <LoaderCircle v-if="busy" :size="16" class="spin" />
                <Flame v-else :size="16" />
                {{ burnButtonLabel }}
              </button>
            </template>

            <!-- Manual fallback (no browser wallet, e.g. app webview) -->
            <template v-else-if="manualMode">
              <template v-if="showManualInstructions && redemption">
                <div class="card bank">
                  <CopyField
                    v-if="redemption.burnAddress"
                    label="Burn address"
                    :value="redemption.burnAddress"
                    emphasized
                  />
                  <CopyField label="Amount" :value="redeemedAmount" />
                  <CopyField v-if="wallet" label="Send from" :value="wallet" />
                </div>

                <div class="card card--tint notice">
                  <TriangleAlert :size="16" color="#DC7DA6" />
                  <p>
                    Burn the <strong>exact amount</strong> from
                    <strong>your wallet</strong> shown above — burns that do not
                    match cannot be matched to your redemption.
                  </p>
                </div>

                <p v-if="errorMessage" class="page__error">{{ errorMessage }}</p>

                <button
                  type="button"
                  class="btn btn--primary page__cta"
                  :disabled="busy"
                  @click="refreshRedemption"
                >
                  <RefreshCw :size="16" />
                  I've sent the burn
                </button>
              </template>

              <template v-else-if="!redemption">
                <p class="subdued burn__manual-note">
                  No browser wallet detected. If you opened this page from the
                  app, you can send the burn manually instead.
                </p>
                <p v-if="errorMessage" class="page__error">{{ errorMessage }}</p>
                <button
                  type="button"
                  class="btn btn--primary page__cta"
                  :disabled="busy || !wallet"
                  @click="burn"
                >
                  <LoaderCircle v-if="busy" :size="16" class="spin" />
                  <Flame v-else :size="16" />
                  {{ busy ? 'Creating redemption…' : 'Get burn instructions' }}
                </button>
              </template>
            </template>

            <!-- Post-burn refresh -->
            <template v-else-if="redemption">
              <p v-if="errorMessage" class="page__error">{{ errorMessage }}</p>
              <button
                type="button"
                class="btn btn--primary page__cta"
                :disabled="busy"
                @click="refreshRedemption"
              >
                <RefreshCw :size="16" />
                Refresh status
              </button>
            </template>

            <a
              v-if="burnTxHash"
              class="explorer"
              :href="explorerUrl(burnTxHash)"
              target="_blank"
              rel="noopener"
            >
              View burn on Solscan
              <ExternalLink :size="14" />
            </a>

            <button
              v-if="redemption?.status === 'pending' && !txSignature"
              type="button"
              class="btn btn--ghost"
              :disabled="busy"
              @click="cancelRedemption"
            >
              Cancel this redemption
            </button>
            <button
              v-else-if="!redemption"
              type="button"
              class="btn btn--ghost"
              :disabled="busy"
              @click="backToReview"
            >
              <ArrowLeft :size="16" />
              Back
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

.banks__card {
  padding: 6px 16px;
}

.banks__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 -8px;
  padding: 10px 8px;
  border: 0;
  border-radius: var(--radius-card);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.banks__row + .banks__row {
  border-top: 1px solid var(--x-gray);
}

.banks__row--selected {
  background: var(--blue-tint);
}

.banks__row--disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.banks__row--add {
  justify-content: flex-start;
  gap: 10px;
  color: var(--x-blue);
}

.banks__add-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--blue-tint);
}

.banks__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.banks__name {
  font-weight: 700;
}

.banks__detail {
  font-size: 12px;
  color: var(--text-muted);
}

.banks__note {
  margin: 10px 2px 0;
  font-size: 12px;
  color: var(--text-muted);
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
  text-align: right;
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
  margin: 16px 0;
}

.bank {
  padding: 6px 16px;
  margin-top: 16px;
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
  margin-top: 14px;
  color: var(--x-blue);
  font-weight: 700;
  text-decoration: none;
}

.burn__wallets {
  margin-top: 16px;
}

.burn__manual-note {
  margin-top: 16px;
  font-size: 13px;
}

.page__cta + .btn--ghost {
  margin-top: 10px;
}
</style>
