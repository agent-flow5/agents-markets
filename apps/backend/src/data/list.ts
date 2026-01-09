import { DEMO_AGENTS } from "./agents";

export type ProviderId = "openai" | "volcengine";

export type ModelCatalogItem = {
  id: number; // 数字主键：用于 UI 排序、展示或内部引用（与 modelId 不同）
  model: string; // 真实模型名：OpenAI 填模型字符串；火山一般走 endpoint（这里用 'endpoint' 表示）
  modelId: string; // 业务侧模型标识：你在智能体/请求体里传的 modelId（建议与对象 key 一致）
  name: string; // 推荐的人设/用途名称：用于创建智能体时的默认角色名
  provider: ProviderId; // 模型提供商
  displayName: string; // 展示名：用于下拉列表、卡片标题等
  systemPrompt: string; // 默认 system 提示词：创建智能体时可直接复用/覆盖
  defaultTemperature: number; // 默认温度：创建智能体时可作为默认采样参数
  // 能力开关：用于 UI/逻辑层决定是否允许某些功能
  supports: {
    streaming: boolean; // 是否支持流式输出（SSE/DataStream）
    tools: boolean; // 是否支持工具/函数调用（tool calling）
    vision: boolean; // 是否支持图片输入（多模态）
    json: boolean; // 是否支持 JSON 约束输出（结构化响应）
  };
  // 火山引擎相关配置（仅当 provider=volcengine 时可能存在）
  volcengine?: {
    endpointIdEnv?: string; // endpointId 对应的环境变量名（例如 VOLCENGINE_MODEL_DOUBAO_PRO）
  };
};

export const MODEL_CATALOG = {
  "doubao-pro-32k": {
    id: 1,
    model: "endpoint",
    modelId: "doubao-pro-32k",
    name: "中文专家助手",
    provider: "volcengine",
    displayName: "Doubao Pro 32k",
    systemPrompt: "你是中文专家助手，优先使用中文回答，必要时给出英文术语。",
    defaultTemperature: 0.3,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DOUBAO_PRO" },
  },
  "doubao-lite": {
    id: 2,
    model: "endpoint",
    modelId: "doubao-lite",
    name: "中文助手",
    provider: "volcengine",
    displayName: "Doubao Lite",
    systemPrompt: "你是中文助手，回复简洁直接。",
    defaultTemperature: 0.4,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DOUBAO_LITE" },
  },
  "doubao-pro": {
    id: 3,
    model: "endpoint",
    modelId: "doubao-pro",
    name: "中文专家助手（自定义 Endpoint）",
    provider: "volcengine",
    displayName: "Doubao Pro (自定义 Endpoint)",
    systemPrompt: "你是中文专家助手，按步骤给出分析与可执行结论。",
    defaultTemperature: 0.3,
    supports: { streaming: true, tools: true, vision: false, json: true },
  },
  "doubao-lite-vision": {
    id: 4,
    model: "endpoint",
    modelId: "doubao-lite-vision",
    name: "多模态中文助手（自定义 Endpoint）",
    provider: "volcengine",
    displayName: "Doubao Lite Vision (自定义 Endpoint)",
    systemPrompt: "你能理解图片与文本，结合上下文给出准确回答。",
    defaultTemperature: 0.3,
    supports: { streaming: true, tools: true, vision: true, json: true },
  },
  "gpt-4o": {
    id: 5,
    model: "gpt-4o",
    modelId: "gpt-4o",
    name: "英语辅导老师",
    provider: "openai",
    displayName: "GPT-4o",
    systemPrompt:
      "你是一个专业的英语辅导老师智能体，输出标准的英语语法、词汇和句子结构。而且可以批改学生的英语作文。",
    defaultTemperature: 0.3,
    supports: { streaming: true, tools: true, vision: true, json: true },
  },
  "gpt-4o-mini": {
    id: 6,
    model: "gpt-4o-mini",
    modelId: "gpt-4o-mini",
    name: "高效通用助手",
    provider: "openai",
    displayName: "GPT-4o mini",
    systemPrompt: "你是高效的助手，优先给出简洁可执行的答案。",
    defaultTemperature: 0.4,
    supports: { streaming: true, tools: true, vision: true, json: true },
  },
  "gpt-4.1": {
    id: 7,
    model: "gpt-4.1",
    modelId: "gpt-4.1",
    name: "严谨专家助手",
    provider: "openai",
    displayName: "GPT-4.1",
    systemPrompt: "你是严谨的专家助手，先澄清约束，再给出方案。",
    defaultTemperature: 0.2,
    supports: { streaming: true, tools: true, vision: true, json: true },
  },
  "gpt-4.1-mini": {
    id: 8,
    model: "gpt-4.1-mini",
    modelId: "gpt-4.1-mini",
    name: "高性价比助手",
    provider: "openai",
    displayName: "GPT-4.1 mini",
    systemPrompt: "你是高性价比助手，注重正确性与速度的平衡。",
    defaultTemperature: 0.3,
    supports: { streaming: true, tools: true, vision: true, json: true },
  },
  "gpt-4.1-nano": {
    id: 9,
    model: "gpt-4.1-nano",
    modelId: "gpt-4.1-nano",
    name: "快速抽取助手",
    provider: "openai",
    displayName: "GPT-4.1 nano",
    systemPrompt: "你擅长超短回复与快速分类/抽取任务。",
    defaultTemperature: 0.3,
    supports: { streaming: true, tools: true, vision: false, json: true },
  },
  "o3-mini": {
    id: 10,
    model: "o3-mini",
    modelId: "o3-mini",
    name: "推理助手",
    provider: "openai",
    displayName: "o3-mini",
    systemPrompt: "你是推理型助手，给出关键推导与最终结论。",
    defaultTemperature: 0.2,
    supports: { streaming: true, tools: true, vision: false, json: true },
  },
  "o1-mini": {
    id: 11,
    model: "o1-mini",
    modelId: "o1-mini",
    name: "推理助手（精简）",
    provider: "openai",
    displayName: "o1-mini",
    systemPrompt: "你是推理型助手，优先给出正确答案与简短解释。",
    defaultTemperature: 0.2,
    supports: { streaming: true, tools: true, vision: false, json: true },
  },
} satisfies Record<string, ModelCatalogItem>;

export type ModelId = keyof typeof MODEL_CATALOG;

export function getModelCatalogItem(
  modelId: string
): ModelCatalogItem | undefined {
  return (MODEL_CATALOG as Record<string, ModelCatalogItem>)[modelId];
}

const list: ModelCatalogItem[] = Object.values(MODEL_CATALOG).sort(
  (a, b) => a.id - b.id
);

const maxId = list.reduce((acc, item) => Math.max(acc, item.id), 0);

const agentsList: ModelCatalogItem[] = DEMO_AGENTS.map((agent, index) => {
  const existing = getModelCatalogItem(agent.modelId);
  if (existing) {
    return {
      ...existing,
      id: maxId + index + 1,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      defaultTemperature: agent.temperature,
    };
  }

  const provider: ProviderId =
    agent.modelId.startsWith("gpt-") || agent.modelId.startsWith("o")
      ? "openai"
      : "volcengine";

  return {
    id: maxId + index + 1,
    model: provider === "openai" ? agent.modelId : "endpoint",
    modelId: agent.modelId,
    name: agent.name,
    provider,
    displayName: agent.modelId,
    systemPrompt: agent.systemPrompt,
    defaultTemperature: agent.temperature,
    supports: { streaming: true, tools: true, vision: false, json: true },
  };
});

export const MODEL_LIST: ModelCatalogItem[] = [...list, ...agentsList];
