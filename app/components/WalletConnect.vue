<script setup lang="ts">
import { LoaderCircle, Wallet, X } from 'lucide-vue-next'

/**
 * Wallet picker / connected-wallet card. Detection and the connection itself
 * live in useSolanaWallet (shared module state); this component is pure UI.
 */
const { wallets, connected, connecting, detected, detect, connect, disconnect } =
  useSolanaWallet()

const errorMessage = ref('')

onMounted(detect)

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

async function onSelect(choice: Parameters<typeof connect>[0]) {
  errorMessage.value = ''
  try {
    await connect(choice)
  } catch (err: any) {
    errorMessage.value =
      err?.message && String(err.message).length <= 140
        ? String(err.message)
        : 'Could not connect the wallet.'
  }
}
</script>

<template>
  <div>
    <!-- Connected wallet -->
    <div v-if="connected" class="card card--tint wc-connected">
      <span class="wc-icon">
        <img v-if="connected.choice.icon" :src="connected.choice.icon" alt="" />
        <Wallet v-else :size="14" color="#3B4F74" />
      </span>
      <div class="wc-connected__text">
        <p class="wc-connected__label">Connected wallet</p>
        <p class="wc-connected__value">
          {{ connected.choice.name }}
          <span class="muted">· {{ shortAddress(connected.address) }}</span>
        </p>
      </div>
      <button
        type="button"
        class="wc-change"
        :disabled="connecting"
        aria-label="Disconnect wallet"
        @click="disconnect"
      >
        <X :size="16" />
      </button>
    </div>

    <!-- Wallet picker -->
    <div v-else-if="wallets.length" class="card wc-card">
      <button
        v-for="choice in wallets"
        :key="choice.key"
        type="button"
        class="wc-row"
        :disabled="connecting"
        @click="onSelect(choice)"
      >
        <span class="wc-icon">
          <img v-if="choice.icon" :src="choice.icon" alt="" />
          <Wallet v-else :size="14" color="#3B4F74" />
        </span>
        <span class="wc-name">{{ choice.name }}</span>
        <LoaderCircle v-if="connecting" :size="14" class="spin" color="#3B4F74" />
      </button>
    </div>

    <!-- Empty states -->
    <div v-else-if="!detected" class="card card--tint wc-empty">
      <LoaderCircle :size="16" class="spin" color="#3B4F74" />
      <p class="subdued">Detecting Solana wallets…</p>
    </div>
    <div v-else class="card card--tint wc-empty">
      <Wallet :size="16" color="#3B4F74" />
      <p class="subdued">
        No Solana wallet found. Install a browser wallet such as Phantom or
        Solflare, then reload this page.
      </p>
    </div>

    <p v-if="errorMessage" class="wc-error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.wc-card {
  padding: 6px 16px;
}

.wc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 -8px;
  padding: 12px 8px;
  border: 0;
  border-radius: var(--radius-card);
  background: transparent;
  color: inherit;
  font-size: 14px;
  cursor: pointer;
}

.wc-row + .wc-row {
  border-top: 1px solid var(--x-gray);
}

.wc-row:active {
  background: var(--blue-tint);
}

.wc-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--blue-tint);
  overflow: hidden;
  flex: none;
}

.wc-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wc-name {
  font-weight: 700;
  flex: 1;
  text-align: left;
}

.wc-connected {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}

.wc-connected__text {
  flex: 1;
  min-width: 0;
}

.wc-connected__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.wc-connected__value {
  font-weight: 700;
}

.wc-change {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  border: 0;
  border-radius: 50%;
  background: rgba(78, 78, 78, 0.1);
  color: var(--x-blue);
  cursor: pointer;
}

.wc-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  font-size: 13px;
}

.wc-error {
  margin: 12px 2px 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--x-pink);
}
</style>
