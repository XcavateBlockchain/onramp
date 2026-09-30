import type { RedemptionDto } from '#shared/types'

/**
 * Recent redemptions of the resolved customer (newest first), for the
 * history list. Redemptions carry no customer id, so ownership is matched
 * through the customer's bank accounts.
 */
export default defineEventHandler(
  async (event): Promise<{ redemptions: RedemptionDto[] }> => {
    const query = getQuery(event)
    const sumsubId = readSumsubId(query.sumsubId)
    const customer = await resolveCustomerBySumsubId(event, sumsubId)

    const banks = await listCustomerBanks(event, customer.id)
    if (banks.length === 0) return { redemptions: [] }
    const bankIds = new Set(banks.map((b) => b.id))

    const list = await tgbpFetch<{ data: any[] }>(
      event,
      '/api/v1/redemptions?per_page=50',
    )

    const redemptions = (list.data ?? [])
      .filter((r) => r.bankAccount?.id && bankIds.has(r.bankAccount.id))
      .slice(0, 10)
      .map(toRedemptionDto)

    return { redemptions }
  },
)
