import { Buffer } from 'buffer'

// @solana/web3.js expects a Node-style Buffer global; browsers don't have one.
export default defineNuxtPlugin(() => {
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer
  }
})
