import type { MintDto } from '#shared/types'

/**
 * Poll one mint. Ownership is verified against the resolved customer so a
 * URL with somebody else's mint id reveals nothing.
 */
export default defineEventHandler(async (event): Promise<MintDto> => {
  const mintId = getRouterParam(event, 'id') ?? ''
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(mintId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid mint id.',
      data: { code: 'validation_error' },
    })
  }

  const query = getQuery(event)
  const sumsubId = readSumsubId(query.sumsubId)
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  const mint = await tgbpFetch<{ data: any }>(
    event,
    `/api/v1/mints/${encodeURIComponent(mintId)}`,
  )

  if (mint.data?.customerId !== customer.id) {
    throw createError({
      statusCode: 404,
      message: 'Mint not found.',
      data: { code: 'resource_not_found' },
    })
  }

  return toMintDto(mint.data)
})
