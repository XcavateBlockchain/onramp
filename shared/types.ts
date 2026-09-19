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

export type MintStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled'

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

export interface ApiErrorBody {
  message: string
  code?: string
}
