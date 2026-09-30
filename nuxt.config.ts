// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Server-only (never sent to the browser)
    tgbpApiKey: '',
    tgbpApiBaseUrl: 'https://sandbox.tgbp.io',
    tgbpChain: 'solana-devnet',
    // Optional override for the tGBP mint address; by default it is resolved
    // from the tGBP API's chain details (contract_address).
    tgbpMintAddress: '',
    public: {
      // 'staging' | 'production'
      envName: 'staging',
      // 'devnet' | 'mainnet'
      solanaCluster: 'devnet',
      // Optional Solana RPC URL for the browser burn transaction; defaults to
      // the public api.devnet / api.mainnet-beta endpoints per cluster.
      solanaRpcUrl: '',
    },
  },

  app: {
    head: {
      title: 'Mint tGBP',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, viewport-fit=cover',
        },
        { name: 'theme-color', content: '#3B4F74' },
        { name: 'description', content: 'Mint tGBP to your Solana wallet' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
    },
  },

  routeRules: {
    '/api/**': {
      headers: { 'cache-control': 'no-store' },
    },
  },
})
