import type { RedemptionQuoteDto } from '#shared/types'

/**
 * Pre-burn compliance screen: tGBP checks the wallet that will SEND the
 * burn against Range, so the page can refuse to proceed for sanctioned
 * addresses BEFORE anything irreversible happens on-chain. The create
 * route re-checks this authoritatively.
 */
export default defineEventHandler(
  async (event): Promise<RedemptionQuoteDto> => {
    const body = await readBody(event)
    const sumsubId = readSumsubId(body?.sumsubId)
    const wallet = readSolanaAddress(body?.wallet)
    const amount = readAmount(body?.amount)

    const { chain } = getTgbpConfig(event)
    const customer = await resolveCustomerBySumsubId(event, sumsubId)
    if (customer.status !== 'verified') {
      throw createError({
        statusCode: 422,
        message: 'This account cannot redeem tGBP at the moment.',
        data: { code: 'customer_not_verified' },
      })
    }

    const quote = await tgbpFetch<{ data: any }>(
      event,
      '/api/v1/redemptions/quote',
      {
        method: 'POST',
        body: {
          chain,
          sourceAddress: wallet,
          amount: { currency: 'GBP', value: amount },
        },
      },
    )

    return {
      verdict: quote.data?.verdict ?? 'unavailable',
      allowed: quote.data?.allowed !== false,
    }
  },
)
