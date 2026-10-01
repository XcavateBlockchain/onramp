import bs58 from 'bs58'
import { markRaw } from 'vue'
import type { SolanaInstructionData } from '#shared/types'

/**
 * Solana browser-wallet client built on the Wallet Standard events
 * (Phantom, Solflare, Backpack, … register themselves this way), with a
 * legacy `window.solana` fallback for older injected providers.
 *
 * Wallet state is module-level on purpose: the connection survives
 * navigation between the redemption wizard and the detail page.
 *
 * @solana/web3.js is imported dynamically so the main bundle stays lean;
 * it only loads when a burn transaction is actually built.
 */

interface StandardWalletAccount {
  address: string
  publicKey: Uint8Array
}

interface StandardWallet {
  version: string
  name: string
  icon?: string
  chains: readonly string[]
  features: Record<string, any>
  accounts: readonly StandardWalletAccount[]
}

export interface WalletChoice {
  key: string
  name: string
  icon?: string
  standard?: StandardWallet
  legacy?: any
}

export interface ConnectedWallet {
  address: string
  choice: WalletChoice
}

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const ATA_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
const MEMO_PROGRAM_IDS = new Set([
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
])

const wallets = ref<WalletChoice[]>([])
const connected = ref<ConnectedWallet | null>(null)
const connecting = ref(false)
const detected = ref(false)
let listenerInstalled = false

/** Map an RPC submission failure to something the user can act on. */
function sendErrorMessage(message: string, logs: string[] | null): string {
  const text = [...(logs ?? []), message].join(' ')
  if (/insufficient (funds|lamports)/i.test(text)) {
    return 'Not enough SOL in this wallet to pay the network fee.'
  }
  if (/insufficient/i.test(text) && /token|funds/i.test(text)) {
    return 'This wallet does not hold enough tGBP for the burn.'
  }
  if (/owner does not match|invalid owner|missing required signature/i.test(text)) {
    return 'The burn accounts do not match this wallet. Please contact support.'
  }
  if (/blockhash|expired/i.test(text)) {
    return 'The transaction expired before it was sent. Please try again.'
  }
  if (/invalid account|account not found|invalid account data|custom program error/i.test(text)) {
    return 'The burn could not be completed — make sure this wallet holds the tGBP and try again.'
  }
  return message && message.length <= 140
    ? message
    : 'The burn transaction failed. Please try again.'
}

export function useSolanaWallet() {
  const config = useRuntimeConfig()
  const isDevnet = computed(() => config.public.solanaCluster !== 'mainnet')

  const rpcUrl = computed(
    () =>
      (config.public.solanaRpcUrl as string) ||
      (isDevnet.value
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com'),
  )
  // Wallet Standard chain ids ('solana:mainnet' is the id for mainnet-beta).
  const standardChain = computed(() =>
    isDevnet.value ? 'solana:devnet' : 'solana:mainnet',
  )

  function addStandardWallet(wallet: StandardWallet) {
    const features = wallet.features ?? {}
    if (!(wallet.chains ?? []).some((c) => c.startsWith('solana'))) return
    if (!features['standard:connect']) return
    if (
      !features['solana:signTransaction'] &&
      !features['solana:signAndSendTransaction']
    ) {
      return
    }
    if (wallets.value.some((w) => w.name === wallet.name)) return
    wallets.value.push(
      markRaw({
        key: `std:${wallet.name}`,
        name: wallet.name,
        icon: wallet.icon,
        standard: wallet,
      }),
    )
  }

  function detect() {
    if (!import.meta.client || listenerInstalled) return
    listenerInstalled = true

    // Wallet Standard handshake: wallets loaded after us announce themselves
    // via register-wallet; wallets loaded before us answer app-ready.
    const api = {
      register: (...registered: StandardWallet[]) =>
        registered.forEach(addStandardWallet),
    }
    window.addEventListener('wallet-standard:register-wallet', (event) => {
      const callback = (event as CustomEvent).detail
      if (typeof callback === 'function') callback(api)
    })
    window.dispatchEvent(
      new CustomEvent('wallet-standard:app-ready', { detail: api }),
    )

    // Give late registrations a moment before showing the empty state, and
    // fall back to a legacy injected provider if no standard wallet spoke up.
    setTimeout(() => {
      const legacy = (window as any).solana
      if (wallets.value.length === 0 && legacy?.connect) {
        wallets.value.push(
          markRaw({
            key: 'legacy:injected',
            name: legacy.isPhantom ? 'Phantom' : 'Browser wallet',
            legacy,
          }),
        )
      }
      detected.value = true
      const only =
        wallets.value.length === 1 ? wallets.value[0] : undefined
      if (only && connected.value === null && !connecting.value) {
        connect(only).catch(() => {})
      }
    }, 400)
  }

  async function connect(choice: WalletChoice) {
    if (connecting.value) return
    connecting.value = true
    try {
      if (choice.standard) {
        const out = await choice.standard.features['standard:connect'].connect()
        const account = out?.accounts?.[0] ?? choice.standard.accounts?.[0]
        if (!account?.address) {
          throw new Error('The wallet did not return an account.')
        }
        connected.value = { address: account.address, choice }
      } else {
        const res = await choice.legacy.connect()
        const pk = res?.publicKey ?? choice.legacy.publicKey
        if (!pk) throw new Error('The wallet did not return an account.')
        connected.value = {
          address:
            typeof pk.toBase58 === 'function' ? pk.toBase58() : String(pk),
          choice,
        }
      }
    } finally {
      connecting.value = false
    }
  }

  function disconnect() {
    connected.value = null
  }

  /**
   * Build, sign and broadcast the tGBP burn. Prefers the redemption's
   * prebuilt `transactionData` instructions from tGBP (authoritative: correct
   * token program, accounts and amount); falls back to constructing a plain
   * SPL TransferChecked to the burn address when the mint is known. Returns
   * the base58 signature.
   */
  async function sendSplBurn(params: {
    transactionData?: { instructions: SolanaInstructionData[] } | null
    mint?: string | null
    burnAddress?: string | null
    amount: number
  }): Promise<string> {
    const conn = connected.value
    if (!conn) throw new Error('Connect a wallet first.')

    const web3 = await import('@solana/web3.js')
    const connection = new web3.Connection(rpcUrl.value, 'confirmed')
    const owner = new web3.PublicKey(conn.address)

    if (!params.mint) {
      throw new Error(
        'The tGBP token is not configured on this network. Please contact support.',
      )
    }

    const mint = new web3.PublicKey(params.mint)
    const tokenProgram = new web3.PublicKey(TOKEN_PROGRAM_ID)
    const ataProgram = new web3.PublicKey(ATA_PROGRAM_ID)

    const deriveAta = async (
      accountOwner: InstanceType<typeof web3.PublicKey>,
    ) =>
      (
        await web3.PublicKey.findProgramAddress(
          [accountOwner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
          ataProgram,
        )
      )[0]

    let decimals: number
    try {
      decimals = (await connection.getTokenSupply(mint)).value.decimals
    } catch {
      throw new Error(
        'The tGBP token could not be found on this network. Please contact support.',
      )
    }
    const rawAmount = BigInt(Math.round(params.amount * 10 ** decimals))

    // Self-build the transfer so every account is consistent with the
    // signing wallet: source = the wallet's own token account, authority =
    // the wallet. tGBP's prebuilt instructions only provide the destination
    // token account (what its listener watches) and any memo instruction.
    const sourceTokenAccount = await deriveAta(owner)

    const burnIx = (params.transactionData?.instructions ?? []).find(
      (ix) =>
        ix.programId === TOKEN_PROGRAM_ID ||
        ix.programId === TOKEN_2022_PROGRAM_ID,
    )
    let destTokenAccount: InstanceType<typeof web3.PublicKey> | null = null
    if (burnIx && burnIx.accounts.length >= 2) {
      try {
        destTokenAccount = new web3.PublicKey(burnIx.accounts[1].pubkey)
      } catch {
        destTokenAccount = null
      }
    }

    const sink = params.burnAddress
      ? new web3.PublicKey(params.burnAddress)
      : null
    const sinkAta = sink ? await deriveAta(sink) : null
    if (!destTokenAccount) {
      if (!sinkAta) {
        throw new Error(
          'Burn details are unavailable. Please go back and try again.',
        )
      }
      destTokenAccount = sinkAta
    }

    const tx = new web3.Transaction()

    // Create the sink's token account when that is the destination and it
    // does not exist yet (idempotent — no-op otherwise).
    if (sink && sinkAta && destTokenAccount.equals(sinkAta)) {
      tx.add(
        new web3.TransactionInstruction({
          programId: ataProgram,
          keys: [
            { pubkey: owner, isSigner: true, isWritable: true },
            { pubkey: sinkAta, isSigner: false, isWritable: true },
            { pubkey: sink, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            {
              pubkey: web3.SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
            { pubkey: tokenProgram, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([1]), // createAssociatedTokenAccountIdempotent
        }),
      )
    }

    // A memo ties the burn to the redemption on tGBP's side; carry it over.
    // Its meaningful signer is the burning wallet.
    for (const ix of params.transactionData?.instructions ?? []) {
      if (!MEMO_PROGRAM_IDS.has(ix.programId)) continue
      tx.add(
        new web3.TransactionInstruction({
          programId: new web3.PublicKey(ix.programId),
          keys: ix.accounts.map((a) => ({
            pubkey: a.isSigner ? owner : new web3.PublicKey(a.pubkey),
            isSigner: a.isSigner,
            isWritable: a.isWritable,
          })),
          data: Buffer.from(ix.data, 'base64'),
        }),
      )
    }

    const data = Buffer.alloc(10)
    data[0] = 12 // TransferChecked
    data.writeBigUInt64LE(rawAmount, 1)
    data[9] = decimals
    tx.add(
      new web3.TransactionInstruction({
        programId: tokenProgram,
        keys: [
          { pubkey: sourceTokenAccount, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: destTokenAccount, isSigner: false, isWritable: true },
          { pubkey: owner, isSigner: true, isWritable: false },
        ],
        data,
      }),
    )

    // Readable failure instead of an opaque on-chain error when the wallet
    // does not hold enough tGBP. RPC hiccups here must not block the burn.
    let tgbpTooLow = false
    try {
      const balance =
        await connection.getTokenAccountBalance(sourceTokenAccount)
      tgbpTooLow = (balance.value.uiAmount ?? 0) < params.amount - 1e-9
    } catch {
      // no token account readable — let the transaction attempt proceed
    }
    if (tgbpTooLow) {
      throw new Error('This wallet does not hold enough tGBP for the burn.')
    }

    // The wallet also pays the network fee (plus token-account rent the first
    // time) in SOL — fail readably instead of with an RPC fee error.
    let tooLittleSol = false
    try {
      tooLittleSol = (await connection.getBalance(owner)) < 5_000_000
    } catch {
      // RPC hiccup — let the transaction attempt proceed
    }
    if (tooLittleSol) {
      throw new Error(
        'This wallet needs a little SOL to pay the network fee (about 0.005 SOL).',
      )
    }

    tx.feePayer = owner
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    tx.recentBlockhash = blockhash

    try {
      if (conn.choice.standard) {
        const serialized = tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
        const features = conn.choice.standard.features
        const account =
          conn.choice.standard.accounts.find(
            (a) => a.address === conn.address,
          ) ?? conn.choice.standard.accounts[0]

        if (features['solana:signTransaction']) {
          // Prefer wallet-sign + self-send: we get the signature string
          // directly and can watch confirmation ourselves.
          const [signed] = await features['solana:signTransaction'].signTransaction({
            transaction: serialized,
            account,
            chain: standardChain.value,
          })
          const signature = await connection.sendRawTransaction(
            signed.signedTransaction,
          )
          // Confirmation is best-effort: the burn-confirmation call and
          // tGBP's own listener pick the tx up even if this times out.
          try {
            await connection.confirmTransaction(signature, 'confirmed')
          } catch {
            // proceed — submission succeeded
          }
          return signature
        }

        const [sent] = await features[
          'solana:signAndSendTransaction'
        ].signAndSendTransaction({
          transaction: serialized,
          account,
          chain: standardChain.value,
        })
        return bs58.encode(sent.signature)
      }

      // Legacy injected providers take the Transaction object itself.
      const legacy = conn.choice.legacy
      if (legacy.signAndSendTransaction) {
        const { signature } = await legacy.signAndSendTransaction(tx)
        try {
          await connection.confirmTransaction(signature, 'confirmed')
        } catch {
          // proceed — submission succeeded
        }
        return signature
      }
      const signedTx = await legacy.signTransaction(tx)
      const signature = await connection.sendRawTransaction(
        signedTx.serialize(),
      )
      try {
        await connection.confirmTransaction(signature, 'confirmed')
      } catch {
        // proceed — submission succeeded
      }
      return signature
    } catch (err: any) {
      const message = String(err?.message ?? err ?? '')
      if (err?.code === 4001 || /reject|declin|cancel/i.test(message)) {
        throw new Error('The signature request was rejected in the wallet.')
      }
      // Program logs are the only useful evidence for an on-chain failure —
      // keep them in the console and give the user the readable version.
      let logs: string[] | null = Array.isArray(err?.logs) ? err.logs : null
      if (!logs && typeof err?.getLogs === 'function') {
        try {
          logs = await err.getLogs(connection)
        } catch {
          logs = null
        }
      }
      if (logs?.length) {
        console.warn('[tgbp burn] send failed, program logs:', logs)
      }
      throw new Error(sendErrorMessage(message, logs))
    }
  }

  return {
    wallets,
    connected,
    connecting,
    detected,
    detect,
    connect,
    disconnect,
    sendSplBurn,
    rpcUrl,
    isDevnet,
  }
}
