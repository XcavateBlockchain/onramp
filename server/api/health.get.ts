/** Liveness probe used by the deployment pipeline. No secrets involved. */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  return {
    ok: true,
    environment: config.public.envName,
    chain: config.tgbpChain,
    configured: Boolean(config.tgbpApiKey),
  }
})
