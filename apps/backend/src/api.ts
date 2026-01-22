import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { createAgent, listAgents } from "./data/agents";
import { MODEL_LIST, modelList } from "./data/list";
import { getModel, type RegistryEnv } from "./lib/ai/registry";
import { checkProviderConfiguration } from "./lib/ai/providers";
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

export type AgentListItem = {
  id: string;
  name: string;
  modelId: string;
  systemPrompt: string;
  temperature: number;
};

export type AgentListResponseBody = {
  items: AgentListItem[];
};

export type ModelListItem = (typeof modelList)[number];

export type ModelListResponseBody = {
  items: readonly ModelListItem[];
};

export type CreateAgentRequestBody = {
  name: string;
  modelId: string;
  systemPrompt: string;
  temperature?: number;
};

export type CreateAgentResponseBody = AgentListItem;

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

export async function handleAgents(
  request: Request,
  env: Env
): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);

  const items: AgentListItem[] = listAgents().map((a) => ({
    id: a.id,
    modelId: a.modelId,
    name: a.name,
    systemPrompt: a.systemPrompt,
    temperature: a.temperature,
  }));

  const payload: AgentListResponseBody = { items };
  return jsonResponse(payload, { status: 200, headers: corsHeaders });
}

export async function handleModels(
  request: Request,
  env: Env
): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);
  const payload: ModelListResponseBody = { items: modelList };
  return jsonResponse(payload, { status: 200, headers: corsHeaders });
}

export async function handleCreateAgent(
  request: Request,
  env: Env
): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);

  let body: CreateAgentRequestBody | undefined;
  try {
    body = (await request.json()) as CreateAgentRequestBody;
  } catch {
    return jsonResponse(
      { error: "Invalid JSON body，请求体必须是 JSON 格式" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const created = createAgent({
      name: body.name,
      modelId: body.modelId,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature,
    });

    const payload: CreateAgentResponseBody = {
      id: created.id,
      name: created.name,
      modelId: created.modelId,
      systemPrompt: created.systemPrompt,
      temperature: created.temperature,
    };
    return jsonResponse(payload, { status: 201, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request，检查请求体是否正确";
    return jsonResponse({ error: message }, { status: 400, headers: corsHeaders });
  }
}

export async function handleHealthcheck(
  request: Request,
  env: Env
): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const providerStatus = checkProviderConfiguration(env);

    // Get available models for each provider
    const volcengineModels = providerStatus.volcengine.configured
      ? MODEL_LIST.filter((m) => m.provider === "volcengine").map((m) => m.modelId)
      : [];

    const openaiModels = providerStatus.openai.configured
      ? MODEL_LIST.filter((m) => m.provider === "openai").map((m) => m.modelId)
      : [];

    const payload = {
      status: "ok" as const,
      providers: {
        volcengine: {
          configured: providerStatus.volcengine.configured,
          models: volcengineModels,
        },
        openai: {
          configured: providerStatus.openai.configured,
          models: openaiModels,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return jsonResponse(payload, { status: 200, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Healthcheck failed，检查配置是否正确";
    return jsonResponse(
      {
        status: "error" as const,
        message,
        providers: {
          volcengine: { configured: false, models: [] },
          openai: { configured: false, models: [] },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: corsHeaders }
    );
  }
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
      { error: "Invalid JSON body，请求体必须是 JSON 格式" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!Array.isArray(body.messages)) {
    return jsonResponse(
      { error: "Invalid messages，messages 必须是数组" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (body.modelId !== undefined) {
    if (typeof body.modelId !== "string" || body.modelId.trim() === "") {
      return jsonResponse(
        { error: "Invalid modelId，modelId 不能为空" },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  const modelId = (body.modelId ?? "doubao-pro-32k").trim();

  if (typeof body.systemPrompt !== "string" || body.systemPrompt.trim() === "") {
    return jsonResponse(
      { error: "Invalid systemPrompt，systemPrompt 不能为空" },
      { status: 400, headers: corsHeaders }
    );
  }

  const temperature = normalizeTemperature(body.temperature ?? 0.3);
  if (temperature === undefined) {
    return jsonResponse(
      { error: "Invalid temperature，temperature 必须是 0 到 2 之间的数字" },
      { status: 400, headers: corsHeaders }
    );
  }

  const systemPrompt = body.systemPrompt.trim();

  if (modelId.startsWith("doubao-seedream-")) {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        writer.write({ type: "text-start", id });
        writer.write({
          type: "text-delta",
          id,
          delta:
            "你选择的是 Seedream 图像生成模型，它不支持 /api/chat 的对话接口，所以这次请求会失败。\n\n" +
            "如果你想“AI 绘画创作”，需要走单独的“文生图/图生图”接口（不是 chat completion）。目前这个后端只实现了对话流式接口。\n\n" +
            "建议：先换用文字类模型（如 deepseek-v3-* 或 gpt-4o*）来生成绘画提示词；等后端加上图像生成接口后，再接入 Seedream。",
        });
        writer.write({ type: "text-end", id });
      },
    });

    const response = createUIMessageStreamResponse({ stream });
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders))
      headers.set(key, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const modelMessages = await convertToModelMessages(
    body.messages.map(({ id: _id, ...rest }) => rest)
  );

  let model: ReturnType<typeof getModel>;
  try {
    model = getModel(modelId, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid modelId，modelId 不存在";
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
