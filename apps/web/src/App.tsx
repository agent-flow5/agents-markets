import React, { useMemo, useState } from 'react'
import { Chat as AIChat, useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'

type TextPart = Extract<UIMessage['parts'][number], { type: 'text' }>

function getTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function App() {
  const [input, setInput] = useState('')

  const chat = useMemo(() => {
    const api = (import.meta as { env?: Record<string, string> }).env?.VITE_BACKEND_CHAT_API
    return new AIChat<UIMessage>({
      transport: new DefaultChatTransport({
        api: api || 'http://localhost:3000/chat',
      }),
      messages: [],
    })
  }, [])

  const { messages, sendMessage, status } = useChat({ chat })

  const isLoading = status === 'submitted' || status === 'streaming'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    void sendMessage({ text })
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <header className="px-4 py-3 border-b bg-white">
          <h1 className="text-lg font-semibold">AI Chat</h1>
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
  )
}

export default App
