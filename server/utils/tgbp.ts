import type { H3Event } from 'h3'

/**
 * Thin server-side client for the tGBP API.
 * The API key lives only here — browser callers never see it.
 */

interface TgbpErrorPayload {
  error?: {
    code?: string
    message?: string
    details?: Record<string, unknown>
  }
}

export function getTgbpConfig(event: H3Event) {
  const config = useRuntimeConfig(event)
  const apiKey = config.tgbpApiKey as string
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message:
        'The service is not configured (missing TGBP API key). Please contact support.',
      data: { code: 'not_configured' },
    })
  }
  return {
    apiKey,
    baseUrl: (config.tgbpApiBaseUrl as string).replace(/\/$/, ''),
    chain: config.tgbpChain as string,
  }
}

export async function tgbpFetch<T>(
  event: H3Event,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: Record<string, unknown>
    headers?: Record<string, string>
  } = {},
): Promise<T> {
  const { apiKey, baseUrl } = getTgbpConfig(event)
  const { method = 'GET', body, headers = {} } = options

  try {
    return await $fetch<T>(`${baseUrl}${path}`, {
      method,
      body,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        ...headers,
      },
    })
  } catch (err: any) {
    const status = err?.response?.status ?? 502
    const payload = err?.response?._data as TgbpErrorPayload | undefined
    const code = payload?.error?.code ?? 'upstream_error'

    const fallbackByStatus: Record<number, string> = {
      401: 'The tGBP service rejected our credentials. Please contact support.',
      403: 'The tGBP service refused the request. Please contact support.',
      404: 'Not found.',
      429: 'Too many requests — please wait a moment and try again.',
    }

    const message =
      payload?.error?.message ??
      fallbackByStatus[status] ??
      (status >= 500
        ? 'The tGBP service is unavailable. Please try again later.'
        : 'Unexpected error from the tGBP service.')

    throw createError({
      statusCode: status,
      message,
      data: { code },
    })
  }
}

/** tGBP idempotency keys are capped at 18 chars. */
export function idempotencyKey(prefix: string): string {
  const stamp = Date.now().toString(36) // ~8-9 chars
  const rand = Math.random().toString(36).slice(2, 7) // 5 chars
  return `${prefix}${stamp}${rand}`.slice(0, 18)
}
