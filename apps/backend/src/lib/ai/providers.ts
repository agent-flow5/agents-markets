import { createOpenAI } from '@ai-sdk/openai'

export type ProvidersEnv = {
  OPENAI_API_KEY?: string
  VOLCENGINE_API_KEY?: string
  VOLC_API_KEY?: string
  VOLCENGINE_BASE_URL?: string
}

type Providers = {
  openai: ReturnType<typeof createOpenAI>
  volcengine: ReturnType<typeof createOpenAI>
}

const cachedProvidersByKey = new Map<string, Providers>()

function readEnv(env: ProvidersEnv, key: keyof ProvidersEnv & string): string | undefined {
  const fromEnv = env[key]
  if (fromEnv) return fromEnv
  const processEnv = typeof process !== 'undefined' ? process.env : undefined
  return processEnv?.[key]
}

function requireEnv(env: ProvidersEnv, key: keyof ProvidersEnv & string): string {
  const value = readEnv(env, key)
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

export function getProviders(env: ProvidersEnv): Providers {
  const openaiKey = readEnv(env, 'OPENAI_API_KEY') || ''
  const volcBaseURL = readEnv(env, 'VOLCENGINE_BASE_URL') || 'https://ark.cn-beijing.volces.com/api/v3'
  const volcKey = readEnv(env, 'VOLCENGINE_API_KEY') || readEnv(env, 'VOLC_API_KEY') || ''
  const cacheKey = `${openaiKey}::${volcBaseURL}::${volcKey}`
  const cached = cachedProvidersByKey.get(cacheKey)
  if (cached) return cached

  const providers: Providers = {
    openai: createOpenAI({ apiKey: requireEnv(env, 'OPENAI_API_KEY') }),
    volcengine: createOpenAI({
      baseURL: volcBaseURL,
      apiKey: requireEnv(env, (readEnv(env, 'VOLCENGINE_API_KEY') ? 'VOLCENGINE_API_KEY' : 'VOLC_API_KEY') as
        | 'VOLCENGINE_API_KEY'
        | 'VOLC_API_KEY'),
    }),
  }

  cachedProvidersByKey.set(cacheKey, providers)
  return providers
}
