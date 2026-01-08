# Agents Market（前后端分离版 AI Chat）

本仓库采用「Vite 前端 + NestJS 后端」的前后端分离架构：

- 前端只负责 UI、消息状态、读取流式输出
- 后端负责鉴权/业务逻辑/调用大模型，并把流通过 HTTP 返回给前端

## 目录结构

- [apps/web](file:///Users/ashy/Documents/code/agents-market/apps/web)：React + Vite 前端（默认 `http://localhost:5173`）
- [apps/backend](file:///Users/ashy/Documents/code/agents-market/apps/backend)：NestJS 后端（默认 `http://localhost:3000`）

## 环境变量

在仓库根目录创建 `.env`（参考 [.env.example](file:///Users/ashy/Documents/code/agents-market/.env.example)）：

- 火山引擎（默认 provider）：
  - `VOLCENGINE_API_KEY`
  - `VOLCENGINE_BASE_URL`（例：`https://ark.cn-beijing.volces.com/api/v3`）
  - `VOLCENGINE_MODEL_DOUBAO_LITE` 或 `VOLCENGINE_MODEL_DOUBAO_PRO`（Endpoint ID，如 `ep-xxxx`）
- OpenAI（当 provider=openai 时使用）：
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL_ID`（可选，默认 `gpt-4o-mini`）
- 后端运行配置：
  - `BACKEND_PORT`（默认 3000）
  - `CORS_ORIGIN`（默认 `http://localhost:5173`）

## 启动

安装依赖：

```bash
npm install
```

启动后端（NestJS）：

```bash
npm run dev:backend
```

启动前端（Vite）：

```bash
npm run dev:web
```

访问前端：

- <http://localhost:5173/>

## API

### POST /chat

后端接口：`http://localhost:3000/chat`

前端通过 `@ai-sdk/react` 的 `DefaultChatTransport` 发送 UIMessage 数组，后端会：

1. 将 UIMessage 转为模型消息（ModelMessage）
2. 调用 `streamText`
3. 使用 `pipeUIMessageStreamToResponse` 以 SSE 形式把 UI message stream 推给前端

默认行为：

- 未传 `provider/modelId` 时，默认使用火山引擎（`volcengine`）
- 未传 `modelId` 时，默认优先使用 `VOLCENGINE_MODEL_DOUBAO_LITE`，其次 `VOLCENGINE_MODEL_DOUBAO_PRO`

请求体示例（可选指定模型）：

```json
{
  "messages": [
    { "id": "1", "role": "user", "parts": [{ "type": "text", "text": "你好" }] }
  ],
  "data": {
    "provider": "volcengine",
    "modelId": "ep-20240604-xxxx"
  }
}
```

## 常用命令

```bash
npm run typecheck:web
npm run typecheck:backend
npm run build:web
npm run build -w apps/backend
```
