<script setup lang="ts">
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  ExternalLink,
  Flame,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from 'lucide-vue-next'
import type { RedemptionDto } from '#shared/types'

useHead({ title: 'Redeem tGBP' })

const POLL_INTERVAL_MS = 60_000

/** Statuses where tGBP still moves the redemption forward on its own. */
const LIVE_STATUSES: RedemptionDto['status'][] = [
  'pending',
  'pending_compliance_review',
  'complete',
]

const route = useRoute()
const config = useRuntimeConfig()

const baseURL = config.app.baseURL // '/staging/' or '/production/'
const isDevnet = computed(() => config.public.solanaCluster !== 'mainnet')

const redemptionId = computed(() => String(route.params.id ?? ''))
const sumsubId = computed(() =>
  typeof route.query.sumsubId === 'string' ? route.query.sumsubId : '',
)
const wallet = computed(() =>
  typeof route.query.wallet === 'string' ? route.query.wallet : '',
)

const redemption = ref<RedemptionDto | null>(null)
const loading = ref(true)
const errorMessage = ref('')

const {
  wallets: solanaWallets,
  connected: connectedWallet,
  detected: walletDetected,
  sendSplBurn,
} = useSolanaWallet()
const burnBusy = ref(false)
const burnError = ref('')
const txSignature = ref('')

/** No browser wallet around (e.g. the app webview) → manual instructions. */
const manualMode = computed(
  () =>
    walletDetected.value &&
    solanaWallets.value.length === 0 &&
    !connectedWallet.value,
)

/** Send the burn for this (already created) redemption from the connected wallet. */
async function burnFromDetail() {
  const current = redemption.value
  if (!current || !connectedWallet.value || burnBusy.value) return
  burnBusy.value = true
  burnError.value = ''
  try {
    const hasInstructions = !!current.transactionData?.instructions?.length
    if (!hasInstructions && (!current.burnAddress || !current.tokenMint)) {
      throw new Error('Burn details are unavailable. Please try again later.')
    }
    const signature = await sendSplBurn({
      transactionData: current.transactionData,
      mint: current.tokenMint,
      burnAddress: current.burnAddress,
      amount: current.amount.value,
    })
    txSignature.value = signature
    try {
      redemption.value = await $fetch<RedemptionDto>(
        `${baseURL.replace(/\/$/, '')}/api/redemption/${encodeURIComponent(current.id)}/confirm`,
        { method: 'POST', body: { sumsubId: sumsubId.value, txHash: signature } },
      )
    } catch {
      // The on-chain listener picks the burn up anyway.
    }
  } catch (err: any) {
    burnError.value =
      err?.data?.message ?? err?.message ?? 'The burn transaction failed.'
  } finally {
    burnBusy.value = false
  }
}

const burnTxHash = computed(
  () => txSignature.value || redemption.value?.txHash || '',
)

let pollTimer: ReturnType<typeof setInterval> | undefined
let fetching = false

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = undefined
}

function isLive(status: RedemptionDto['status']) {
  return LIVE_STATUSES.includes(status)
}

async function load() {
  if (fetching) return
  fetching = true
  try {
    const fresh = await $fetch<RedemptionDto>(
      `${baseURL.replace(/\/$/, '')}/api/redemption/${encodeURIComponent(redemptionId.value)}?sumsubId=${encodeURIComponent(sumsubId.value)}`,
    )
    redemption.value = fresh
    if (!isLive(fresh.status)) stopPolling()
  } catch (err: any) {
    errorMessage.value =
      err?.data?.message ?? err?.statusMessage ?? 'Could not load this redemption.'
    stopPolling()
  } finally {
    fetching = false
    loading.value = false
  }
}

onMounted(async () => {
  if (!sumsubId.value) {
    errorMessage.value =
      'This page must be opened from the mobile app (missing identity parameter).'
    loading.value = false
    return
  }
  await load()
  if (redemption.value && isLive(redemption.value.status)) {
    pollTimer = setInterval(load, POLL_INTERVAL_MS)
  }
})

onUnmounted(stopPolling)

const redeemedAmount = computed(() => {
  if (!redemption.value) return ''
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(redemption.value.amount.value)
  return `${formatted} tGBP`
})

const payoutAmount = computed(() => {
  if (!redemption.value) return ''
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

const banner = computed(() => {
  switch (redemption.value?.status) {
    case 'paid':
      return {
        cls: 'banner--green',
        icon: CircleCheck,
        text: `${payoutAmount.value} was sent to ${
          redemption.value?.bankAccount?.name || 'your bank account'
        } by bank transfer.`,
      }
    case 'failed':
      return {
        cls: 'banner--pink',
        icon: CircleX,
        text:
          redemption.value?.failureReason ||
          'The redemption could not be completed.',
      }
    case 'cancelled':
      return {
        cls: 'banner--gold',
        icon: CircleX,
        text: 'This redemption was cancelled. Do not burn tGBP for it.',
      }
    case 'payout_skipped':
      return {
        cls: 'banner--gold',
        icon: CircleX,
        text: 'Your tGBP was burned, but the bank payout was skipped. Please contact support.',
      }
    case 'pending_compliance_review':
      return {
        cls: 'banner--blue',
        icon: null,
        text: 'Burn detected — compliance review in progress…',
      }
    case 'complete':
      return {
        cls: 'banner--blue',
        icon: null,
        text: 'Burn confirmed — sending GBP to your bank…',
      }
    default:
      return {
        cls: 'banner--blue',
        icon: null,
        text: txSignature.value
          ? 'Burn submitted — waiting for confirmation…'
          : 'Waiting for your burn…',
      }
  }
})

function formatSortCode(sortCode: string) {
  return /^\d{6}$/.test(sortCode)
    ? `${sortCode.slice(0, 2)}-${sortCode.slice(2, 4)}-${sortCode.slice(4)}`
    : sortCode
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function explorerUrl(txHash: string) {
  const base = `https://solscan.io/tx/${txHash}`
  return isDevnet.value ? `${base}?cluster=devnet` : base
}
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="page__main">
      <!-- Loading ---------------------------------------------------- -->
      <section v-if="loading" class="center">
        <LoaderCircle :size="40" class="spin" color="#3B4F74" />
        <p class="muted">Loading redemption…</p>
      </section>

      <!-- Error ------------------------------------------------------ -->
      <section v-else-if="errorMessage" class="center">
        <div class="icon-badge icon-badge--pink">
          <TriangleAlert :size="22" />
        </div>
        <h1 class="page__heading">Redemption unavailable</h1>
        <p class="subdued center__text">{{ errorMessage }}</p>
        <NuxtLink class="btn btn--primary" :to="{ path: '/redemption', query: route.query }">
          <ArrowLeft :size="16" />
          Back to redemption
        </NuxtLink>
      </section>

      <!-- Details ---------------------------------------------------- -->
      <section v-else-if="redemption">
        <div class="redemption__head">
          <h1 class="page__heading">Redemption details</h1>
          <StatusPill :status="redemption.status" />
        </div>

        <div class="banner" :class="banner.cls">
          <LoaderCircle v-if="!banner.icon" :size="16" class="spin" />
          <component :is="banner.icon" v-else :size="16" />
          <span>{{ banner.text }}</span>
        </div>

        <div class="card summary">
          <div class="summary__row">
            <span class="summary__label">You burn</span>
            <span class="summary__value">{{ redeemedAmount }}</span>
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
          <div v-if="redemption.bankAccount && !redemption.bank" class="summary__row">
            <span class="summary__label">Payout account</span>
            <span class="summary__value">{{ redemption.bankAccount.name }}</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Network</span>
            <span class="summary__value">
              Solana {{ isDevnet ? 'Devnet' : 'Mainnet' }}
            </span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Created</span>
            <span class="summary__value">{{ formatDate(redemption.createdAt) }}</span>
          </div>
          <div v-if="redemption.payoutStatus" class="summary__row">
            <span class="summary__label">Payout</span>
            <span class="summary__value">{{ redemption.payoutStatus }}</span>
          </div>
        </div>

        <div v-if="redemption.bank" class="card bank-details">
          <div class="summary__row">
            <span class="summary__label">Account holder</span>
            <span class="summary__value">
              {{ redemption.bank.accountHolderName || redemption.bank.nickname }}
            </span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Bank</span>
            <span class="summary__value">{{ redemption.bank.bankName }}</span>
          </div>
          <div v-if="redemption.bank.sortCode" class="summary__row">
            <span class="summary__label">Sort code</span>
            <span class="summary__value">{{ formatSortCode(redemption.bank.sortCode) }}</span>
          </div>
          <div v-if="redemption.bank.accountNumber" class="summary__row">
            <span class="summary__label">Account number</span>
            <span class="summary__value">{{ redemption.bank.accountNumber }}</span>
          </div>
        </div>

        <a
          v-if="burnTxHash && redemption.status !== 'pending' && redemption.status !== 'cancelled'"
          class="explorer"
          :href="explorerUrl(burnTxHash)"
          target="_blank"
          rel="noopener"
        >
          View burn on Solscan
          <ExternalLink :size="14" />
        </a>

        <!-- Complete the burn while the redemption is still pending -->
        <template v-if="redemption.status === 'pending'">
          <template v-if="!manualMode">
            <p class="subdued redemption__lede">
              Connect your Solana wallet and burn
              <strong>{{ redeemedAmount }}</strong>. Your GBP payout starts once
              the burn confirms on-chain.
            </p>

            <div class="redemption__wallets">
              <WalletConnect />
            </div>

            <p v-if="burnError" class="redemption__error">{{ burnError }}</p>

            <button
              v-if="connectedWallet"
              type="button"
              class="btn btn--primary redemption__refresh"
              :disabled="burnBusy"
              @click="burnFromDetail"
            >
              <LoaderCircle v-if="burnBusy" :size="16" class="spin" />
              <Flame v-else :size="16" />
              {{ burnBusy ? 'Check your wallet…' : `Burn ${redeemedAmount}` }}
            </button>
          </template>

          <template v-else>
            <p class="subdued redemption__lede">
              Send exactly <strong>{{ redeemedAmount }}</strong> to the burn
              address from your Xcavate wallet. Your GBP payout starts once the
              burn confirms on-chain.
            </p>

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

            <button type="button" class="btn btn--ghost redemption__refresh" @click="load">
              <RefreshCw :size="16" />
              Refresh status
            </button>
          </template>
        </template>

        <NuxtLink
          class="btn redemption__back"
          :class="isLive(redemption.status) ? 'btn--ghost' : 'btn--primary'"
          :to="{ path: '/redemption', query: route.query }"
        >
          <ArrowLeft :size="16" />
          Back to redemption
        </NuxtLink>
      </section>
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
  text-decoration: none;
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

.redemption__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.redemption__head .page__heading {
  margin-bottom: 0;
}

.redemption__lede {
  margin: 20px 0 12px;
}

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: var(--radius-card);
  padding: 12px 16px;
  font-weight: 700;
  margin-bottom: 16px;
}

.banner--green { background: var(--green-tint); color: var(--x-leafgreen); }
.banner--pink { background: var(--pink-tint); color: var(--x-pink); }
.banner--gold { background: var(--gold-tint); color: #a06b2f; }
.banner--blue { background: var(--blue-tint); color: var(--x-blue); }

.summary {
  padding: 8px 16px;
}

.bank-details {
  padding: 8px 16px;
  margin-top: 16px;
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

.explorer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  color: var(--x-blue);
  font-weight: 700;
  text-decoration: none;
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

.redemption__refresh {
  margin-top: 20px;
}

.redemption__wallets {
  margin-top: 4px;
}

.redemption__error {
  margin: 12px 2px 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--x-pink);
}

.redemption__back {
  margin-top: 20px;
  text-decoration: none;
}

.redemption__refresh + .redemption__back {
  margin-top: 10px;
}
</style>
