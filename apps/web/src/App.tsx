import React, { useEffect, useMemo, useState } from 'react'
import { Chat as AIChat, useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import {
  loadConversationHistory,
  saveConversationHistory,
  deleteConversationHistory
} from './utils/storage'

type Agent = {
  id: string
  modelId: string
  name: string
  systemPrompt: string
  temperature: number
}

type AgentListResponse = {
  items: Agent[]
}

type ModelCapabilities = {
  streaming: boolean
  tools: boolean
  vision: boolean
  json: boolean
}

type ModelListItem = {
  id: number
  modelId: string
  provider: 'openai' | 'volcengine'
  displayName: string
  summary: string
  recommendedFor: readonly string[]
  capabilities: ModelCapabilities
  defaultAgent: {
    name: string
    systemPrompt: string
    temperature: number
  }
}

type ModelListResponse = {
  items: ModelListItem[]
}

function App() {
  const backendApiUrl = import.meta.env?.VITE_BACKEND_CHAT_API || '/api/chat'

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [models, setModels] = useState<ModelListItem[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createModelId, setCreateModelId] = useState('')
  const [createSystemPrompt, setCreateSystemPrompt] = useState('')
  const [createTemperature, setCreateTemperature] = useState(0.7)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Initialize chat
  const chat = useMemo(() => {
    return new AIChat<UIMessage>({
      transport: new DefaultChatTransport({ api: backendApiUrl }),
      messages: [],
    })
  }, [backendApiUrl])

  const { messages, setMessages, sendMessage, status } = useChat({ chat })
  const isLoading = status === 'submitted' || status === 'streaming'

  // Load agents from backend
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agentsApi = backendApiUrl.replace('/chat', '/agents')
        const response = await fetch(agentsApi)
        if (!response.ok) throw new Error('Failed to load agents')
        const data: AgentListResponse = await response.json()
        setAgents(data.items)

        setSelectedAgentId(data.items[0]?.id || null)
      } catch (error) {
        console.error('Failed to load agents:', error)
      }
    }
    void loadAgents()
  }, [backendApiUrl])

  // Load models from backend
  useEffect(() => {
    const loadModels = async () => {
      try {
        const modelsApi = backendApiUrl.replace('/chat', '/models')
        const response = await fetch(modelsApi)
        if (!response.ok) throw new Error('Failed to load models')
        const data: ModelListResponse = await response.json()
        setModels(data.items)
      } catch (error) {
        console.error('Failed to load models:', error)
      }
    }
    void loadModels()
  }, [backendApiUrl])

  // Load conversation history when switching agents
  useEffect(() => {
    if (selectedAgentId) {
      const history = loadConversationHistory(selectedAgentId)
      setMessages(history.messages || [])
    }
  }, [selectedAgentId, setMessages])

  // Save messages to localStorage
  useEffect(() => {
    if (selectedAgentId && messages.length > 0) {
      saveConversationHistory(selectedAgentId, {
        messages,
        updatedAt: Date.now(),
      })
    }
  }, [messages, selectedAgentId])

  // Handle send message
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading || !selectedAgentId) return

    const agent = agents.find((a) => a.id === selectedAgentId)
    if (!agent) return

    setInput('')
    void sendMessage(
      { text },
      {
        body: {
          modelId: agent.modelId,
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature,
        },
      }
    )
  }

  // Handle clear conversation
  const handleClear = () => {
    if (selectedAgentId) {
      deleteConversationHistory(selectedAgentId)
      setMessages([])
    }
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId)
  const selectedCreateModel = models.find((m) => m.modelId === createModelId) || null

  const openCreate = () => {
    setCreateError(null)
    setIsCreateOpen(true)
    setCreateName('')
    setCreateModelId('')
    setCreateSystemPrompt('')
    setCreateTemperature(0.7)
  }

  const closeCreate = () => {
    if (isCreating) return
    setIsCreateOpen(false)
  }

  const applyModelDefaults = (modelId: string) => {
    const m = models.find((x) => x.modelId === modelId)
    if (!m) return
    setCreateName(m.defaultAgent.name)
    setCreateSystemPrompt(m.defaultAgent.systemPrompt)
    setCreateTemperature(m.defaultAgent.temperature)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isCreating) return
    setCreateError(null)

    const name = createName.trim()
    const modelId = createModelId.trim()
    const systemPrompt = createSystemPrompt.trim()

    if (!name) return setCreateError('请输入 Agent 名称')
    if (!modelId) return setCreateError('请选择模型')
    if (!systemPrompt) return setCreateError('请输入系统提示词')

    const agentsApi = backendApiUrl.replace('/chat', '/agents')
    setIsCreating(true)
    try {
      const res = await fetch(agentsApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          modelId,
          systemPrompt,
          temperature: createTemperature,
        }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error || '创建失败')
      }

      const created = (await res.json()) as Agent

      const listRes = await fetch(agentsApi)
      if (listRes.ok) {
        const data: AgentListResponse = await listRes.json()
        setAgents(data.items)
      }

      setSelectedAgentId(created.id)
      setIsCreateOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建失败'
      setCreateError(message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b bg-white">
        <h1 className="text-lg font-semibold">AI Chat</h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Agent List Sidebar */}
        <aside className="w-80 border-r bg-white overflow-y-auto">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">可用 Agents</h2>
              <button
                onClick={openCreate}
                className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                新建
              </button>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  agent.id === selectedAgentId
                    ? 'bg-blue-50 border-l-4 border-blue-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">{agent.name}</div>
                <div className="text-xs text-gray-500">{agent.modelId}</div>
              </button>
            ))}
          </div>
        </aside>

        {isCreateOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold">创建 Agent</h2>
                <button
                  onClick={closeCreate}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
                <div className="space-y-4">
                  {createError && (
                    <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{createError}</div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">使用模型 *</label>
                    <select
                      value={createModelId}
                      onChange={(e) => {
                        const v = e.target.value
                        setCreateModelId(v)
                        setCreateError(null)
                        applyModelDefaults(v)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      required
                    >
                      <option value="">选择模型...</option>
                      {models
                        .slice()
                        .sort((a, b) => a.id - b.id)
                        .map((m) => (
                          <option key={m.modelId} value={m.modelId}>
                            {m.displayName} ({m.modelId})
                          </option>
                        ))}
                    </select>

                    {selectedCreateModel && (
                      <div className="mt-2 p-3 rounded border border-gray-200 bg-gray-50 text-sm">
                        <div className="font-medium mb-1">{selectedCreateModel.summary}</div>
                        <div className="text-gray-600">
                          适合：{selectedCreateModel.recommendedFor.join(' / ')}
                        </div>
                        <div className="text-gray-600 mt-1">
                          能力：流式 {selectedCreateModel.capabilities.streaming ? '✓' : '✗'} · 工具{' '}
                          {selectedCreateModel.capabilities.tools ? '✓' : '✗'} · 视觉{' '}
                          {selectedCreateModel.capabilities.vision ? '✓' : '✗'} · JSON{' '}
                          {selectedCreateModel.capabilities.json ? '✓' : '✗'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Agent 名称 *</label>
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="例如：专业代码助手"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">系统提示 (System Prompt) *</label>
                    <textarea
                      value={createSystemPrompt}
                      onChange={(e) => setCreateSystemPrompt(e.target.value)}
                      placeholder="例如：你是一个专业的代码助手，擅长解决编程问题..."
                      rows={7}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      温度 (Temperature): {createTemperature.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={createTemperature}
                      onChange={(e) => setCreateTemperature(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      控制回答的随机性。0 = 更确定，2 = 更随机创造
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeCreate}
                    disabled={isCreating}
                    className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {isCreating ? '创建中...' : '创建'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <main className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-medium mb-2">
                    {selectedAgent?.name || '选择一个 Agent 开始对话'}
                  </div>
                  <div className="text-sm">
                    {selectedAgent?.systemPrompt || '从左侧选择一个 agent'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`rounded-lg px-4 py-2 max-w-[75%] ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <ReactMarkdown>
                        {message.parts
                          .filter((p) => p.type === 'text')
                          .map((p: any) => p.text)
                          .join('')}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Input Area */}
          <footer className="border-t bg-white p-4">
            <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
              <span>当前 Agent: {selectedAgent?.name || '未选择'}</span>
              <button
                onClick={handleClear}
                className="ml-auto text-blue-600 hover:text-blue-800"
              >
                新对话
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息，支持 Markdown"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? '发送中...' : '发送'}
              </button>
            </form>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
