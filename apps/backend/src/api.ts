import { convertToModelMessages, streamText } from "ai";
import { DEMO_AGENTS, getAgentById } from "./data/agents";
import { MODEL_LIST } from "./data/list";
import { getModel, type RegistryEnv } from "./lib/ai/registry";
import type { ChatRequestBody } from "./types/chat";

export type Env = RegistryEnv & {
  /**
   * 允许跨域请求的来源列表。
   * - 空字符串：允许任意来源（会回显请求的 Origin；无 Origin 则为 *）
   * - 逗号分隔：例如 "https://a.com,https://b.com"
   * - 包含 "*"：允许任意来源（返回 *）
   */
  CORS_ORIGIN?: string;
};

export type ModelListItem = {
  /**
   * UI 侧展示/排序使用的数字主键。
   * 注意：这不是模型调用的标识。
   */
  id: number;
  /**
   * 前端/接口侧使用的模型标识。
   * 前端仅需要将该值透传给 /chat。
   */
  modelId: string;
};

export type ModelListResponseBody = {
  /**
   * 后端内置模型列表（来自 MODEL_LIST）。
   * 前端只需要使用其中的 id 与 modelId。
   */
  items: ModelListItem[];
};

export function getCorsHeaders(
  request: Request,
  env: Env
): Record<string, string> {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigins = (env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigin =
    allowedOrigins.length === 0
      ? requestOrigin || "*"
      : allowedOrigins.includes("*")
      ? "*"
      : requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type"))
    headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function normalizeTemperature(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(2, value));
}

export async function handleModels(
  request: Request,
  env: Env
): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);

  const items: ModelListItem[] = MODEL_LIST.map((m) => ({
    id: m.id,
    modelId: m.modelId,
  }));

  const payload: ModelListResponseBody = { items };
  return jsonResponse(payload, { status: 200, headers: corsHeaders });
}

export async function handleChat(
  request: Request,
  env: Env
): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);

  let body: ChatRequestBody | undefined;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return jsonResponse(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!Array.isArray(body.messages)) {
    return jsonResponse(
      { error: "Invalid messages" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (typeof body.modelId === "string" && body.modelId.trim() === "") {
    return jsonResponse(
      { error: "Invalid modelId" },
      { status: 400, headers: corsHeaders }
    );
  }

  const agent = body.agentId
    ? getAgentById(body.agentId)
    : !body.modelId
    ? DEMO_AGENTS[0]
    : undefined;
  if (body.agentId && !agent) {
    return jsonResponse(
      { error: `Unknown agentId: ${body.agentId}` },
      { status: 400, headers: corsHeaders }
    );
  }

  const modelId = agent?.modelId ?? body.modelId;
  const systemPrompt =
    agent?.systemPrompt ?? body.systemPrompt ?? "你是一个专业的通用智能体。";
  const temperature = normalizeTemperature(
    agent?.temperature ?? body.temperature
  );

  if (!modelId)
    return jsonResponse(
      { error: "Missing modelId" },
      { status: 400, headers: corsHeaders }
    );

  const modelMessages = await convertToModelMessages(
    body.messages.map(({ id: _id, ...rest }) => rest)
  );

  let model: ReturnType<typeof getModel>;
  try {
    model = getModel(modelId, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid modelId";
    return jsonResponse(
      { error: message },
      { status: 400, headers: corsHeaders }
    );
  }

  const result = await streamText({
    model,
    messages: modelMessages,
    system: systemPrompt,
    temperature,
    maxRetries: 0,
    timeout: 60_000,
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: body.messages,
    onError: (error) => {
      if (error instanceof Error) return error.message;
      return "Unknown error";
    },
  });

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
