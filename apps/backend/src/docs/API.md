# Backend API（可直接交给另一个 AI 做接口对接/参数配置）

这份文档以“前端/调用方视角”描述接口：接口地址、入参、出参、错误码、以及推荐的调用方式与示例。

## 统一约定

### Base URL

本地（wrangler dev）：

- `http://localhost:3300/api`

线上（当前部署）：

- `https://market-api.singulay.online/api`

你给到的“完整 Chat 接口地址”为：

- `https://market-api.singulay.online/api/chat`

兼容性说明：

- Worker 同时支持无前缀与 `/api` 前缀：例如 `/chat` 与 `/api/chat` 都可用（推荐统一使用 `/api/*`）。

### Content-Type

- JSON 请求统一使用：`Content-Type: application/json`

### CORS

- 预检请求：任意路径的 `OPTIONS` 返回 `204`，并带上 CORS 相关响应头。
- 允许来源由环境变量 `CORS_ORIGIN` 控制：
  - 未配置或为空：允许任意来源（会回显请求的 `Origin`；没有 `Origin` 则返回 `*`）
  - 逗号分隔：例如 `https://a.com,https://b.com`
  - 含 `*`：允许任意来源（返回 `*`）

### 通用错误响应

除流式接口外，错误通常为 JSON：

```json
{ "error": "..." }
```

注意：

- 如果你在浏览器里直接访问 `https://market-api.singulay.online/api/chat`（GET 请求），会得到 `404 {"error":"Not Found"}`，因为 `/chat` 只支持 `POST`。

## GET /api/health

用途：探活。

### Request

- Method: `GET`
- Path: `/api/health`（也可用 `/health`）

### Response

- `200 application/json`

```json
{ "ok": true }
```

### curl

```bash
curl -sS https://market-api.singulay.online/api/health
```

## GET /api/agents

用途：获取后端内置的 agent 列表（实际上是“模型列表 + 默认 systemPrompt/temperature”）。

### Request

- Method: `GET`
- Path: `/api/agents`（也可用 `/agents`）

### Response

- `200 application/json`

```ts
export type AgentListItem = {
  id: string
  name: string
  modelId: string
  systemPrompt: string
  temperature: number
}

export type AgentListResponseBody = {
  items: AgentListItem[]
}
```

响应示例（节选）：

```json
{
  "items": [
    {
      "id": "doubao-pro-32k",
      "name": "中文长文本专家",
      "modelId": "doubao-pro-32k",
      "systemPrompt": "你是中文长文本处理专家，擅长分析、总结和创作长篇内容。回答时注重逻辑性和条理性，优先使用中文，必要时给出英文术语。",
      "temperature": 0.3
    }
  ]
}
```

### 重要规则

- `modelId` 的取值来自 `items[].modelId`（当前实现里 `id === modelId`）。
- 调用 `/api/chat` 时，传 `modelId` 会匹配该 agent 的默认 `systemPrompt/temperature`（可被请求体覆盖）。

### curl

```bash
curl -sS https://market-api.singulay.online/api/agents | head -n 50
```

## POST /api/agents

用途：创建一个自定义 Agent（指定 modelId + 自定义 systemPrompt/temperature），用于后续 /api/chat 调用。

### Request

- Method: `POST`
- Path: `/api/agents`（也可用 `/agents`）
- Headers: `Content-Type: application/json`

入参类型：

```ts
export type CreateAgentRequestBody = {
  name: string
  modelId: string
  systemPrompt: string
  temperature?: number
}
```

### Response

- `201 application/json`

返回体类型与 GET /api/agents 的单个条目一致：

```ts
export type CreateAgentResponseBody = AgentListItem
```

### 常见错误与状态码

- `400 Invalid JSON body`：请求体不是合法 JSON
- `400 Invalid name`：name 为空或全是空白
- `400 Invalid modelId`：modelId 为空或全是空白
- `400 Unknown modelId`：modelId 不在后端支持列表中
- `400 Invalid systemPrompt`：systemPrompt 为空或全是空白

### curl

```bash
curl -sS \
  -H 'Content-Type: application/json' \
  -d '{"name":"自定义助手","modelId":"gpt-4o","systemPrompt":"你是一个专业助手","temperature":0.5}' \
  https://market-api.singulay.online/api/agents
```

## GET /api/models

用途：获取“模型列表”（modelId + 能力 + 推荐用途 + 默认 Agent 配置），用于前端创建 Agent 时做模型选择与提示。

### Request

- Method: `GET`
- Path: `/api/models`（也可用 `/models`）

### Response

- `200 application/json`

```ts
export type ModelCapabilities = {
  streaming: boolean
  tools: boolean
  vision: boolean
  json: boolean
}

export type ModelListItem = {
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

export type ModelListResponseBody = {
  items: readonly ModelListItem[]
}
```

### curl

```bash
curl -sS https://market-api.singulay.online/api/models | head -n 80
```

## GET /api/healthcheck

用途：检查后端当前 Provider 的配置情况，以及可用的模型列表（按 provider 归类）。

### Request

- Method: `GET`
- Path: `/api/healthcheck`（也可用 `/healthcheck`）

### Response

- `200 application/json`（成功）
- `500 application/json`（检查过程抛错）

类型定义：

```ts
export type ProviderId = 'openai' | 'volcengine'

export type HealthcheckResponseBody =
  | {
      status: 'ok'
      providers: Record<
        ProviderId,
        { configured: boolean; models: string[] }
      >
      timestamp: string
    }
  | {
      status: 'error'
      message: string
      providers: Record<ProviderId, { configured: false; models: never[] }>
      timestamp: string
    }
```

成功响应示例（节选）：

```json
{
  "status": "ok",
  "providers": {
    "volcengine": { "configured": true, "models": ["doubao-pro-32k", "doubao-lite"] },
    "openai": { "configured": false, "models": [] }
  },
  "timestamp": "2026-01-20T12:00:00.000Z"
}
```

### curl

```bash
curl -sS https://market-api.singulay.online/api/healthcheck
```

## POST /api/chat

用途：发送一组 UIMessage（Vercel AI SDK/AI SDK 的 UI 消息协议），返回 UI message stream（SSE）。

### Request

- Method: `POST`
- Path: `/api/chat`（也可用 `/chat`）
- Headers: `Content-Type: application/json`

入参类型（与后端实现一致）：

```ts
import type { UIMessage } from 'ai'

export type ChatRequestBody = {
  messages: UIMessage[]
  modelId?: string
  systemPrompt?: string
  temperature?: number
}
```

字段语义与优先级：

- `messages`：必填。UIMessage 数组。后端只校验它是数组；但随后会被 AI SDK 解析，因此请使用 `ai` 包的 UIMessage 结构。
- `modelId`：可选。不传则默认选用 `AGENT_LIST[0]`（也就是后端内置列表的第一个 agent）。传了会尝试在 agent 列表中匹配默认 `systemPrompt/temperature`。
- `systemPrompt`：可选。若传入则覆盖默认 systemPrompt；若两者都没有，则默认 `"你是一个专业的通用智能体。"`。
- `temperature`：可选。有效范围 `0..2`，会被 clamp；非数字会被忽略（当作未传）。

特殊行为：

- 如果 `modelId` 以 `doubao-seedream-` 开头：后端会返回一个“正常的 UI stream”，但内容会说明该模型不支持对话接口（这是后端显式写死的提示）。

### Response

成功：

- `200 text/event-stream`
- 响应头包含：`x-vercel-ai-ui-message-stream: v1`
- Body：AI SDK UI message stream（可直接交给 `@ai-sdk/react` / `ai` 的 transport 消费）

失败（非流式）：

- `4xx/5xx application/json`

```json
{ "error": "..." }
```

### 常见错误与状态码

- `400 Invalid JSON body`：请求体不是合法 JSON
- `400 Invalid messages`：`messages` 不是数组
- `400 Invalid modelId`：`modelId` 是空字符串（例如 `""` 或 `"   "`）
- `400 Missing modelId`：没有 `modelId`，同时后端无法取默认 agent（理论上不会发生，除非内置 agent 列表为空）
- `400 Unknown modelId: ...`：`modelId` 不在后端注册表中（错误信息会包含可用列表）
- `404 Not Found`：路径不存在，或使用了不支持的方法（例如 GET /api/chat）
- `500 ...`：调用模型/Provider 发生异常（由 Worker 统一捕获返回）

### 示例 1：使用 `@ai-sdk/react`（推荐，直接消费后端 stream）

```ts
import { Chat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'

const chat = new Chat<UIMessage>({
  transport: new DefaultChatTransport({
    api: 'https://market-api.singulay.online/api/chat',
  }),
  messages: [],
})

await chat.sendMessage({
  id: 'u1',
  role: 'user',
  parts: [{ type: 'text', text: '你好' }],
})
```

### 示例 2：使用本仓库提供的轻量客户端（见 `src/docs/api.ts`）

```ts
import { createMarketApiClient } from './api'

const api = createMarketApiClient({
  apiBaseUrl: 'https://market-api.singulay.online/api',
})

const agents = await api.agents()
const firstAgent = agents.items[0]

const res = await api.chat({
  messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: '你好' }] }],
  modelId: firstAgent.modelId,
})

if (!res.ok) {
  const err = await res.json()
  throw new Error(err.error || `HTTP ${res.status}`)
}

console.log(res.headers.get('content-type'))
```

### 示例 3：curl（流式输出）

```bash
curl -N \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"你好"}]}]}' \
  https://market-api.singulay.online/api/chat
```
