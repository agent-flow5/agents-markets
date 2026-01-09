import { jest } from '@jest/globals'

type MockedAI = {
  streamText: jest.Mock
  convertToModelMessages: jest.Mock
}

type MockedRegistry = {
  getModel: jest.Mock
}

type MockedAgents = {
  getAgentById: jest.Mock
  DEMO_AGENTS: Array<{
    id: string
    name: string
    modelId: string
    systemPrompt: string
    temperature: number
  }>
}

function makeUiStreamResponse(): Response {
  return new Response('data: {"type":"start","messageId":"m1"}\n\n', {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
  })
}

async function setupWorker(overrides?: {
  ai?: Partial<MockedAI>
  registry?: Partial<MockedRegistry>
  agents?: Partial<MockedAgents>
}) {
  const ai: MockedAI = {
    streamText: jest.fn(async () => ({
      toUIMessageStreamResponse: () => makeUiStreamResponse(),
    })),
    convertToModelMessages: jest.fn(async (messages: unknown) => messages),
    ...overrides?.ai,
  }

  const registry: MockedRegistry = {
    getModel: jest.fn(() => ({})),
    ...overrides?.registry,
  }

  const agents: MockedAgents = {
    getAgentById: jest.fn(() => undefined),
    DEMO_AGENTS: [
      {
        id: 'code-assistant',
        name: '代码助手',
        modelId: 'gpt-4o',
        systemPrompt: 'S',
        temperature: 0.2,
      },
    ],
    ...overrides?.agents,
  }

  jest.resetModules()

  jest.unstable_mockModule('ai', () => ({
    streamText: ai.streamText,
    convertToModelMessages: ai.convertToModelMessages,
  }))

  jest.unstable_mockModule('./lib/ai/registry', () => ({
    getModel: registry.getModel,
  }))

  jest.unstable_mockModule('./data/agents', () => ({
    getAgentById: agents.getAgentById,
    DEMO_AGENTS: agents.DEMO_AGENTS,
  }))

  const { default: worker } = await import('./index')
  return { worker, ai, registry, agents }
}

describe('workers backend', () => {
  test('GET /health returns ok', async () => {
    const { worker } = await setupWorker()
    const res = await worker.fetch(new Request('http://localhost/health'), {})
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  test('GET /api/health returns ok', async () => {
    const { worker } = await setupWorker()
    const res = await worker.fetch(new Request('http://localhost/api/health'), {})
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  test('OPTIONS returns 204 and CORS headers', async () => {
    const { worker } = await setupWorker()
    const req = new Request('http://localhost/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.com' },
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
  })

  test('POST /chat rejects invalid JSON', async () => {
    const { worker } = await setupWorker()
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body' })
  })

  test('POST /api/chat rejects invalid JSON', async () => {
    const { worker } = await setupWorker()
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body' })
  })

  test('POST /chat rejects missing messages array', async () => {
    const { worker } = await setupWorker()
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: 'nope' }),
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid messages' })
  })

  test('POST /chat rejects empty modelId', async () => {
    const { worker } = await setupWorker()
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        modelId: '',
      }),
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid modelId' })
  })

  test('POST /chat streams UI message protocol and applies CORS', async () => {
    const { worker, ai, registry } = await setupWorker({
      registry: {
        getModel: jest.fn(() => ({})),
      },
    })

    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: '你好' }] },
          { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: '...' }] },
        ],
        modelId: 'gpt-4o',
        systemPrompt: 'SYS',
      }),
    })

    const res = await worker.fetch(req, {
      CORS_ORIGIN: 'http://localhost:5173',
      VOLCENGINE_BASE_URL: 'http://example.com',
      VOLCENGINE_API_KEY: 'k',
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')

    const streamTextArgs = ai.streamText.mock.calls[0][0] as { system?: string; temperature?: number }
    expect(streamTextArgs.system).toBe('SYS')
    expect(streamTextArgs.temperature).toBeUndefined()
    expect(registry.getModel).toHaveBeenCalledWith('gpt-4o', expect.objectContaining({ CORS_ORIGIN: 'http://localhost:5173' }))

    const convertArgs = ai.convertToModelMessages.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(convertArgs[0]).toEqual({ role: 'user', parts: [{ type: 'text', text: '你好' }] })
    expect(convertArgs[0]).not.toHaveProperty('id')
  })

  test('POST /chat uses agent config when agentId provided', async () => {
    const { worker, ai, registry, agents } = await setupWorker({
      agents: {
        getAgentById: jest.fn(() => ({
          id: 'zh-translator',
          name: '中文翻译官',
          modelId: 'doubao-lite',
          systemPrompt: 'S',
          temperature: 0.7,
        })),
      },
      registry: {
        getModel: jest.fn(() => ({})),
      },
    })

    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        agentId: 'zh-translator',
      }),
    })

    const res = await worker.fetch(req, {
      VOLCENGINE_BASE_URL: 'http://example.com',
      VOLCENGINE_API_KEY: 'k',
    })
    expect(res.status).toBe(200)
    expect(agents.getAgentById).toHaveBeenCalledWith('zh-translator')
    expect(registry.getModel).toHaveBeenCalledWith('doubao-lite', expect.objectContaining({ VOLCENGINE_API_KEY: 'k' }))
    const streamTextArgs = ai.streamText.mock.calls[0][0] as { system?: string; temperature?: number }
    expect(streamTextArgs.system).toBe('S')
    expect(streamTextArgs.temperature).toBe(0.7)
  })

  test('POST /chat defaults to DEMO_AGENTS[0] when no agentId/modelId', async () => {
    const { worker, ai, registry } = await setupWorker({
      agents: {
        DEMO_AGENTS: [
          {
            id: 'code-assistant',
            name: '代码助手',
            modelId: 'gpt-4o',
            systemPrompt: 'SYS0',
            temperature: 0.1,
          },
        ],
      },
      registry: {
        getModel: jest.fn(() => ({})),
      },
    })

    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      }),
    })

    const res = await worker.fetch(req, {
      OPENAI_API_KEY: 'k',
    })
    expect(res.status).toBe(200)
    expect(registry.getModel).toHaveBeenCalledWith('gpt-4o', expect.objectContaining({ OPENAI_API_KEY: 'k' }))
    const streamTextArgs = ai.streamText.mock.calls[0][0] as { system?: string; temperature?: number }
    expect(streamTextArgs.system).toBe('SYS0')
    expect(streamTextArgs.temperature).toBe(0.1)
  })

  test('POST /chat rejects unknown agentId', async () => {
    const { worker } = await setupWorker({
      agents: {
        getAgentById: jest.fn(() => undefined),
      },
    })
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        agentId: 'missing-agent',
      }),
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Unknown agentId: missing-agent' })
  })

  test('POST /chat rejects unknown modelId', async () => {
    const { worker, registry } = await setupWorker({
      registry: {
        getModel: jest.fn(() => {
          throw new Error('Unknown modelId: nope. Available: gpt-4o, doubao-pro-32k, doubao-lite')
        }),
      },
    })
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        modelId: 'nope',
      }),
    })
    const res = await worker.fetch(req, {
      OPENAI_API_KEY: 'k',
    })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Unknown modelId: nope. Available: gpt-4o, doubao-pro-32k, doubao-lite',
    })
    expect(registry.getModel).toHaveBeenCalled()
  })

  test('POST /chat returns 500 with error message on model failure', async () => {
    const { worker } = await setupWorker({
      ai: {
        streamText: jest.fn(async () => {
          throw new Error('boom')
        }),
      },
    })
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      }),
    })
    const res = await worker.fetch(req, {
      VOLCENGINE_BASE_URL: 'http://example.com',
      VOLCENGINE_API_KEY: 'k',
    })
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'boom' })
  })

  test('throughput: handles 50 concurrent /health requests', async () => {
    const { worker } = await setupWorker()
    const start = performance.now()
    const results = await Promise.all(
      Array.from({ length: 50 }, () => worker.fetch(new Request('http://localhost/health'), {})),
    )
    const elapsed = performance.now() - start
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(elapsed).toBeLessThan(2000)
  })

  test('API.md exists and mentions /api/chat', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const apiPath = path.resolve(process.cwd(), 'API.md')
    const content = await fs.readFile(apiPath, 'utf8')
    expect(content).toContain('/api/chat')
  })
})
