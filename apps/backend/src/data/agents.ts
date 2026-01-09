import type { RegistryModelId } from '../lib/ai/registry'
import { CODE_ASSISTANT_PROMPT, ZH_TRANSLATOR_PROMPT } from '../prompts/system'

export type AgentConfig = {
  id: string
  name: string
  modelId: RegistryModelId
  systemPrompt: string
  temperature: number
}

export const DEMO_AGENTS: AgentConfig[] = [
  {
    id: 'code-assistant',
    name: '代码助手',
    modelId: 'gpt-4o',
    systemPrompt: CODE_ASSISTANT_PROMPT,
    temperature: 0.2,
  },
  {
    id: 'zh-translator',
    name: '中文翻译官',
    modelId: 'doubao-lite',
    systemPrompt: ZH_TRANSLATOR_PROMPT,
    temperature: 0.3,
  },
]

export function getAgentById(agentId: string): AgentConfig | undefined {
  return DEMO_AGENTS.find((a) => a.id === agentId)
}
