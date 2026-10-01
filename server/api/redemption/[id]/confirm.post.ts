import type { RedemptionDto } from '#shared/types'

/**
 * Tell tGBP the burn transaction was broadcast, so it can start confirming
 * the payout right away instead of waiting for its on-chain listener.
 * (Documented fallback: `POST /api/v1/redemptions/{id}/burn-confirmation`.)
 */
export default defineEventHandler(async (event): Promise<RedemptionDto> => {
  const redemptionId = getRouterParam(event, 'id') ?? ''
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(redemptionId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid redemption id.',
      data: { code: 'validation_error' },
    })
  }

  const body = await readBody(event)
  const sumsubId = readSumsubId(body?.sumsubId)
  const txHash = readTxHash(body?.txHash)
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  const { bank } = await getOwnedRedemption(event, customer.id, redemptionId)

  // The confirmation response is a payout-status object (payout_initiated /
  // payout_skipped / payout_withheld + bankProviderCode), not a full
  // redemption — re-fetch the redemption for the DTO.
  await tgbpFetch(
    event,
    `/api/v1/redemptions/${encodeURIComponent(redemptionId)}/burn-confirmation`,
    { method: 'POST', body: { txHash } },
  )

  const { redemption } = await getOwnedRedemption(
    event,
    customer.id,
    redemptionId,
    { withPayoutStatus: true },
  )

  const dto = toRedemptionDto(redemption)
  dto.tokenMint = await getTgbpMint(event)
  dto.bank = bank
  return dto
})
