import type { MintDto } from '#shared/types'

/**
 * Create a mint for the resolved customer. The response carries the bank
 * transfer details the user must pay to; tGBP mints once funds arrive.
 */
export default defineEventHandler(async (event): Promise<MintDto> => {
  const body = await readBody(event)
  const sumsubId = readSumsubId(body?.sumsubId)
  const wallet = readSolanaAddress(body?.wallet)
  const amount = readAmount(body?.amount)

  const { chain } = getTgbpConfig(event)
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  if (customer.status !== 'verified') {
    throw createError({
      statusCode: 422,
      message:
        customer.status === 'pending'
          ? 'Your identity verification is still in progress. You can mint once it completes.'
          : 'This account cannot mint tGBP at the moment. Please contact support.',
      data: { code: 'customer_not_verified' },
    })
  }

  // The destination must be an approved recipient on this customer.
  await ensureRecipientAddress(event, customer.id, chain, wallet)

  const mint = await tgbpFetch<{ data: any }>(event, '/api/v1/mints', {
    method: 'POST',
    body: {
      customerId: customer.id,
      destinationAddress: wallet,
      chain,
      amount: { currency: 'GBP', value: amount },
      paymentType: 'first_party',
    },
    headers: { 'Idempotency-Key': idempotencyKey('mint') },
  })

  return toMintDto(mint.data)
})
