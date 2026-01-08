import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import {
  DEFAULT_MODEL_PROVIDER,
  getDefaultModelId,
  getModel,
  type Env as ModelEnv,
  type ModelProvider,
} from './ai/models'

type Env = ModelEnv & {
  CORS_ORIGIN?: string
}

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

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const requestOrigin = request.headers.get('Origin')
  const allowedOrigin = env.CORS_ORIGIN || requestOrigin || '*'

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { ...init, headers })
}

function validateProviderEnv(provider: ModelProvider, env: Env): string[] {
  if (provider === 'volcengine') {
    const missing: string[] = []
    if (!env.VOLCENGINE_BASE_URL) missing.push('VOLCENGINE_BASE_URL')
    if (!env.VOLCENGINE_API_KEY) missing.push('VOLCENGINE_API_KEY')
    return missing
  }

  if (provider === 'openai') {
    return env.OPENAI_API_KEY ? [] : ['OPENAI_API_KEY']
  }

  return []
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env)

  let body: ChatRequestBody | undefined
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  if (!Array.isArray(body.messages)) {
    return jsonResponse({ error: 'Invalid messages' }, { status: 400, headers: corsHeaders })
  }

  const provider: ModelProvider =
    body.modelConfig?.provider ?? body.data?.provider ?? DEFAULT_MODEL_PROVIDER

  const modelId = body.modelConfig?.modelId ?? body.data?.modelId ?? getDefaultModelId(provider, env)

  if (!modelId) {
    return jsonResponse({ error: 'Missing modelId' }, { status: 400, headers: corsHeaders })
  }

  const missingEnv = validateProviderEnv(provider, env)
  if (missingEnv.length > 0) {
    return jsonResponse(
      {
        error: `Missing environment variables for provider: ${provider}`,
        missing: missingEnv,
        hint: '本地开发请在 apps/backend/.dev.vars 配置；部署请用 wrangler secret put。',
      },
      { status: 500, headers: corsHeaders },
    )
  }

  // 转换为模型消息格式
  const modelMessages = await convertToModelMessages(body.messages.map(({ id: _id, ...rest }) => rest))

  const result = await streamText({
    model: getModel({ provider, modelId, env }),
    messages: modelMessages,
    system: body.data?.systemPrompt ?? body.systemPrompt ?? '你是一个专业的后端智能体。',
  })

  // 转换为 UI 消息流响应
  const response = result.toUIMessageStreamResponse({
    originalMessages: body.messages,
  })

  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const corsHeaders = getCorsHeaders(request, env)
    const pathname = url.pathname.startsWith('/api/')
      ? url.pathname.slice('/api'.length)
      : url.pathname === '/api'
        ? '/'
        : url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (pathname === '/health') {
      return jsonResponse({ ok: true }, { status: 200, headers: corsHeaders })
    }

    if (pathname === '/chat' && request.method === 'POST') {
      try {
        return await handleChat(request, env)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error calling model API'
        return jsonResponse({ error: message }, { status: 500, headers: corsHeaders })
      }
    }

    return jsonResponse({ error: 'Not Found' }, { status: 404, headers: corsHeaders })
  },
}
