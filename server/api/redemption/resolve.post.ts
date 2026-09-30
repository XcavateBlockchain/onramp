import type { RedemptionResolveResponse } from '#shared/types'

/**
 * Resolve the app-provided identity (Sumsub applicant id + Solana wallet)
 * to a tGBP customer and load their saved bank accounts. Called once when
 * the redemption webview page loads. Unlike the mint resolve, no address
 * registration happens here — redemption burns FROM the wallet, and the
 * burn address is registered when a redemption is actually created.
 */
export default defineEventHandler(
  async (event): Promise<RedemptionResolveResponse> => {
    const body = await readBody(event)
    const sumsubId = readSumsubId(body?.sumsubId)
    // The wallet is optional here: in a browser the burn source is the
    // connected Solana wallet, which is only known once the user connects it.
    if (typeof body?.wallet === 'string' && body.wallet) {
      readSolanaAddress(body.wallet)
    }

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
