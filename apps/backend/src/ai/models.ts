import { createOpenAI } from '@ai-sdk/openai'

export type ModelProvider = 'openai' | 'volcengine'

export type GetModelParams = {
  provider: ModelProvider
  modelId: string
}

export const DEFAULT_MODEL_PROVIDER: ModelProvider = 'volcengine'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export function getDefaultModelId(provider: ModelProvider): string {
  if (provider === 'volcengine') {
    return (
      process.env.VOLCENGINE_MODEL_DOUBAO_PRO ||
      process.env.VOLCENGINE_MODEL_DOUBAO_LITE ||
      'ep-你自己的模型，这里我期望是角色扮演类的模型'
    )
  }

  return process.env.OPENAI_MODEL_ID || 'gpt-4o-mini'
}

let cachedOpenAI: ReturnType<typeof createOpenAI> | undefined
let cachedVolcengine: ReturnType<typeof createOpenAI> | undefined

function getOpenAIClient() {
  if (!cachedOpenAI) {
    cachedOpenAI = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  }
  return cachedOpenAI
}

function getVolcengineClient() {
  if (!cachedVolcengine) {
    cachedVolcengine = createOpenAI({
      baseURL: requireEnv('VOLCENGINE_BASE_URL'),
      apiKey: requireEnv('VOLCENGINE_API_KEY'),
    })
  }
  return cachedVolcengine
}

export function getModel({ provider, modelId }: GetModelParams) {
  switch (provider) {
    case 'openai':
      return getOpenAIClient()(modelId)
    case 'volcengine':
      return getVolcengineClient()(modelId)
    default: {
      const exhaustive: never = provider
      throw new Error(`Unsupported provider: ${exhaustive}`)
    }
  }
}
