import { jest } from '@jest/globals'

type MockedAI = {
  streamText: jest.Mock
  convertToModelMessages: jest.Mock
}

type MockedModels = {
  DEFAULT_MODEL_PROVIDER: 'volcengine'
  getDefaultModelId: jest.Mock
  getModel: jest.Mock
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
  models?: Partial<MockedModels>
}) {
  const ai: MockedAI = {
    streamText: jest.fn(async () => ({
      toUIMessageStreamResponse: () => makeUiStreamResponse(),
    })),
    convertToModelMessages: jest.fn(async (messages: unknown) => messages),
    ...overrides?.ai,
  } as unknown as MockedAI

  const models: MockedModels = {
    DEFAULT_MODEL_PROVIDER: 'volcengine',
    getDefaultModelId: jest.fn(() => 'ep-test'),
    getModel: jest.fn(() => ({})),
    ...overrides?.models,
  } as unknown as MockedModels

  jest.resetModules()

  jest.unstable_mockModule('ai', () => ({
    streamText: ai.streamText,
    convertToModelMessages: ai.convertToModelMessages,
  }))

  jest.unstable_mockModule('./ai/models', () => ({
    DEFAULT_MODEL_PROVIDER: models.DEFAULT_MODEL_PROVIDER,
    getDefaultModelId: models.getDefaultModelId,
    getModel: models.getModel,
  }))

  const { default: worker } = await import('./index')
  return { worker, ai, models }
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

  test('POST /chat rejects empty modelId when provided explicitly', async () => {
    const { worker } = await setupWorker()
    const req = new Request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        modelConfig: { provider: 'volcengine', modelId: '' },
      }),
    })
    const res = await worker.fetch(req, {})
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Missing modelId' })
  })

  test('POST /chat streams UI message protocol and applies CORS', async () => {
    const { worker, ai, models } = await setupWorker({
      models: {
        getDefaultModelId: jest.fn(() => 'ep-abc'),
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
        data: { systemPrompt: 'SYS' },
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
    expect(models.getDefaultModelId).toHaveBeenCalledWith(
      'volcengine',
      expect.objectContaining({ CORS_ORIGIN: 'http://localhost:5173' }),
    )

    const streamTextArgs = ai.streamText.mock.calls[0][0] as { system?: string }
    expect(streamTextArgs.system).toBe('SYS')
    expect(models.getModel).toHaveBeenCalledWith({
      provider: 'volcengine',
      modelId: 'ep-abc',
      env: expect.objectContaining({ CORS_ORIGIN: 'http://localhost:5173' }),
    })

    const convertArgs = ai.convertToModelMessages.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(convertArgs[0]).toEqual({ role: 'user', parts: [{ type: 'text', text: '你好' }] })
    expect(convertArgs[0]).not.toHaveProperty('id')
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

  test('docs mention endpoints implemented by worker', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const readmePath = path.resolve(process.cwd(), '..', '..', 'README.md')
    const content = await fs.readFile(readmePath, 'utf8')
    expect(content).toContain('GET /health')
    expect(content).toContain('POST /chat')
  })
})
