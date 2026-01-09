import React, { useEffect, useMemo, useState } from 'react'
import { Chat as AIChat, useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'

type TextPart = Extract<UIMessage['parts'][number], { type: 'text' }>

type ModelListItem = {
  id: number
  modelId: string
}

type ModelListResponseBody = {
  items: ModelListItem[]
}

function getTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function App() {
  const [input, setInput] = useState('')
  const [models, setModels] = useState<ModelListItem[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined)

  const chat = useMemo(() => {
    const api = (import.meta as { env?: Record<string, string> }).env?.VITE_BACKEND_CHAT_API
    return new AIChat<UIMessage>({
      transport: new DefaultChatTransport({
        api: api || 'http://localhost:3000/api/chat',
      }),
      messages: [],
    })
  }, [])

  const { messages, sendMessage, status } = useChat({ chat })

  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    const env = (import.meta as { env?: Record<string, string> }).env
    const chatApi = env?.VITE_BACKEND_CHAT_API || 'http://localhost:3000/api/chat'
    const modelsApi =
      env?.VITE_BACKEND_MODELS_API || chatApi.replace(/\/chat$/, '/models')

    let canceled = false
    void (async () => {
      const res = await fetch(modelsApi)
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as ModelListResponseBody
      if (canceled) return
      setModels(data.items)
      setSelectedModelId((prev) => prev || data.items[0]?.modelId)
    })()

    return () => {
      canceled = true
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    void sendMessage(
      { text },
      selectedModelId ? { body: { modelId: selectedModelId } } : undefined,
    )
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full flex">
        <aside className="w-72 border-r bg-white">
          <div className="px-4 py-3 border-b">
            <div className="text-sm font-semibold">可用 Models</div>
          </div>
          <div className="p-2 space-y-1">
            {models.map((m) => {
              const active = m.modelId === selectedModelId
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModelId(m.modelId)}
                  className={
                    'w-full text-left px-3 py-2 rounded-lg border ' +
                    (active ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-gray-50')
                  }
                >
                  <div className="text-sm font-medium">{m.modelId}</div>
                  <div className="text-xs text-gray-500">modelId: {m.modelId}</div>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="px-4 py-3 border-b bg-white flex items-center justify-between">
            <h1 className="text-lg font-semibold">AI Chat</h1>
            <div className="text-sm text-gray-600">
              当前模型：<span className="font-medium">{selectedModelId || '-'}</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m: UIMessage) => (
              <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={
                    'inline-block rounded-2xl px-4 py-2 max-w-[75%] ' +
                    (m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border')
                  }
                >
                  <ReactMarkdown>{getTextFromParts(m.parts)}</ReactMarkdown>
                </div>
              </div>
            ))}
          </main>
          <footer className="p-4 bg-white border-t">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息，支持 Markdown"
                className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                发送
              </button>
            </form>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
