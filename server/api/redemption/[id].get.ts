import type { RedemptionDto } from '#shared/types'

/**
 * Poll one redemption (with the latest bank payout status). Ownership is
 * verified against the resolved customer so a URL with somebody else's
 * redemption id reveals nothing.
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

  const query = getQuery(event)
  const sumsubId = readSumsubId(query.sumsubId)
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  const { redemption, bank } = await getOwnedRedemption(
    event,
    customer.id,
    redemptionId,
    { withPayoutStatus: true },
  )

  const dto = toRedemptionDto(redemption)
  // The browser builds the burn transfer itself — it needs the tGBP mint.
  dto.tokenMint = await getTgbpMint(event)
  dto.bank = bank
  return dto
})
