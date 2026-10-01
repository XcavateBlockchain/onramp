import type { RedemptionDto } from '#shared/types'

/**
 * Create a redemption for the resolved customer. The response carries the
 * shared protocol burn address; tGBP pays out GBP to the chosen bank
 * account once the on-chain burn is detected.
 */
export default defineEventHandler(async (event): Promise<RedemptionDto> => {
  const body = await readBody(event)
  const sumsubId = readSumsubId(body?.sumsubId)
  const wallet = readSolanaAddress(body?.wallet)
  const amount = readAmount(body?.amount)
  const bankId = readBankId(body?.bankId)

  const { chain } = getTgbpConfig(event)
  const customer = await resolveCustomerBySumsubId(event, sumsubId)

  if (customer.status !== 'verified') {
    throw createError({
      statusCode: 422,
      message:
        customer.status === 'pending'
          ? 'Your identity verification is still in progress. You can redeem once it completes.'
          : 'This account cannot redeem tGBP at the moment. Please contact support.',
      data: { code: 'customer_not_verified' },
    })
  }

  // The burn source must be a registered burn address on this customer —
  // tGBP attributes the on-chain burn to the customer through it.
  await ensureBurnAddress(event, customer.id, chain, wallet)

  // The payout destination must be one of the customer's own bank accounts.
  const banks = await listCustomerBanks(event, customer.id)
  const bank = banks.find((b) => b.id === bankId)
  if (!bank) {
    throw createError({
      statusCode: 404,
      message: 'Bank account not found.',
      data: { code: 'resource_not_found' },
    })
  }
  if (bank.currency !== 'GBP') {
    throw createError({
      statusCode: 400,
      message: 'Redemptions pay out to GBP bank accounts only.',
      data: { code: 'validation_error' },
    })
  }
  if (!bank.redemptionApproved) {
    throw createError({
      statusCode: 422,
      message:
        'This bank account is not yet approved for redemptions. Approval usually happens after we review the account — try again later or contact support.',
      data: { code: 'bank_not_approved' },
    })
  }

  // Pre-burn compliance screen of the wallet that will send the burn.
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
  if (quote.data?.allowed === false) {
    throw createError({
      statusCode: 422,
      message:
        'This wallet cannot redeem tGBP. Please contact support if you believe this is a mistake.',
      data: { code: 'address_not_allowed' },
    })
  }

  const key = idempotencyKey('red')
  const redemption = await tgbpFetch<{ data: any }>(
    event,
    '/api/v1/redemptions',
    {
      method: 'POST',
      body: {
        chain,
        amount: { currency: 'GBP', value: amount },
        bankId,
        IdempotencyKey: key,
      },
      headers: { 'Idempotency-Key': key },
    },
  )

  const dto = toRedemptionDto(redemption.data)
  // The browser builds the burn transfer itself — it needs the tGBP mint.
  dto.tokenMint = await getTgbpMint(event)
  dto.bank = bank
  return dto
})
