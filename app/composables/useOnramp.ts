import type { MintDto, ResolveResponse } from '#shared/types'

export type OnrampStep =
  | 'loading'
  | 'error'
  | 'blocked'
  | 'form'
  | 'review'
  | 'pay'

const POLL_INTERVAL_MS = 10_000

function apiPath(baseURL: string, path: string) {
  return `${baseURL.replace(/\/$/, '')}/api${path}`
}

function readError(err: any): { message: string; code?: string } {
  return {
    message:
      err?.data?.message ??
      err?.statusMessage ??
      'Something went wrong. Please try again.',
    code: err?.data?.data?.code ?? err?.data?.code,
  }
}

export function useOnramp() {
  const route = useRoute()
  const config = useRuntimeConfig()

  const baseURL = config.app.baseURL // '/staging/' or '/production/'
  const isDevnet = computed(() => config.public.solanaCluster !== 'mainnet')

  const sumsubId = computed(() =>
    typeof route.query.sumsubId === 'string' ? route.query.sumsubId : '',
  )
  const wallet = computed(() =>
    typeof route.query.wallet === 'string' ? route.query.wallet : '',
  )

  const step = ref<OnrampStep>('loading')
  const errorMessage = ref('')
  const customer = ref<ResolveResponse['customer'] | null>(null)
  const amount = ref('')
  const mint = ref<MintDto | null>(null)
  const history = ref<MintDto[]>([])
  const busy = ref(false)

  let pollTimer: ReturnType<typeof setInterval> | undefined

  function stopPolling() {
    clearInterval(pollTimer)
    pollTimer = undefined
  }

  async function resolve() {
    step.value = 'loading'
    errorMessage.value = ''
    if (!sumsubId.value || !wallet.value) {
      errorMessage.value =
        'This page must be opened from the mobile app (missing identity or wallet parameters).'
      step.value = 'error'
      return
    }
    try {
      const res = await $fetch<ResolveResponse>(apiPath(baseURL, '/resolve'), {
        method: 'POST',
        body: { sumsubId: sumsubId.value, wallet: wallet.value },
      })
      customer.value = res.customer
      if (res.customer.status === 'verified') {
        step.value = 'form'
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
      const res = await $fetch<{ mints: MintDto[] }>(
        apiPath(baseURL, `/mints?sumsubId=${encodeURIComponent(sumsubId.value)}`),
      )
      history.value = res.mints
    } catch {
      // history is best-effort
    }
  }

  function review() {
    step.value = 'review'
  }

  function backToForm() {
    step.value = 'form'
  }

  async function createMint() {
    if (busy.value) return
    busy.value = true
    errorMessage.value = ''
    try {
      mint.value = await $fetch<MintDto>(apiPath(baseURL, '/mint'), {
        method: 'POST',
        body: {
          sumsubId: sumsubId.value,
          wallet: wallet.value,
          amount: amount.value,
        },
      })
      step.value = 'pay'
      startPolling()
    } catch (err: any) {
      errorMessage.value = readError(err).message
      // stay on review so the user can retry
    } finally {
      busy.value = false
    }
  }

  async function refreshMint() {
    if (!mint.value) return
    try {
      const fresh = await $fetch<MintDto>(
        apiPath(
          baseURL,
          `/mint/${encodeURIComponent(mint.value.id)}?sumsubId=${encodeURIComponent(sumsubId.value)}`,
        ),
      )
      mint.value = fresh
      if (fresh.status !== 'pending') {
        stopPolling()
        void loadHistory()
      }
    } catch {
      // transient poll errors are ignored; the next tick retries
    }
  }

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(refreshMint, POLL_INTERVAL_MS)
  }

  async function cancelMint() {
    if (!mint.value || busy.value) return
    busy.value = true
    try {
      mint.value = await $fetch<MintDto>(
        apiPath(baseURL, `/mint/${encodeURIComponent(mint.value.id)}/cancel`),
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
    mint.value = null
    amount.value = ''
    errorMessage.value = ''
    step.value = 'form'
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
    mint,
    history,
    busy,
    sumsubId,
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
  }
}
