<script setup lang="ts">
const config = useRuntimeConfig()
const isStaging = computed(() => config.public.envName !== 'production')
</script>

<template>
  <header class="app-header">
    <div class="app-header__row">
      <span v-if="isStaging" class="pill pill--gold">Staging · Devnet</span>
      <span v-else class="pill pill--blue">Solana</span>
    </div>
  </header>
</template>

<style scoped>
.app-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px var(--page-padding-x) 10px;
}
</style>
