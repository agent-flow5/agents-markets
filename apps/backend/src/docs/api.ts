import type { UIMessage } from "ai";

/**
 * 轻量 API Client（调用方视角）
 *
 * 目标：
 * - 让前端/脚本/另一个 AI 只看这一份文件，就能明确接口地址、入参、出参与错误处理方式
 * - 不引入额外运行时依赖：仅基于标准 fetch
 *
 * 注意：
 * - `/chat` 是流式响应（text/event-stream）。因此 `chat()` 返回原始 Response，交由调用方以流方式消费。
 * - 其它 JSON 接口（health/agents/healthcheck）会在非 2xx 时抛出 Error（message 来自后端 `{ error: string }`）。
 */
export type MarketApiClientOptions = {
  /**
   * API 基础地址（不含结尾路径）。
   *
   * 默认值：`https://market-api.singulay.online/api`
   *
   * 例：
   * - 本地：`http://localhost:3300/api`
   * - 线上：`https://market-api.singulay.online/api`
   */
  apiBaseUrl?: string;
  /**
   * 自定义 fetch 实现。
   *
   * 典型用途：
   * - Node 环境注入 polyfill（或在测试里 mock fetch）
   * - 统一增加超时、重试、日志等能力
   */
  fetchImpl?: typeof fetch;
  /**
   * 全局默认请求头（会与每次调用传入的 init.headers 合并）。
   *
   * 典型用途：
   * - 透传 Authorization（如果你未来给 Worker 加鉴权）
   * - 统一指定某些自定义 Header
   */
  headers?: HeadersInit;
};

/**
 * GET /health 的成功响应。
 */
export type HealthResponseBody = { ok: true };

/**
 * Worker 的通用错误响应（非流式接口最常见）。
 */
export type ErrorResponseBody = { error: string };

/**
 * GET /agents 返回的单个条目。
 *
 * 说明：
 * - 当前后端实现里 `id === modelId`（agent 列表由模型列表映射而来）
 * - 调用 /chat 时传 `modelId` 会使用该条目对应的默认 systemPrompt/temperature（可被请求体覆盖）
 */
export type AgentListItem = {
  id: string;
  name: string;
  modelId: string;
  systemPrompt: string;
  temperature: number;
};

/**
 * GET /agents 的响应体。
 */
export type AgentListResponseBody = {
  items: AgentListItem[];
};

/**
 * Provider 标识（与后端实现一致）。
 */
export type ProviderId = "openai" | "volcengine";

/**
 * GET /healthcheck 的响应体。
 *
 * - status=ok：检查成功，包含各 provider 是否配置、以及可用模型列表
 * - status=error：检查时抛错（返回 500），包含 message
 */
export type HealthcheckResponseBody =
  | {
      status: "ok";
      providers: Record<
        ProviderId,
        {
          configured: boolean;
          models: string[];
        }
      >;
      timestamp: string;
    }
  | {
      status: "error";
      message: string;
      providers: Record<
        ProviderId,
        {
          configured: false;
          models: never[];
        }
      >;
      timestamp: string;
    };

/**
 * POST /chat 的请求体（与后端实现对齐）。
 *
 * 字段优先级（后端实际逻辑）：
 * - modelId 不存在：默认使用后端内置列表的第一个 agent（AGENT_LIST[0]）
 * - modelId 存在：使用该 modelId，并尝试用 agent 列表匹配默认 systemPrompt/temperature
 *
 * 注意：
 * - `messages` 仅会被后端校验“是数组”，但随后会被 AI SDK 解析，因此请传入符合 UIMessage 协议的数据结构。
 * - `temperature` 后端会 clamp 到 0..2，非法值会视为未传。
 */
export type ChatRequestBody = {
  messages: UIMessage[];
  modelId?: string;
  systemPrompt?: string;
  temperature?: number;
};

/**
 * 拼接 baseUrl 与 path，确保不会出现重复 / 或遗漏 /。
 */
function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * 读取 JSON 并在非 2xx 时抛错。
 *
 * - 若响应体可解析为 `{ error: string }`，则优先使用该 error 作为异常信息
 * - 若无法解析 JSON，则回退为 `HTTP <status> <statusText>`
 */
async function readJsonOrThrow<T>(res: Response): Promise<T> {
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  if (!res.ok) {
    const error =
      typeof json === "object" && json !== null && "error" in json
        ? (json as { error?: unknown }).error
        : undefined;
    throw new Error(
      typeof error === "string" && error
        ? error
        : `HTTP ${res.status} ${res.statusText}`
    );
  }
  return json as T;
}

/**
 * 创建 Market API 客户端。
 *
 * 返回的方法说明：
 * - health/agents/healthcheck：成功返回解析后的 JSON；失败（非 2xx）直接 throw Error
 * - chat：返回原始 Response（因为它是流式 SSE；调用方自行消费 response.body）
 */
export function createMarketApiClient(options: MarketApiClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBaseUrl =
    options.apiBaseUrl ?? "https://market-api.singulay.online/api";
  const baseHeaders = options.headers;

  /**
   * GET JSON（非 2xx 会 throw）。
   */
  const get = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetchImpl(joinUrl(apiBaseUrl, path), {
      ...init,
      method: "GET",
      headers: { ...baseHeaders, ...init?.headers },
    });
    return readJsonOrThrow<T>(res);
  };

  /**
   * POST JSON（不自动解析响应，便于支持流式与非流式两种处理）。
   */
  const postJson = async (
    path: string,
    body: unknown,
    init?: RequestInit
  ): Promise<Response> => {
    const res = await fetchImpl(joinUrl(apiBaseUrl, path), {
      ...init,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...baseHeaders,
        ...init?.headers,
      },
      body: JSON.stringify(body),
    });
    return res;
  };

  return {
    /**
     * 透传最终使用的 baseUrl，便于调用方在日志/调试中输出。
     */
    apiBaseUrl,
    endpoints: {
      health: joinUrl(apiBaseUrl, "/health"),
      healthcheck: joinUrl(apiBaseUrl, "/healthcheck"),
      agents: joinUrl(apiBaseUrl, "/agents"),
      chat: joinUrl(apiBaseUrl, "/chat"),
    },
    /**
     * GET /health：探活接口。
     */
    health: () => get<HealthResponseBody>("/health"),
    /**
     * GET /healthcheck：检查 provider 配置与可用模型。
     */
    healthcheck: () => get<HealthcheckResponseBody>("/healthcheck"),
    /**
     * GET /agents：获取后端内置 agent 列表（用于选择 modelId）。
     */
    agents: () => get<AgentListResponseBody>("/agents"),
    /**
     * POST /chat：流式聊天接口。
     *
     * 返回值：
     * - 成功：`200 text/event-stream`，并包含 `x-vercel-ai-ui-message-stream: v1`
     * - 失败：通常为 `application/json { error: string }`
     *
     * 调用方建议：
     * - Web/React：优先使用 `@ai-sdk/react` + `DefaultChatTransport` 直接消费该 stream
     * - 自己处理 stream：读取 `response.body` 并按 SSE/DataStream 协议解析
     */
    chat: (body: ChatRequestBody, init?: RequestInit) =>
      postJson("/chat", body, init),
  };
}
