import type { H3Event } from 'h3'
import type { MintDto } from '#shared/types'

/**
 * Customer resolution: the tGBP customer was created by the
 * xcavate-sumsub-webhook service via a Sumsub share-token import.
 * tGBP stores our Sumsub applicantId on the imported customer record
 * (exposed through the customer detail's free-form `metadata`), which is
 * how we map the app's `sumsubId` query parameter to a tGBP customer.
 *
 * The list endpoint omits `metadata`, so we page the list and fetch
 * details in parallel per page. Positive and (short-lived) negative
 * results are cached in-process.
 */

interface CustomerSummary {
  id: string
  name?: string
  first_name?: string | null
  status?: string
}

interface CustomerDetail extends CustomerSummary {
  metadata?: Record<string, unknown> | null
  rejection_reason?: string | null
  sumsub_applicant_id?: string | null
}

interface ResolvedCustomer {
  id: string
  name: string
  firstName: string | null
  status: 'pending' | 'verified' | 'rejected' | 'suspended'
  rejectionReason: string | null
}

interface CacheEntry {
  customer?: ResolvedCustomer
  expiresAt: number
}

const POSITIVE_TTL_MS = 5 * 60 * 1000
const NEGATIVE_TTL_MS = 60 * 1000
const MAX_PAGES = 20
const PAGE_SIZE = 100

const cache = new Map<string, CacheEntry>()

function extractApplicantId(detail: CustomerDetail): string | null {
  const meta = (detail.metadata ?? {}) as Record<string, unknown>
  const candidates = [
    detail.sumsub_applicant_id,
    meta.sumsub_applicant_id,
    meta.sumsubApplicantId,
    meta.applicantId,
    meta.applicant_id,
    (meta.sumsub as Record<string, unknown> | undefined)?.applicant_id,
    (meta.sumsub as Record<string, unknown> | undefined)?.applicantId,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c
  }
  return null
}

function toResolved(detail: CustomerDetail): ResolvedCustomer {
  return {
    id: detail.id,
    name: detail.name ?? '',
    firstName: detail.first_name ?? null,
    status: (detail.status as ResolvedCustomer['status']) ?? 'pending',
    rejectionReason: detail.rejection_reason ?? null,
  }
}

async function scanForCustomer(
  event: H3Event,
  sumsubId: string,
): Promise<ResolvedCustomer | null> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await tgbpFetch<{
      data: CustomerSummary[]
      pagination?: { page?: number; total_pages?: number; total?: number }
    }>(event, `/api/v1/customers?perPage=${PAGE_SIZE}&page=${page}`)

    const rows = list.data ?? []
    if (rows.length === 0) return null

    // The list response omits metadata, so fetch details in parallel.
    const details = await Promise.all(
      rows.map((row) =>
        tgbpFetch<{ data: CustomerDetail }>(
          event,
          `/api/v1/customers/${row.id}`,
        ).then((r) => r.data),
      ),
    )

    for (const detail of details) {
      const applicantId = extractApplicantId(detail)
      if (!applicantId) continue
      // Cache every mapping we see — future lookups get cheaper.
      cache.set(applicantId, {
        customer: toResolved(detail),
        expiresAt: Date.now() + POSITIVE_TTL_MS,
      })
      if (applicantId === sumsubId) return toResolved(detail)
    }

    const totalPages = list.pagination?.total_pages
    if (typeof totalPages === 'number' && page >= totalPages) return null
    if (rows.length < PAGE_SIZE) return null
  }
  return null
}

export async function resolveCustomerBySumsubId(
  event: H3Event,
  sumsubId: string,
): Promise<ResolvedCustomer> {
  const hit = cache.get(sumsubId)
  if (hit && hit.expiresAt > Date.now()) {
    if (hit.customer) return hit.customer
    throw createError({
      statusCode: 404,
      message:
        'We could not find your tGBP account. Please complete registration in the app first.',
      data: { code: 'customer_not_found' },
    })
  }

  const customer = await scanForCustomer(event, sumsubId)
  if (!customer) {
    cache.set(sumsubId, { expiresAt: Date.now() + NEGATIVE_TTL_MS })
    throw createError({
      statusCode: 404,
      message:
        'We could not find your tGBP account. Please complete registration in the app first.',
      data: { code: 'customer_not_found' },
    })
  }
  return customer
}

/** Register the wallet as a mint recipient if tGBP does not know it yet. */
export async function ensureRecipientAddress(
  event: H3Event,
  customerId: string,
  chain: string,
  address: string,
): Promise<{ alreadyRegistered: boolean }> {
  const list = await tgbpFetch<{ data: { address: string }[] }>(
    event,
    `/api/v1/addresses/recipients?customerId=${encodeURIComponent(
      customerId,
    )}&chain=${encodeURIComponent(chain)}&perPage=100`,
  )

  const exists = (list.data ?? []).some(
    (r) => r.address.toLowerCase() === address.toLowerCase(),
  )
  if (exists) return { alreadyRegistered: true }

  try {
    await tgbpFetch(event, '/api/v1/addresses/recipients', {
      method: 'POST',
      body: {
        customerId,
        chain,
        address,
        purpose: 'Transferring funds to my self-hosted wallet',
        label: 'Xcavate mobile wallet',
        useForMint: true,
        useForSwap: false,
        IdempotencyKey: idempotencyKey('rcp'),
      },
    })
    return { alreadyRegistered: false }
  } catch (err: any) {
    // A concurrent registration raced us — that is fine.
    if (err?.data?.code === 'address_already_exists' || err?.statusCode === 409) {
      return { alreadyRegistered: true }
    }
    throw err
  }
}

export function toMintDto(mint: any): MintDto {
  return {
    id: mint.id,
    status: mint.status,
    amount: { currency: mint.amount?.currency, value: mint.amount?.value },
    chain: mint.chain,
    address: mint.address,
    txHash: mint.tx_hash ?? null,
    errorCode: mint.errorCode ?? null,
    failureReason: mint.failureReason ?? null,
    bankTransferDetails: mint.bank_transfer_details ?? null,
    createdAt: mint.created_at,
    confirmedAt: mint.confirmed_at ?? null,
    creditedAt: mint.credited_at ?? null,
  }
}
