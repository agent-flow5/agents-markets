import { getProviders, type ProvidersEnv } from './providers'

export type RegistryModelId = 'gpt-4o' | 'doubao-pro-32k' | 'doubao-lite'

export type RegistryEnv = ProvidersEnv & {
  VOLCENGINE_MODEL_DOUBAO_PRO?: string
  VOLCENGINE_MODEL_DOUBAO_LITE?: string
}

function availableModelIds(): string {
  return ['gpt-4o', 'doubao-pro-32k', 'doubao-lite'].join(', ')
}

export function getModel(modelId: string, env: RegistryEnv) {
  const { openai, volcengine } = getProviders(env)

  if (modelId === 'gpt-4o') {
    return openai.chat('gpt-4o')
  }

  if (modelId === 'doubao-pro-32k') {
    const endpointId = env.VOLCENGINE_MODEL_DOUBAO_PRO
    if (!endpointId) throw new Error('Missing environment variable: VOLCENGINE_MODEL_DOUBAO_PRO')
    return volcengine.chat(endpointId)
  }

  if (modelId === 'doubao-lite') {
    const endpointId = env.VOLCENGINE_MODEL_DOUBAO_LITE
    if (!endpointId) throw new Error('Missing environment variable: VOLCENGINE_MODEL_DOUBAO_LITE')
    return volcengine.chat(endpointId)
  }

  throw new Error(`Unknown modelId: ${modelId}. Available: ${availableModelIds()}`)
}
