# Backend API（前端使用最小集）

## Base URL

默认本地：

- `http://localhost:3000/api`

说明：

- 为兼容旧调用，`/health` 与 `/chat` 仍可用；推荐统一使用 `/api/*`

## CORS

后端会根据 `CORS_ORIGIN` 进行跨域放行（本地默认 `http://localhost:5173`）。

## GET /api/health

用于探活。

**Response**

```json
{ "ok": true }
```

## POST /api/chat

前端通过 `@ai-sdk/react` 发送 UIMessage 数组，后端会返回 AI SDK UI message stream（SSE）。

### Request Type

```ts
import type { UIMessage } from 'ai'

export type ModelProvider = 'openai' | 'volcengine'

export type ModelConfig = {
  provider: ModelProvider
  modelId: string
}

export type ChatRequestBody = {
  messages: UIMessage[]
  modelConfig?: ModelConfig
  data?: {
    provider?: ModelProvider
    modelId?: string
    systemPrompt?: string
  }
  systemPrompt?: string
}
```

### Response

- 成功：`text/event-stream`（AI SDK UI message stream），响应头包含 `x-vercel-ai-ui-message-stream: v1`
- 失败：`application/json`，形如：

```json
{ "error": "..." }
```

### Frontend Example

```ts
import { Chat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'

const chat = new Chat<UIMessage>({
  transport: new DefaultChatTransport({
    api: 'http://localhost:3000/api/chat',
  }),
  messages: [],
})
```

### curl 示例

```bash
curl -N \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"你好"}]}]}' \
  http://localhost:3000/api/chat
```

## Model Selection

默认 provider 为 `volcengine`。

- 未传 `provider/modelId`：后端会按顺序取默认模型：
  - `VOLCENGINE_MODEL_DOUBAO_LITE`
  - `VOLCENGINE_MODEL_DOUBAO_PRO`
- 也可在请求里传 `data.provider` / `data.modelId` 或 `modelConfig.provider` / `modelConfig.modelId`
