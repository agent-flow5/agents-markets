import type { UIMessage } from 'ai'
import type { RegistryModelId } from '../lib/ai/registry'

export type ChatRequestBody = {
  messages: UIMessage[]
  modelId?: RegistryModelId | (string & {})
  systemPrompt: string
  temperature?: number
}
