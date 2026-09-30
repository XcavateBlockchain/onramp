import type { RedemptionResolveResponse } from '#shared/types'

/**
 * Resolve the app-provided identity (Sumsub applicant id + Solana wallet)
 * to a tGBP customer and load their saved bank accounts. Called once when
 * the redemption webview page loads. Unlike the mint resolve, no recipient
 * address is registered — redemption burns FROM the wallet, it does not
 * mint TO it.
 */
export default defineEventHandler(
  async (event): Promise<RedemptionResolveResponse> => {
    const body = await readBody(event)
    const sumsubId = readSumsubId(body?.sumsubId)
    readSolanaAddress(body?.wallet)

    const customer = await resolveCustomerBySumsubId(event, sumsubId)

    // Only verified customers can redeem; skip the banks lookup otherwise.
    const banks =
      customer.status === 'verified'
        ? await listCustomerBanks(event, customer.id)
        : []

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        firstName: customer.firstName,
        status: customer.status,
        rejectionReason: customer.rejectionReason,
      },
      banks,
    }
  },
)
