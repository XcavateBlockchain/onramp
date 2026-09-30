import type { H3Event } from 'h3'
import type { BankAccountDto, RedemptionDto } from '#shared/types'

/**
 * Redemption-side helpers: bank accounts (where the GBP payout lands) and
 * redemption mapping/ownership.
 *
 * The tGBP banks list endpoint has no customer filter, so we page it and
 * keep rows whose `customer_id` matches. Redemptions carry no customer id
 * either — ownership is established through the destination bank account:
 * a redemption is the customer's iff its `bankAccount.id` is one of their
 * bank accounts.
 */

const MAX_PAGES = 10
const PAGE_SIZE = 100

/**
 * The tGBP mint address for the configured chain, needed client-side to
 * build the burn transfer. Resolved (and cached) from the tGBP chain
 * details, which carry a `contract_address` operational field; an env
 * override (NUXT_TGBP_MINT_ADDRESS) wins when set. The sandbox/devnet mint
 * is known from the xcavate-sumsub-webhook service and used as fallback.
 */
let mintCache: { chain: string; mint: string } | null = null

export async function getTgbpMint(event: H3Event): Promise<string | null> {
  const config = useRuntimeConfig(event)
  const override = (config.tgbpMintAddress as string).trim()
  const { chain } = getTgbpConfig(event)
  if (override) return override
  if (mintCache && mintCache.chain === chain) return mintCache.mint

  try {
    const detail = await tgbpFetch<{ data: any }>(
      event,
      `/api/v1/chains/${encodeURIComponent(chain)}`,
    )
    const data = detail.data ?? {}
    const mint =
      data.contract_address ??
      data.token_address ??
      data.mint_address ??
      data.mint ??
      null
    if (typeof mint === 'string' && mint.length > 0) {
      mintCache = { chain, mint }
      return mint
    }
  } catch (err) {
    console.warn('[tgbp] chain detail lookup for the mint address failed', err)
  }

  if (chain === 'solana-devnet') {
    return '71G3dc4B9p9QBosLx3XhWY3ULRPAxjopngsin66M9HUb'
  }
  return null
}

interface BankRow {
  id: string
  customer_id?: string
  account_holder_name?: string | null
  bank_name?: string
  sort_code?: string | null
  account_number?: string | null
  currency?: string
  nickname?: string | null
  is_default?: boolean
  redemption_approved?: boolean
}

export function toBankDto(row: BankRow): BankAccountDto {
  return {
    id: row.id,
    accountHolderName: row.account_holder_name ?? null,
    bankName: row.bank_name ?? '',
    sortCode: row.sort_code ?? null,
    accountNumber: row.account_number ?? null,
    currency: row.currency ?? 'GBP',
    nickname: row.nickname ?? null,
    isDefault: row.is_default ?? false,
    redemptionApproved: row.redemption_approved ?? false,
  }
}

export async function listCustomerBanks(
  event: H3Event,
  customerId: string,
): Promise<BankAccountDto[]> {
  const banks: BankAccountDto[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await tgbpFetch<{
      data: BankRow[]
      pagination?: { has_next?: boolean; total_pages?: number }
    }>(event, `/api/v1/banks?per_page=${PAGE_SIZE}&page=${page}`)

    const rows = list.data ?? []
    banks.push(
      ...rows.filter((row) => row.customer_id === customerId).map(toBankDto),
    )

    if (rows.length < PAGE_SIZE || list.pagination?.has_next === false) break
  }
  return banks
}

/**
 * Register the wallet as a burn address if tGBP does not know it yet —
 * redemptions burn FROM this wallet, and tGBP attributes the on-chain burn
 * to the customer through this registration (screening happens here too:
 * a sanctioned address is rejected with 403 `address_rejected`).
 *
 * Burn addresses are unique per client across all customers, so a 409 means
 * either a concurrent registration raced us (fine) or the address belongs
 * to a different customer (not fine — burns would be attributed to them).
 */
export async function ensureBurnAddress(
  event: H3Event,
  customerId: string,
  chain: string,
  address: string,
): Promise<{ alreadyRegistered: boolean }> {
  const listPath =
    `/api/v1/addresses/burn?customerId=${encodeURIComponent(customerId)}` +
    `&chain=${encodeURIComponent(chain)}&per_page=100`

  const list = await tgbpFetch<{ data: { address: string }[] }>(
    event,
    listPath,
  )
  const exists = (list.data ?? []).some(
    (r) => r.address.toLowerCase() === address.toLowerCase(),
  )
  if (exists) return { alreadyRegistered: true }

  try {
    await tgbpFetch(event, '/api/v1/addresses/burn', {
      method: 'POST',
      body: {
        customerId,
        chain,
        address,
        label: 'Xcavate mobile wallet',
        IdempotencyKey: idempotencyKey('brn'),
      },
    })
    return { alreadyRegistered: false }
  } catch (err: any) {
    if (err?.statusCode === 409) {
      // Re-check whether the address is registered for THIS customer.
      const retry = await tgbpFetch<{ data: { address: string }[] }>(
        event,
        listPath,
      )
      const ours = (retry.data ?? []).some(
        (r) => r.address.toLowerCase() === address.toLowerCase(),
      )
      if (ours) return { alreadyRegistered: true }
    }
    throw err
  }
}

export function toRedemptionDto(redemption: any): RedemptionDto {  const fee = Number(redemption.fees?.amount)
  return {
    id: redemption.redemptionId ?? redemption.id,
    status: redemption.status,
    amount: {
      currency: redemption.amount?.currency ?? 'GBP',
      value: Number(redemption.amount?.amount ?? redemption.amount?.value ?? 0),
    },
    fee: Number.isFinite(fee)
      ? { currency: redemption.fees?.currency ?? 'GBP', value: fee }
      : null,
    chain: redemption.chain,
    burnAddress: redemption.burnAddress ?? null,
    bankAccount: redemption.bankAccount
      ? {
          id: redemption.bankAccount.id,
          name: redemption.bankAccount.name,
          type: redemption.bankAccount.type,
        }
      : null,
    txHash: redemption.tx_hash ?? null,
    errorCode: redemption.errorCode ?? null,
    failureReason: redemption.failureReason ?? null,
    payoutStatus: redemption.payoutStatus?.status ?? null,
    createdAt: redemption.created_at,
    updatedAt: redemption.updated_at,
  }
}

/**
 * Fetch a redemption and prove it belongs to the customer via its
 * destination bank account. 404s otherwise — a URL with somebody else's
 * redemption id reveals nothing.
 */
export async function getOwnedRedemption(
  event: H3Event,
  customerId: string,
  redemptionId: string,
  { withPayoutStatus = false }: { withPayoutStatus?: boolean } = {},
) {
  const suffix = withPayoutStatus ? '/with-payout-status' : ''
  const redemption = await tgbpFetch<{ data: any }>(
    event,
    `/api/v1/redemptions/${encodeURIComponent(redemptionId)}${suffix}`,
  )

  const bankId = redemption.data?.bankAccount?.id
  const banks = bankId ? await listCustomerBanks(event, customerId) : []
  if (!bankId || !banks.some((b) => b.id === bankId)) {
    throw createError({
      statusCode: 404,
      message: 'Redemption not found.',
      data: { code: 'resource_not_found' },
    })
  }

  return redemption.data
}
