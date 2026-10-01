// Shared DTOs exchanged between the Nuxt server routes (BFF) and the client.

export interface BankTransferDetails {
  account_name?: string
  iban?: string
  bank_name?: string
  bank_address?: string
  swift_code?: string
  sort_code?: string | null
  account_number?: string | null
  reference?: string
  transfer_type?: 'faster_payments' | 'sepa' | 'sepa_instant'
}

export type MintStatus = 'pending' | 'paid' | 'confirmed' | 'failed' | 'cancelled'

export interface MintDto {
  id: string
  status: MintStatus
  amount: { currency: string; value: number }
  chain: string
  address: string
  txHash: string | null
  errorCode: string | null
  failureReason: string | null
  bankTransferDetails: BankTransferDetails | null
  createdAt: string
  confirmedAt: string | null
  creditedAt: string | null
}

export type CustomerStatus = 'pending' | 'verified' | 'rejected' | 'suspended'

export interface ResolveResponse {
  customer: {
    id: string
    name: string
    firstName: string | null
    status: CustomerStatus
    rejectionReason: string | null
  }
  wallet: {
    address: string
    chain: string
    alreadyRegistered: boolean
  }
}

/* ------------------------------------------------------------------ */
/* Redemption (tGBP -> GBP off-ramp)                                    */
/* ------------------------------------------------------------------ */

/**
 * A customer's saved bank account as the browser needs it. Account numbers
 * arrive masked from tGBP (`****1234`) and stay masked end-to-end.
 */
export interface BankAccountDto {
  id: string
  accountHolderName: string | null
  bankName: string
  sortCode: string | null
  accountNumber: string | null
  currency: string
  nickname: string | null
  isDefault: boolean
  redemptionApproved: boolean
}

export type RedemptionStatus =
  | 'pending'
  | 'pending_compliance_review'
  | 'complete'
  | 'paid'
  | 'failed'
  | 'payout_skipped'
  | 'cancelled'

export interface RedemptionDto {
  id: string
  status: RedemptionStatus
  amount: { currency: string; value: number }
  fee: { currency: string; value: number } | null
  chain: string
  burnAddress: string | null
  bankAccount: { id: string; name: string; type: string } | null
  txHash: string | null
  errorCode: string | null
  failureReason: string | null
  payoutStatus: string | null
  /** tGBP mint address on this chain — fallback for building the burn tx. */
  tokenMint?: string | null
  /**
   * Prebuilt Solana burn instructions from tGBP (authoritative: correct token
   * program, accounts and amount). `data` is base64. The frontend sets the fee
   * payer and a fresh blockhash, then has the wallet sign.
   */
  transactionData?: { instructions: SolanaInstructionData[] } | null
  /** The full payout bank account, when the server matched it to the customer's banks. */
  bank?: BankAccountDto | null
  createdAt: string
  updatedAt: string
}

export interface SolanaInstructionData {
  programId: string
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]
  /** base64-encoded instruction data */
  data: string
}

export interface RedemptionResolveResponse {
  customer: ResolveResponse['customer']
  banks: BankAccountDto[]
}

export interface RedemptionQuoteDto {
  verdict: 'low' | 'medium' | 'high' | 'ofac' | 'unavailable'
  allowed: boolean
}

export interface ApiErrorBody {
  message: string
  code?: string
}
