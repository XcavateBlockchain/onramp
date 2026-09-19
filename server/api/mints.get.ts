import type { MintDto } from '#shared/types'

/** Recent mints of the resolved customer (newest first), for the history list. */
export default defineEventHandler(async (event): Promise<{ mints: MintDto[] }> => {
  const query = getQuery(event)
  const sumsubId = readSumsubId(query.sumsubId)
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  const list = await tgbpFetch<{ data: any[] }>(
    event,
    '/api/v1/mints?perPage=50',
  )

  const mints = (list.data ?? [])
    .filter((m) => m.customerId === customer.id)
    .slice(0, 10)
    .map(toMintDto)

  return { mints }
})
