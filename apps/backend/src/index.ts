import { convertToModelMessages, streamText } from 'ai'
import { DEMO_AGENTS, getAgentById } from './data/agents'
import { getModel, type RegistryEnv } from './lib/ai/registry'
import type { ChatRequestBody } from './types/chat'

type Env = RegistryEnv & {
  CORS_ORIGIN?: string
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const requestOrigin = request.headers.get('Origin')
  const allowedOrigins = (env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const allowedOrigin =
    allowedOrigins.length === 0
      ? requestOrigin || '*'
      : allowedOrigins.includes('*')
        ? '*'
        : requestOrigin && allowedOrigins.includes(requestOrigin)
          ? requestOrigin
          : allowedOrigins[0]

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

function normalizeTemperature(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined
  if (Number.isNaN(value)) return undefined
  return Math.max(0, Math.min(2, value))
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

  if (typeof body.modelId === 'string' && body.modelId.trim() === '') {
    return jsonResponse({ error: 'Invalid modelId' }, { status: 400, headers: corsHeaders })
  }

  const agent = body.agentId ? getAgentById(body.agentId) : !body.modelId ? DEMO_AGENTS[0] : undefined
  if (body.agentId && !agent) {
    return jsonResponse({ error: `Unknown agentId: ${body.agentId}` }, { status: 400, headers: corsHeaders })
  }
  const modelId = agent?.modelId ?? body.modelId
  const systemPrompt = agent?.systemPrompt ?? body.systemPrompt ?? '你是一个专业的后端智能体。'
  const temperature = normalizeTemperature(agent?.temperature ?? body.temperature)

  if (!modelId) return jsonResponse({ error: 'Missing modelId' }, { status: 400, headers: corsHeaders })

  // 转换为模型消息格式
  const modelMessages = await convertToModelMessages(body.messages.map(({ id: _id, ...rest }) => rest))

  let model: ReturnType<typeof getModel>
  try {
    model = getModel(modelId, env)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid modelId'
    return jsonResponse({ error: message }, { status: 400, headers: corsHeaders })
  }

  const result = await streamText({ model, messages: modelMessages, system: systemPrompt, temperature })

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
