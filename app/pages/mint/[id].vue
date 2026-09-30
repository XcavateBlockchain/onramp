<script setup lang="ts">
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from 'lucide-vue-next'
import type { MintDto } from '#shared/types'

const POLL_INTERVAL_MS = 60_000

const route = useRoute()
const config = useRuntimeConfig()

const baseURL = config.app.baseURL // '/staging/' or '/production/'
const isDevnet = computed(() => config.public.solanaCluster !== 'mainnet')

const mintId = computed(() => String(route.params.id ?? ''))
const sumsubId = computed(() =>
  typeof route.query.sumsubId === 'string' ? route.query.sumsubId : '',
)

const mint = ref<MintDto | null>(null)
const loading = ref(true)
const errorMessage = ref('')

let pollTimer: ReturnType<typeof setInterval> | undefined
let fetching = false

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = undefined
}

function isLive(status: MintDto['status']) {
  return status === 'pending' || status === 'paid'
}

async function load() {
  if (fetching) return
  fetching = true
  try {
    const fresh = await $fetch<MintDto>(
      `${baseURL.replace(/\/$/, '')}/api/mint/${encodeURIComponent(mintId.value)}?sumsubId=${encodeURIComponent(sumsubId.value)}`,
    )
    mint.value = fresh
    if (!isLive(fresh.status)) stopPolling()
  } catch (err: any) {
    errorMessage.value =
      err?.data?.message ?? err?.statusMessage ?? 'Could not load this mint.'
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
  if (mint.value && isLive(mint.value.status)) {
    pollTimer = setInterval(load, POLL_INTERVAL_MS)
  }
})

onUnmounted(stopPolling)

const bankDetails = computed(() => mint.value?.bankTransferDetails ?? null)

const formattedAmount = computed(() => {
  if (!mint.value) return ''
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: mint.value.amount.currency || 'GBP',
  }).format(mint.value.amount.value)
})

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

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="page__main">
      <!-- Loading ---------------------------------------------------- -->
      <section v-if="loading" class="center">
        <LoaderCircle :size="40" class="spin" color="#3B4F74" />
        <p class="muted">Loading mint…</p>
      </section>

      <!-- Error ------------------------------------------------------ -->
      <section v-else-if="errorMessage" class="center">
        <div class="icon-badge icon-badge--pink">
          <TriangleAlert :size="22" />
        </div>
        <h1 class="page__heading">Mint unavailable</h1>
        <p class="subdued center__text">{{ errorMessage }}</p>
        <NuxtLink class="btn btn--primary" :to="{ path: '/', query: route.query }">
          <ArrowLeft :size="16" />
          Back to minting
        </NuxtLink>
      </section>

      <!-- Details ---------------------------------------------------- -->
      <section v-else-if="mint">
        <div class="mint__head">
          <h1 class="page__heading">Mint details</h1>
          <StatusPill :status="mint.status" />
        </div>

        <div v-if="mint.status === 'confirmed'" class="banner banner--green">
          <CircleCheck :size="16" />
          <span>
            {{ formattedAmount.replace('£', '') }} tGBP was minted to
            {{ shortAddress(mint.address) }}.
          </span>
        </div>
        <div v-else-if="mint.status === 'failed'" class="banner banner--pink">
          <CircleX :size="16" />
          <span>{{ mint.failureReason || 'The mint could not be completed.' }}</span>
        </div>
        <div v-else-if="mint.status === 'cancelled'" class="banner banner--gold">
          <CircleX :size="16" />
          <span>This mint was cancelled. Do not send a payment for it.</span>
        </div>
        <div v-else class="banner banner--blue">
          <LoaderCircle :size="16" class="spin" />
          <span>{{
            mint.status === 'paid'
              ? 'Payment received — minting your tGBP…'
              : 'Waiting for your payment…'
          }}</span>
        </div>

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
            <span class="summary__label">Network</span>
            <span class="summary__value">
              Solana {{ isDevnet ? 'Devnet' : 'Mainnet' }}
            </span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Destination</span>
            <span class="summary__value">{{ shortAddress(mint.address) }}</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Created</span>
            <span class="summary__value">{{ formatDate(mint.createdAt) }}</span>
          </div>
          <div v-if="mint.confirmedAt" class="summary__row">
            <span class="summary__label">Confirmed</span>
            <span class="summary__value">{{ formatDate(mint.confirmedAt) }}</span>
          </div>
        </div>

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

        <!-- Bank transfer instructions while the mint is still payable -->
        <template v-if="isLive(mint.status) && bankDetails">
          <p class="subdued mint__lede">
            Send <strong>{{ formattedAmount }}</strong> by bank transfer. Your
            tGBP will arrive in your Solana wallet once we receive it.
          </p>

          <div class="card bank">
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

          <button type="button" class="btn btn--ghost mint__refresh" @click="load">
            <RefreshCw :size="16" />
            Refresh status
          </button>
        </template>

        <NuxtLink
          class="btn mint__back"
          :class="isLive(mint.status) ? 'btn--ghost' : 'btn--primary'"
          :to="{ path: '/', query: route.query }"
        >
          <ArrowLeft :size="16" />
          Back to minting
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

.mint__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.mint__head .page__heading {
  margin-bottom: 0;
}

.mint__lede {
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

.mint__refresh {
  margin-top: 20px;
}

.mint__back {
  margin-top: 20px;
  text-decoration: none;
}

.mint__refresh + .mint__back {
  margin-top: 10px;
}
</style>
