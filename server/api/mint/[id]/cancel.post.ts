import type { MintDto } from '#shared/types'

/** Cancel a still-pending mint (e.g. the user abandoned the payment). */
export default defineEventHandler(async (event): Promise<MintDto> => {
  const mintId = getRouterParam(event, 'id') ?? ''
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(mintId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid mint id.',
      data: { code: 'validation_error' },
    })
  }

  const body = await readBody(event)
  const sumsubId = readSumsubId(body?.sumsubId)
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  const current = await tgbpFetch<{ data: any }>(
    event,
    `/api/v1/mints/${encodeURIComponent(mintId)}`,
  )
  if (current.data?.customerId !== customer.id) {
    throw createError({
      statusCode: 404,
      message: 'Mint not found.',
      data: { code: 'resource_not_found' },
    })
  }

  const cancelled = await tgbpFetch<{ data: any }>(
    event,
    `/api/v1/mints/${encodeURIComponent(mintId)}/cancel`,
    { method: 'POST' },
  )

  return toMintDto(cancelled.data)
})
