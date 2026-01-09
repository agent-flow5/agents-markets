import { getCorsHeaders, handleChat, handleModels, jsonResponse, type Env } from "./api";

// Worker 入口（Cloudflare Workers）
// - GET  /health       健康检查
// - GET  /models       获取后端内置模型列表（前端只用 id/modelId）
// - POST /chat         发送聊天消息，返回 UI 消息流（SSE）
//
// 同时支持 /api 前缀（例如 /api/chat、/api/models）。

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);
    const pathname = url.pathname.startsWith("/api/")
      ? url.pathname.slice("/api".length)
      : url.pathname === "/api"
      ? "/"
      : url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (pathname === "/health") {
      return jsonResponse({ ok: true }, { status: 200, headers: corsHeaders });
    }

    if (pathname === "/models" && request.method === "GET") {
      try {
        return await handleModels(request, env);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error listing models";
        return jsonResponse(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (pathname === "/chat" && request.method === "POST") {
      try {
        return await handleChat(request, env);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error calling model API";
        return jsonResponse(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return jsonResponse(
      { error: "Not Found" },
      { status: 404, headers: corsHeaders }
    );
  },
};
