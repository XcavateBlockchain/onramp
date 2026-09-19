import type { ResolveResponse } from '#shared/types'

/**
 * Resolve the app-provided identity (Sumsub applicant id + Solana wallet)
 * to a tGBP customer, and make sure the wallet is registered as a mint
 * recipient address. Called once when the webview page loads.
 */
export default defineEventHandler(async (event): Promise<ResolveResponse> => {
  const body = await readBody(event)
  const sumsubId = readSumsubId(body?.sumsubId)
  const wallet = readSolanaAddress(body?.wallet)

  const { chain } = getTgbpConfig(event)
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  // Only verified customers can mint; skip address registration otherwise.
  let walletInfo: ResolveResponse['wallet'] = {
    address: wallet,
    chain,
    alreadyRegistered: false,
  }
  if (customer.status === 'verified') {
    const { alreadyRegistered } = await ensureRecipientAddress(
      event,
      customer.id,
      chain,
      wallet,
    )
    walletInfo = { address: wallet, chain, alreadyRegistered }
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      firstName: customer.firstName,
      status: customer.status,
      rejectionReason: customer.rejectionReason,
    },
    wallet: walletInfo,
  }
})
