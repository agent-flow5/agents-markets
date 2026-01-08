import { Injectable } from '@nestjs/common'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import type { Response } from 'express'
import { getModel, type ModelProvider } from './ai/models'

export type ChatOptions = {
  messages: UIMessage[]
  provider: ModelProvider
  modelId: string
  system?: string
  res: Response
}

@Injectable()
export class AppService {
  async chat({ messages, provider, modelId, system, res }: ChatOptions) {
    try {
      const modelMessages = await convertToModelMessages(messages.map(({ id: _id, ...rest }) => rest))

      const result = await streamText({
        model: getModel({ provider, modelId }),
        messages: modelMessages,
        system: system || '你是一个专业的后端智能体。',
      })

      result.pipeUIMessageStreamToResponse(res, {
        originalMessages: messages,
      })
    } catch (error) {
      if (!res.headersSent) {
        const message = error instanceof Error ? error.message : 'Error calling model API'
        res.status(500).json({ error: message })
      }
    }
  }
}
