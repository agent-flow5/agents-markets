import { Body, Controller, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import type { UIMessage } from 'ai'
import { AppService } from './app.service'
import { DEFAULT_MODEL_PROVIDER, getDefaultModelId, type ModelProvider } from './ai/models'

type ModelConfig = {
  provider: ModelProvider
  modelId: string
}

type ChatRequestBody = {
  messages: UIMessage[]
  modelConfig?: ModelConfig
  data?: {
    provider?: ModelProvider
    modelId?: string
    systemPrompt?: string
  }
  systemPrompt?: string
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('chat')
  async handleChat(@Body() body: ChatRequestBody, @Res() res: Response) {
    if (!Array.isArray(body.messages)) {
      res.status(400).json({ error: 'Invalid messages' })
      return
    }

    const provider: ModelProvider =
      body.modelConfig?.provider ?? body.data?.provider ?? DEFAULT_MODEL_PROVIDER

    const modelId =
      body.modelConfig?.modelId ??
      body.data?.modelId ??
      getDefaultModelId(provider)

    if (!modelId) {
      res.status(400).json({ error: 'Missing modelId' })
      return
    }

    await this.appService.chat({
      messages: body.messages,
      provider,
      modelId,
      system: body.data?.systemPrompt ?? body.systemPrompt,
      res,
    })
  }
}
