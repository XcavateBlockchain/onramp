const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function readSumsubId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{6,64}$/.test(value)) {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid sumsubId.',
      data: { code: 'validation_error' },
    })
  }
  return value
}

export function readSolanaAddress(value: unknown): string {
  if (typeof value !== 'string' || !SOLANA_ADDRESS_RE.test(value)) {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid Solana wallet address.',
      data: { code: 'validation_error' },
    })
  }
  return value
}

export function readAmount(value: unknown): number {
  const amount = typeof value === 'string' ? Number(value) : (value as number)
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 5 ||
    amount > 1_000_000 ||
    !/^\d+(\.\d{1,2})?$/.test(String(value))
  ) {
    throw createError({
      statusCode: 400,
      message: 'Amount must be at least £5.00 with at most 2 decimal places.',
      data: { code: 'invalid_amount' },
    })
  }
  return amount
}

export function readBankId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{3,64}$/.test(value)) {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid bank account id.',
      data: { code: 'validation_error' },
    })
  }
  return value
}

/** Solana transaction signature (base58). */
export function readTxHash(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,90}$/.test(value)) {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid transaction hash.',
      data: { code: 'validation_error' },
    })
  }
  return value
}

/** GBP sort code — accepts "123456" or the dashed "12-34-56" form. */
export function readSortCode(value: unknown): string {
  const digits = typeof value === 'string' ? value.replace(/-/g, '') : ''
  if (!/^\d{6}$/.test(digits)) {
    throw createError({
      statusCode: 400,
      message: 'Sort code must be 6 digits.',
      data: { code: 'validation_error' },
    })
  }
  return digits
}

/** GBP account number — exactly 8 digits. */
export function readAccountNumber(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) {
    throw createError({
      statusCode: 400,
      message: 'Account number must be exactly 8 digits.',
      data: { code: 'validation_error' },
    })
  }
  return value
}

/** Free-text bank field (account holder, bank name, nickname). */
export function readBankText(
  value: unknown,
  label: string,
  { required = true, maxLength = 100 }: { required?: boolean; maxLength?: number } = {},
): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) {
    if (!required) return null
    throw createError({
      statusCode: 400,
      message: `${label} is required.`,
      data: { code: 'validation_error' },
    })
  }
  if (text.length > maxLength) {
    throw createError({
      statusCode: 400,
      message: `${label} is too long (max ${maxLength} characters).`,
      data: { code: 'validation_error' },
    })
  }
  return text
}
