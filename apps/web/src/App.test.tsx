import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UIMessage } from 'ai'

let mockMessages: UIMessage[] = []
let mockStatus: 'ready' | 'submitted' | 'streaming' = 'ready'
const mockSendMessage = vi.fn()

vi.mock('@ai-sdk/react', () => {
  return {
    Chat: class {
      constructor(_: unknown) { }
    },
    useChat: () => ({
      messages: mockMessages,
      sendMessage: mockSendMessage,
      status: mockStatus,
    }),
  }
})

import App from './App'

beforeEach(() => {
  mockMessages = []
  mockStatus = 'ready'
  mockSendMessage.mockReset()
  globalThis.fetch = vi.fn(async () => {
    return new Response(
      JSON.stringify({
        items: [
          { id: 1, modelId: 'gpt-4o' },
          { id: 2, modelId: 'doubao-lite' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as unknown as typeof fetch
})

describe('App', () => {
  it('sends message and clears input', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findAllByText('gpt-4o')
    const input = screen.getByPlaceholderText('输入消息，支持 Markdown')
    await user.type(input, 'hello')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).toHaveBeenCalledWith(
      { text: 'hello' },
      { body: { modelId: 'gpt-4o' } },
    )
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('disables send button while streaming', async () => {
    mockStatus = 'streaming'
    const user = userEvent.setup()
    render(<App />)

    const button = screen.getByRole('button', { name: '发送' })
    expect(button).toBeDisabled()

    const input = screen.getByPlaceholderText('输入消息，支持 Markdown')
    await user.type(input, 'hello')
    await user.click(button)
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('renders markdown content from message parts', () => {
    mockMessages = [
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'text', text: '**bold**' }],
      },
    ] as unknown as UIMessage[]

    render(<App />)
    expect(screen.getByText('bold')).toBeInTheDocument()
  })
})
