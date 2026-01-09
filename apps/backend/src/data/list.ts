export type ProviderId = "openai" | "volcengine";

export type ModelCatalogItem = {
  id: number; // 数字主键：用于 UI 排序、展示或内部引用（与 modelId 不同）
  model: string; // 真实模型名：OpenAI 填模型字符串；火山一般走 endpoint（这里用 'endpoint' 表示）
  modelId: string; // 业务侧模型标识：你在智能体/请求体里传的 modelId（建议与对象 key 一致）
  name: string; // 推荐的人设/用途名称：用于创建智能体时的默认角色名
  provider: ProviderId; // 模型提供商
  displayName: string; // 展示名：用于下拉列表、卡片标题等
  systemPrompt: string; // 默认 system 提示词：创建智能体时可直接复用/覆盖
  temperature: number; // 默认温度：创建智能体时可作为默认采样参数
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

export const MODEL_LIST = [
  // ==========================================
  // 火山引擎 Doubao 系列
  // ==========================================
  {
    id: 1,
    model: "endpoint",
    modelId: "doubao-pro-32k",
    name: "中文长文本专家",
    provider: "volcengine",
    displayName: "Doubao Pro 32k",
    systemPrompt: "你是中文长文本处理专家，擅长分析、总结和创作长篇内容。回答时注重逻辑性和条理性，优先使用中文，必要时给出英文术语。",
    temperature: 0.3,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DOUBAO_PRO" },
  },

  // ==========================================
  // 火山引擎 DeepSeek R1 系列 - 超强推理模型
  // ==========================================
  {
    id: 2,
    model: "endpoint",
    modelId: "deepseek-r1-math",
    name: "数学解题专家",
    provider: "volcengine",
    displayName: "DeepSeek R1 - 数学",
    systemPrompt: "你是数学解题专家，擅长解决各类数学问题。回答时：\n1. 先理解题目，明确已知条件和求解目标\n2. 给出清晰的解题思路和步骤\n3. 使用 LaTeX 公式展示计算过程\n4. 验证答案的合理性\n5. 必要时提供多种解法",
    temperature: 0.1,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_R1" },
  },
  {
    id: 3,
    model: "endpoint",
    modelId: "deepseek-r1-code",
    name: "代码调试专家",
    provider: "volcengine",
    displayName: "DeepSeek R1 - 代码",
    systemPrompt: "你是代码调试和优化专家，擅长发现bug、性能瓶颈和设计问题。回答时：\n1. 仔细分析代码逻辑和潜在问题\n2. 指出错误原因和改进建议\n3. 提供优化后的代码示例\n4. 解释为什么这样修改更好\n5. 考虑边界情况和性能影响",
    temperature: 0.1,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_R1" },
  },
  {
    id: 4,
    model: "endpoint",
    modelId: "deepseek-r1-logic",
    name: "逻辑推理助手",
    provider: "volcengine",
    displayName: "DeepSeek R1 - 推理",
    systemPrompt: "你是逻辑推理专家，擅长分析复杂问题、找出逻辑漏洞、推导结论。回答时：\n1. 明确前提和假设\n2. 展示完整的推理链条\n3. 识别可能的谬误和不合理之处\n4. 给出严谨的论证过程\n5. 提供多角度的思考方式",
    temperature: 0.15,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_R1" },
  },

  // ==========================================
  // 火山引擎 DeepSeek V3 系列 - 通用平衡模型
  // ==========================================
  {
    id: 5,
    model: "endpoint",
    modelId: "deepseek-v3-general",
    name: "日常问答助手",
    provider: "volcengine",
    displayName: "DeepSeek V3 - 通用",
    systemPrompt: "你是日常问答助手，能够高效处理各类常见问题。回答简洁明了，既保证准确性又注重实用性。适合日常咨询、信息查询和一般性建议。",
    temperature: 0.4,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_V3" },
  },
  {
    id: 6,
    model: "endpoint",
    modelId: "deepseek-v3-writer",
    name: "中文写作助手",
    provider: "volcengine",
    displayName: "DeepSeek V3 - 写作",
    systemPrompt: "你是专业的中文写作助手，擅长各类文体创作和改写。能帮助用户：\n1. 撰写各类文章（说明文、议论文、叙事文等）\n2. 润色和优化文字表达\n3. 提供写作思路和大纲\n4. 改写和扩写内容\n5. 校对语法和用词",
    temperature: 0.6,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_V3" },
  },
  {
    id: 7,
    model: "endpoint",
    modelId: "deepseek-v3-agent",
    name: "智能Agent助手",
    provider: "volcengine",
    displayName: "DeepSeek V3 - Agent",
    systemPrompt: "你是智能Agent助手，能够理解复杂任务并分步执行。擅长：\n1. 任务拆解和规划\n2. 多步骤问题解决\n3. 信息整合和总结\n4. 工具调用和协作\n5. 持续对话和上下文理解",
    temperature: 0.3,
    supports: { streaming: true, tools: true, vision: false, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_V3" },
  },

  // ==========================================
  // 火山引擎 Doubao Seedream 系列 - 图像生成模型
  // ==========================================
  {
    id: 8,
    model: "endpoint",
    modelId: "doubao-seedream-artist",
    name: "AI绘画创作师",
    provider: "volcengine",
    displayName: "Seedream 4.5 - 绘画",
    systemPrompt: "你是AI绘画创作师，精通图像生成和艺术创作。你能：\n1. 理解用户的创作意图，生成高质量图像\n2. 提供专业的构图、配色和风格建议\n3. 支持文生图、图生图、多图融合\n4. 精准控制画面细节（人脸、小字、排版等）\n5. 帮助用户实现艺术创意和视觉表达",
    temperature: 0.7,
    supports: { streaming: true, tools: true, vision: true, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DOUBAO_SEEDREAM" },
  },
  {
    id: 9,
    model: "endpoint",
    modelId: "doubao-seedream-designer",
    name: "UI设计助手",
    provider: "volcengine",
    displayName: "Seedream 4.5 - 设计",
    systemPrompt: "你是UI/UX设计助手，专注于界面和视觉设计。你能帮助：\n1. 生成界面设计稿和原型\n2. 提供配色方案和排版建议\n3. 创建图标、插图和视觉元素\n4. 优化用户体验和视觉层次\n5. 生成多种设计方案供选择",
    temperature: 0.6,
    supports: { streaming: true, tools: true, vision: true, json: true },
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DOUBAO_SEEDREAM" },
  },

  // ==========================================
  // OpenAI 系列（保留原有配置）
  // ==========================================
  {
    id: 10,
    model: "gpt-4o",
    modelId: "gpt-4o",
    name: "英语辅导老师",
    provider: "openai",
    displayName: "GPT-4o",
    systemPrompt: "你是一个专业的英语辅导老师智能体，输出标准的英语语法、词汇和句子结构。而且可以批改学生的英语作文。",
    temperature: 0.3,
    supports: { streaming: true, tools: true, vision: true, json: true },
  },
  {
    id: 11,
    model: "gpt-4o-mini",
    modelId: "gpt-4o-mini",
    name: "高效通用助手",
    provider: "openai",
    displayName: "GPT-4o mini",
    systemPrompt: "你是高效的助手，优先给出简洁可执行的答案。",
    temperature: 0.4,
    supports: { streaming: true, tools: true, vision: true, json: true },
  },
] as const satisfies readonly ModelCatalogItem[];

export type ModelId = (typeof MODEL_LIST)[number]["modelId"];
