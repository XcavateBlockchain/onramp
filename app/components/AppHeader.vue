<script setup lang="ts">
const config = useRuntimeConfig()
const isStaging = computed(() => config.public.envName !== 'production')
</script>

<template>
  <header class="app-header">
    <div class="app-header__gradient" />
    <div class="app-header__row">
      <div class="app-header__brand">
        <span class="app-header__logo">tGBP</span>
        <span class="app-header__title">Onramp</span>
      </div>
      <span v-if="isStaging" class="pill pill--gold">Staging · Devnet</span>
      <span v-else class="pill pill--blue">Solana</span>
    </div>
  </header>
</template>

<style scoped>
.app-header__gradient {
  height: 4px;
  background: var(--gradient-brand);
}

.app-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px var(--page-padding-x) 10px;
}

.app-header__brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.app-header__logo {
  font-size: 20px;
  font-weight: 900;
  color: var(--x-blue);
  letter-spacing: -0.02em;
}

.app-header__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
</style>
