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
