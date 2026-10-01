import type {
  BankAccountDto,
  RedemptionDto,
  RedemptionResolveResponse,
} from '#shared/types'

export type RedemptionStep =
  | 'loading'
  | 'error'
  | 'blocked'
  | 'amount'
  | 'bank'
  | 'addBank'
  | 'review'
  | 'burn'

export interface BankFormDetails {
  accountHolderName: string
  bankName: string
  sortCode: string
  accountNumber: string
  nickname: string
}

export type BurnPhase = '' | 'creating' | 'signing' | 'confirming'

const POLL_INTERVAL_MS = 10_000

/** Statuses where tGBP still moves the redemption forward on its own. */
const LIVE_STATUSES: RedemptionDto['status'][] = [
  'pending',
  'pending_compliance_review',
  'complete',
]

function apiPath(baseURL: string, path: string) {
  return `${baseURL.replace(/\/$/, '')}/api${path}`
}

function readError(err: any): { message: string; code?: string } {
  return {
    message:
      err?.data?.message ??
      err?.statusMessage ??
      err?.message ??
      'Something went wrong. Please try again.',
    code: err?.data?.data?.code ?? err?.data?.code,
  }
}

export function useRedemption() {
  const route = useRoute()
  const config = useRuntimeConfig()
  const solanaWallet = useSolanaWallet()

  const baseURL = config.app.baseURL // '/staging/' or '/production/'
  const isDevnet = computed(() => config.public.solanaCluster !== 'mainnet')

  const sumsubId = computed(() =>
    typeof route.query.sumsubId === 'string' ? route.query.sumsubId : '',
  )
  const wallet = computed(() =>
    typeof route.query.wallet === 'string' ? route.query.wallet : '',
  )

  const step = ref<RedemptionStep>('loading')
  const errorMessage = ref('')
  const customer = ref<RedemptionResolveResponse['customer'] | null>(null)
  const amount = ref('')
  const banks = ref<BankAccountDto[]>([])
  const selectedBankId = ref('')
  const redemption = ref<RedemptionDto | null>(null)
  const history = ref<RedemptionDto[]>([])
  const busy = ref(false)
  const burnPhase = ref<BurnPhase>('')
  const txSignature = ref('')

  let pollTimer: ReturnType<typeof setInterval> | undefined

  const selectedBank = computed(
    () => banks.value.find((b) => b.id === selectedBankId.value) ?? null,
  )

  // Approved GBP accounts can actually receive a payout; the rest are shown
  // as pending and cannot be selected.
  const usableBanks = computed(() =>
    banks.value.filter((b) => b.redemptionApproved && b.currency === 'GBP'),
  )

  // The burn is sent by the connected browser wallet when there is one, and
  // falls back to the app-provided wallet (manual instructions) otherwise.
  const burnSourceAddress = computed(
    () => solanaWallet.connected.value?.address || wallet.value,
  )

  function stopPolling() {
    clearInterval(pollTimer)
    pollTimer = undefined
  }

  async function resolve() {
    step.value = 'loading'
    errorMessage.value = ''
    if (!sumsubId.value) {
      errorMessage.value =
        'This page must be opened from the mobile app (missing identity parameter).'
      step.value = 'error'
      return
    }
    try {
      const res = await $fetch<RedemptionResolveResponse>(
        apiPath(baseURL, '/redemption/resolve'),
        {
          method: 'POST',
          body: { sumsubId: sumsubId.value, wallet: wallet.value },
        },
      )
      customer.value = res.customer
      banks.value = res.banks
      if (res.customer.status === 'verified') {
        step.value = 'amount'
        void loadHistory()
      } else {
        step.value = 'blocked'
      }
    } catch (err: any) {
      errorMessage.value = readError(err).message
      step.value = 'error'
    }
  }

  async function loadHistory() {
    try {
      const res = await $fetch<{ redemptions: RedemptionDto[] }>(
        apiPath(
          baseURL,
          `/redemptions?sumsubId=${encodeURIComponent(sumsubId.value)}`,
        ),
      )
      history.value = res.redemptions
    } catch {
      // history is best-effort
    }
  }

  function selectBank(id: string) {
    selectedBankId.value = id
  }

  function continueToBank() {
    errorMessage.value = ''
    step.value = 'bank'
  }

  function backToAmount() {
    errorMessage.value = ''
    step.value = 'amount'
  }

  function startAddBank() {
    errorMessage.value = ''
    step.value = 'addBank'
  }

  function cancelAddBank() {
    errorMessage.value = ''
    step.value = 'bank'
  }

  async function saveBank(details: BankFormDetails) {
    if (busy.value) return
    busy.value = true
    errorMessage.value = ''
    try {
      const bank = await $fetch<BankAccountDto>(
        apiPath(baseURL, '/redemption/banks'),
        {
          method: 'POST',
          body: { sumsubId: sumsubId.value, ...details },
        },
      )
      banks.value = [bank, ...banks.value]
      if (bank.redemptionApproved) selectedBankId.value = bank.id
      step.value = 'bank'
    } catch (err: any) {
      errorMessage.value = readError(err).message
      // stay on addBank so the user can fix the details
    } finally {
      busy.value = false
    }
  }

  function review() {
    if (!selectedBank.value) return
    errorMessage.value = ''
    step.value = 'review'
  }

  function backToBank() {
    step.value = 'bank'
  }

  function continueToBurn() {
    errorMessage.value = ''
    step.value = 'burn'
  }

  function backToReview() {
    step.value = 'review'
  }

  /**
   * The burn button: create the redemption if it does not exist yet, then —
   * with a connected browser wallet — build the transfer, have the wallet
   * sign it, broadcast it, and hand the signature to tGBP so it can start
   * confirming the payout. Without a wallet this only creates the
   * redemption; the manual burn instructions take over.
   */
  async function burn() {
    if (busy.value || !selectedBank.value) return
    busy.value = true
    errorMessage.value = ''
    try {
      if (!redemption.value) {
        burnPhase.value = 'creating'
        redemption.value = await $fetch<RedemptionDto>(
          apiPath(baseURL, '/redemption'),
          {
            method: 'POST',
            body: {
              sumsubId: sumsubId.value,
              wallet: burnSourceAddress.value,
              amount: amount.value,
              bankId: selectedBank.value.id,
            },
          },
        )
        startPolling()
      }

      const current = redemption.value
      const conn = solanaWallet.connected.value
      if (conn && !txSignature.value && current.status === 'pending') {
        const hasInstructions = !!current.transactionData?.instructions?.length
        if (!hasInstructions && (!current.burnAddress || !current.tokenMint)) {
          throw new Error(
            'Burn details are unavailable. Please go back and try again.',
          )
        }
        burnPhase.value = 'signing'
        const signature = await solanaWallet.sendSplBurn({
          transactionData: current.transactionData,
          mint: current.tokenMint,
          burnAddress: current.burnAddress,
          amount: current.amount.value,
        })
        txSignature.value = signature

        burnPhase.value = 'confirming'
        try {
          redemption.value = await $fetch<RedemptionDto>(
            apiPath(
              baseURL,
              `/redemption/${encodeURIComponent(current.id)}/confirm`,
            ),
            {
              method: 'POST',
              body: { sumsubId: sumsubId.value, txHash: signature },
            },
          )
        } catch {
          // The on-chain listener picks the burn up anyway.
        }
      }
    } catch (err: any) {
      errorMessage.value = readError(err).message
    } finally {
      busy.value = false
      burnPhase.value = ''
    }
  }

  async function refreshRedemption() {
    if (!redemption.value) return
    try {
      const fresh = await $fetch<RedemptionDto>(
        apiPath(
          baseURL,
          `/redemption/${encodeURIComponent(redemption.value.id)}?sumsubId=${encodeURIComponent(sumsubId.value)}`,
        ),
      )
      redemption.value = fresh
      if (!LIVE_STATUSES.includes(fresh.status)) {
        stopPolling()
        void loadHistory()
      }
    } catch {
      // transient poll errors are ignored; the next tick retries
    }
  }

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(refreshRedemption, POLL_INTERVAL_MS)
  }

  async function cancelRedemption() {
    if (!redemption.value || busy.value) return
    busy.value = true
    try {
      redemption.value = await $fetch<RedemptionDto>(
        apiPath(
          baseURL,
          `/redemption/${encodeURIComponent(redemption.value.id)}/cancel`,
        ),
        { method: 'POST', body: { sumsubId: sumsubId.value } },
      )
      stopPolling()
      void loadHistory()
    } catch (err: any) {
      errorMessage.value = readError(err).message
    } finally {
      busy.value = false
    }
  }

  function reset() {
    stopPolling()
    redemption.value = null
    amount.value = ''
    errorMessage.value = ''
    burnPhase.value = ''
    txSignature.value = ''
    step.value = 'amount'
  }

  function explorerUrl(txHash: string) {
    const base = `https://solscan.io/tx/${txHash}`
    return isDevnet.value ? `${base}?cluster=devnet` : base
  }

  function shortAddress(address: string) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`
  }

  onUnmounted(stopPolling)

  return {
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
    sumsubId,
    wallet,
    burnSourceAddress,
    connectedWallet: solanaWallet.connected,
    walletCount: computed(() => solanaWallet.wallets.value.length),
    walletDetected: solanaWallet.detected,
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
  }
}
