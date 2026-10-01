import type { RedemptionDto } from '#shared/types'

/** Cancel a still-pending redemption (before the on-chain burn is seen). */
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
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  const { bank } = await getOwnedRedemption(event, customer.id, redemptionId)

  const cancelled = await tgbpFetch<{ data: any }>(
    event,
    `/api/v1/redemptions/${encodeURIComponent(redemptionId)}/cancel`,
    { method: 'POST' },
  )

  const dto = toRedemptionDto(cancelled.data)
  dto.bank = bank
  return dto
})
