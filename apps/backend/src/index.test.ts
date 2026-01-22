import { jest } from '@jest/globals'

type MockedAI = {
  streamText: jest.Mock
  convertToModelMessages: jest.Mock
  createUIMessageStream: jest.Mock
  createUIMessageStreamResponse: jest.Mock
}

type MockedRegistry = {
  getModel: jest.Mock
}

type AgentConfig = {
  id: string
  name: string
  modelId: string
  systemPrompt: string
  temperature: number
}

type CreateAgentInput = {
  name: string
  modelId: string
  systemPrompt: string
  temperature?: number
}

type MockedAgents = {
  listAgents: () => AgentConfig[]
  createAgent: (input: CreateAgentInput) => AgentConfig
  AGENT_LIST: AgentConfig[]
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
    createUIMessageStream: jest.fn(() => new ReadableStream()),
    createUIMessageStreamResponse: jest.fn(() => makeUiStreamResponse()),
    ...overrides?.ai,
  }

  const registry: MockedRegistry = {
    getModel: jest.fn(() => ({})),
    ...overrides?.registry,
  }

  const defaultAgentList = overrides?.agents?.AGENT_LIST ?? [
    {
      id: 'code-assistant',
      name: '代码助手',
      modelId: 'gpt-4o',
      systemPrompt: 'S',
      temperature: 0.2,
    },
  ]

  const agents: MockedAgents = {
    AGENT_LIST: defaultAgentList,
    listAgents: overrides?.agents?.listAgents ?? jest.fn(() => defaultAgentList),
    createAgent:
      overrides?.agents?.createAgent ??
      jest.fn(() => {
        throw new Error('Not implemented')
      }),
  }

  jest.resetModules()

  jest.unstable_mockModule('ai', () => ({
    streamText: ai.streamText,
    convertToModelMessages: ai.convertToModelMessages,
    createUIMessageStream: ai.createUIMessageStream,
    createUIMessageStreamResponse: ai.createUIMessageStreamResponse,
  }))

  jest.unstable_mockModule('./lib/ai/registry', () => ({
    getModel: registry.getModel,
  }))

  jest.unstable_mockModule('./data/agents', () => ({
    listAgents: agents.listAgents,
    createAgent: agents.createAgent,
    AGENT_LIST: agents.AGENT_LIST,
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

  test('GET /agents returns agents list', async () => {
    const { worker } = await setupWorker()
    const res = await worker.fetch(new Request('http://localhost/agents'), {})
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: Array<{ id: string; modelId: string; name: string; systemPrompt: string; temperature: number }>
    }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.some((i) => i.modelId === 'gpt-4o')).toBe(true)
    expect(new Set(body.items.map((i) => i.id)).size).toBe(body.items.length)
  })

  test('GET /api/agents returns agents list', async () => {
    const { worker } = await setupWorker()
    const res = await worker.fetch(new Request('http://localhost/api/agents'), {})
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: Array<{ id: string; modelId: string; name: string; systemPrompt: string; temperature: number }>
    }
    expect(body.items.some((i) => i.modelId === 'gpt-4o')).toBe(true)
    expect(new Set(body.items.map((i) => i.id)).size).toBe(body.items.length)
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
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body，请求体必须是 JSON 格式' })
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
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body，请求体必须是 JSON 格式' })
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
    await expect(res.json()).resolves.toEqual({ error: 'Invalid messages，messages 必须是数组' })
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
    await expect(res.json()).resolves.toEqual({ error: 'Invalid modelId，modelId 不能为空' })
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
        temperature: 0.2,
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
    expect(streamTextArgs.temperature).toBe(0.2)
    expect(registry.getModel).toHaveBeenCalledWith('gpt-4o', expect.objectContaining({ CORS_ORIGIN: 'http://localhost:5173' }))

    const convertArgs = ai.convertToModelMessages.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(convertArgs[0]).toEqual({ role: 'user', parts: [{ type: 'text', text: '你好' }] })
    expect(convertArgs[0]).not.toHaveProperty('id')
  })

  test('POST /chat rejects missing systemPrompt', async () => {
    const { worker } = await setupWorker()
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        modelId: 'gpt-4o',
        temperature: 0.2,
      }),
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid systemPrompt，systemPrompt 不能为空' })
  })

  test('POST /chat defaults temperature to 0.3 when missing', async () => {
    const { worker, ai, registry } = await setupWorker({
      registry: {
        getModel: jest.fn(() => ({})),
      },
    })
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        modelId: 'gpt-4o',
        systemPrompt: 'SYS',
      }),
    })
    const res = await worker.fetch(req, { OPENAI_API_KEY: 'k' })
    expect(res.status).toBe(200)
    expect(registry.getModel).toHaveBeenCalledWith('gpt-4o', expect.any(Object))

    const streamTextArgs = ai.streamText.mock.calls[0][0] as { temperature?: number }
    expect(streamTextArgs.temperature).toBe(0.3)
  })

  test('POST /chat defaults modelId to doubao-pro-32k when missing', async () => {
    const { worker, registry } = await setupWorker({
      registry: {
        getModel: jest.fn(() => ({})),
      },
    })

    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        systemPrompt: 'SYS',
        temperature: 0.2,
      }),
    })

    const res = await worker.fetch(req, {
      VOLCENGINE_BASE_URL: 'http://example.com',
      VOLCENGINE_API_KEY: 'k',
    })
    expect(res.status).toBe(200)
    expect(registry.getModel).toHaveBeenCalledWith('doubao-pro-32k', expect.any(Object))
  })

  test('GET /models returns model list', async () => {
    const { worker } = await setupWorker()
    const res = await worker.fetch(new Request('http://localhost/models'), {})
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: Array<{ modelId: string; displayName: string }> }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.some((m) => m.modelId === 'gpt-4o')).toBe(true)
  })

  test('POST /agents creates agent', async () => {
    const dynamicAgents = [
      {
        id: 'code-assistant',
        name: '代码助手',
        modelId: 'gpt-4o',
        systemPrompt: 'S',
        temperature: 0.2,
      },
    ]

    const { worker } = await setupWorker({
      agents: {
        AGENT_LIST: dynamicAgents,
        listAgents: jest.fn(() => dynamicAgents),
        createAgent: jest.fn((input: CreateAgentInput) => {
          const { name, modelId, systemPrompt, temperature } = input
          const created = {
            id: 'a1',
            name,
            modelId,
            systemPrompt,
            temperature: temperature ?? 0.7,
          }
          dynamicAgents.unshift(created)
          return created
        }),
      },
    })

    const req = new Request('http://localhost/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '自定义助手',
        modelId: 'gpt-4o',
        systemPrompt: 'SYS',
        temperature: 0.5,
      }),
    })

    const res = await worker.fetch(req, {})
    expect(res.status).toBe(201)
    const created = (await res.json()) as { id: string; name: string }
    expect(created.id).toBe('a1')
    expect(created.name).toBe('自定义助手')

    const listRes = await worker.fetch(new Request('http://localhost/agents'), {})
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as { items: Array<{ id: string }> }
    expect(listBody.items.some((a) => a.id === 'a1')).toBe(true)
  })

  test('POST /agents rejects invalid JSON body', async () => {
    const { worker } = await setupWorker()
    const req = new Request('http://localhost/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body，请求体必须是 JSON 格式' })
  })

  test('POST /agents rejects invalid fields', async () => {
    const { worker } = await setupWorker({
      agents: {
        createAgent: jest.fn(() => {
          throw new Error('Invalid name')
        }),
      },
    })
    const req = new Request('http://localhost/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        modelId: 'gpt-4o',
        systemPrompt: 'S',
      }),
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid name' })
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
        systemPrompt: 'SYS',
        temperature: 0.2,
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
      registry: {
        getModel: jest.fn(() => ({})),
      },
    })
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        modelId: 'gpt-4o',
        systemPrompt: 'SYS',
        temperature: 0.2,
      }),
    })
    const res = await worker.fetch(req, {
      OPENAI_API_KEY: 'k',
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
    const url = await import('node:url')
    const apiPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), 'docs', 'API.md')
    const content = await fs.readFile(apiPath, 'utf8')
    expect(content).toContain('/api/chat')
  })
})

describe('providers', () => {
  test('getProviders does not require OPENAI_API_KEY unless openai is used', async () => {
    const { getProviders } = await import('./lib/ai/providers')
    const providers = getProviders({
      VOLCENGINE_BASE_URL: 'http://example.com',
      VOLCENGINE_API_KEY: 'k',
    })
    expect(() => providers.volcengine()).not.toThrow()
    expect(() => providers.openai()).toThrow(/OPENAI_API_KEY/)
  })
})
