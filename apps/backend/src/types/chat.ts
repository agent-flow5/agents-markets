import type { UIMessage } from 'ai'
import type { RegistryModelId } from '../lib/ai/registry'

export type AgentId = string

export type ChatRequestBody = {
  messages: UIMessage[]
  agentId?: AgentId
  modelId?: RegistryModelId | (string & {})
  systemPrompt?: string
  temperature?: number
}
