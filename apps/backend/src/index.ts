import {
  getCorsHeaders,
  handleAgents,
  handleChat,
  handleCreateAgent,
  handleHealthcheck,
  handleModels,
  jsonResponse,
  type Env,
} from "./api";

// Worker 入口（Cloudflare Workers）
// - GET  /health       健康检查
// - GET  /agents       获取后端内置 agents 列表
// - POST /chat         发送聊天消息，返回 UI 消息流（SSE）
//
// 同时支持 /api 前缀（例如 /api/chat、/api/agents）。

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);
    const pathname = url.pathname.startsWith("/api/")
      ? url.pathname.slice("/api".length)
      : url.pathname === "/api"
      ? "/"
      : url.pathname;

    // 处理 CORS 预检请求（浏览器在跨域 POST/带自定义头时会先发 OPTIONS）
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // GET /health：简单健康检查（不依赖外部服务），用于快速探活
    if (pathname === "/health") {
      return jsonResponse({ ok: true }, { status: 200, headers: corsHeaders });
    }

    // GET /healthcheck：更完整的健康检查（可能包含对模型/上游的连通性检查）
    if (pathname === "/healthcheck" && request.method === "GET") {
      try {
        return await handleHealthcheck(request, env);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Healthcheck failed，健康检查失败";
        return jsonResponse(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // GET /agents：返回后端内置的 agents 列表（用于前端选择/展示）
    if (pathname === "/agents" && request.method === "GET") {
      try {
        return await handleAgents(request, env);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error listing agents，列出 agents 时出错";
        return jsonResponse(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // POST /agents：创建/保存自定义 agent（供后续对话使用或持久化）
    if (pathname === "/agents" && request.method === "POST") {
      try {
        return await handleCreateAgent(request, env);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error creating agent，创建 agent 时出错";
        return jsonResponse(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // GET /models：返回可用模型列表（用于前端下拉选择）
    if (pathname === "/models" && request.method === "GET") {
      try {
        return await handleModels(request, env);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error listing models，列出模型时出错";
        return jsonResponse(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // POST /chat：聊天接口（SSE 流式返回），由 handleChat 负责与模型交互并组装流
    if (pathname === "/chat" && request.method === "POST") {
      try {
        return await handleChat(request, env);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error calling model API，调用模型 API 时出错";
        return jsonResponse(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // 兜底：未匹配到任何路由
    return jsonResponse(
      { error: "Not Found，未匹配到任何路由" },
      { status: 404, headers: corsHeaders }
    );
  },
};
