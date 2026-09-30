import type { BankAccountDto } from '#shared/types'

/**
 * Save a GBP bank account for the resolved customer — the destination of
 * redemption payouts. GBP accounts take a sort code + account number; EUR
 * accounts are minting-only, so this form stays GBP-only.
 *
 * New accounts start with `redemption_approved: false` (manual approval on
 * the tGBP side); the picker shows them as pending until then.
 */
export default defineEventHandler(async (event): Promise<BankAccountDto> => {
  const body = await readBody(event)
  const sumsubId = readSumsubId(body?.sumsubId)
  const accountHolderName = readBankText(
    body?.accountHolderName,
    'Account holder name',
  )
  const bankName = readBankText(body?.bankName, 'Bank name')
  const sortCode = readSortCode(body?.sortCode)
  const accountNumber = readAccountNumber(body?.accountNumber)
  const nickname = readBankText(body?.nickname, 'Nickname', {
    required: false,
    maxLength: 255,
  })

  const customer = await resolveCustomerBySumsubId(event, sumsubId)
  if (customer.status !== 'verified') {
    throw createError({
      statusCode: 422,
      message:
        'Your identity verification is still in progress. You can add a bank account once it completes.',
      data: { code: 'customer_not_verified' },
    })
  }

  const created = await tgbpFetch<{ data: any }>(event, '/api/v1/banks', {
    method: 'POST',
    body: {
      customer_id: customer.id,
      currency: 'GBP',
      account_type: 'personal',
      account_holder_name: accountHolderName,
      account_number: accountNumber,
      sort_code: sortCode,
      bank_name: bankName,
      country_code: 'GB',
      ...(nickname ? { nickname } : {}),
    },
  })

  return toBankDto(created.data)
})
