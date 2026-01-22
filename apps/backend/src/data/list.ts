export type ProviderId = "openai" | "volcengine";

export enum ModelIdEnum {
  DoubaoPro32k = "doubao-pro-32k",
  DeepSeekR1Math = "deepseek-r1-math",
  DeepSeekR1Code = "deepseek-r1-code",
  DeepSeekR1Logic = "deepseek-r1-logic",
  DeepSeekV3General = "deepseek-v3-general",
  DeepSeekV3Writer = "deepseek-v3-writer",
  DeepSeekV3Agent = "deepseek-v3-agent",
  DoubaoSeedreamArtist = "doubao-seedream-artist",
  DoubaoSeedreamDesigner = "doubao-seedream-designer",
  Gpt4o = "gpt-4o",
  Gpt4oMini = "gpt-4o-mini",
}

export type ModelId = `${ModelIdEnum}`;

export type ModelCapabilities = {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  json: boolean;
};

export type ModelListItem = {
  id: number;
  modelId: ModelId;
  provider: ProviderId;
  displayName: string;
  summary: string;
  recommendedFor: readonly string[];
  capabilities: ModelCapabilities;
  defaultAgent: {
    name: string;
    systemPrompt: string;
    temperature: number;
  };
};

export const modelList = [
  {
    id: 1,
    modelId: ModelIdEnum.DoubaoPro32k,
    provider: "volcengine",
    displayName: "Doubao Pro 32k",
    summary: "中文长文本分析/总结/创作，适合长上下文与结构化输出。",
    recommendedFor: ["长文总结", "报告撰写", "知识整理", "复杂说明文"] as const,
    capabilities: { streaming: true, tools: true, vision: false, json: true },
    defaultAgent: {
      name: "中文长文本专家",
      systemPrompt:
        "你是中文长文本处理专家，擅长分析、总结和创作长篇内容。回答时注重逻辑性和条理性，优先使用中文，必要时给出英文术语。",
      temperature: 0.3,
    },
  },
  {
    id: 111,
    modelId: ModelIdEnum.DoubaoPro32k,
    provider: "volcengine",
    displayName: "Doubao Pro 32k",
    summary: "语言学家 Agent",
    recommendedFor: ["长文总结", "报告撰写", "知识整理", "复杂说明文"] as const,
    capabilities: { streaming: true, tools: true, vision: false, json: true },
    defaultAgent: {
      name: " 语言学家 Agent",
      systemPrompt:
        "你是各种语言处理专家，擅长分析、总结和创作长篇内容。回答时注重逻辑性和条理性，优先使用中文，必要时给出英文术语。回答时根据用户需求，揣测用户意图，引导用户进行回答.",
      temperature: 0.3,
    },
  },
  {
    id: 2,
    modelId: ModelIdEnum.DeepSeekR1Math,
    provider: "volcengine",
    displayName: "DeepSeek R1 - 数学",
    summary: "强推理，适合数学推导、证明、严谨步骤与验算。",
    recommendedFor: ["数学题", "公式推导", "证明", "严谨解题步骤"] as const,
    capabilities: { streaming: true, tools: true, vision: false, json: true },
    defaultAgent: {
      name: "数学解题专家",
      systemPrompt:
        "你是数学解题专家，擅长解决各类数学问题。回答时：\n1. 先理解题目，明确已知条件和求解目标\n2. 给出清晰的解题思路和步骤\n3. 使用 LaTeX 公式展示计算过程\n4. 验证答案的合理性\n5. 必要时提供多种解法",
      temperature: 0.1,
    },
  },
  {
    id: 3,
    modelId: ModelIdEnum.DeepSeekR1Code,
    provider: "volcengine",
    displayName: "DeepSeek R1 - 代码",
    summary: "强推理，适合阅读工程代码、定位 bug、给出重构与性能建议。",
    recommendedFor: ["代码审查", "Bug 定位", "重构建议", "性能优化"] as const,
    capabilities: { streaming: true, tools: true, vision: false, json: true },
    defaultAgent: {
      name: "代码调试专家",
      systemPrompt:
        "你是代码调试和优化专家，擅长发现bug、性能瓶颈和设计问题。回答时：\n1. 仔细分析代码逻辑和潜在问题\n2. 指出错误原因和改进建议\n3. 提供优化后的代码示例\n4. 解释为什么这样修改更好\n5. 考虑边界情况和性能影响",
      temperature: 0.1,
    },
  },
  {
    id: 4,
    modelId: ModelIdEnum.DeepSeekR1Logic,
    provider: "volcengine",
    displayName: "DeepSeek R1 - 推理",
    summary: "强逻辑推理，适合论证、拆解复杂问题、识别漏洞与给出结论。",
    recommendedFor: ["逻辑推演", "论证与反驳", "复杂问题拆解", "决策分析"] as const,
    capabilities: { streaming: true, tools: true, vision: false, json: true },
    defaultAgent: {
      name: "逻辑推理助手",
      systemPrompt:
        "你是逻辑推理专家，擅长分析复杂问题、找出逻辑漏洞、推导结论。回答时：\n1. 明确前提和假设\n2. 展示完整的推理链条\n3. 识别可能的谬误和不合理之处\n4. 给出严谨的论证过程\n5. 提供多角度的思考方式",
      temperature: 0.15,
    },
  },
  {
    id: 5,
    modelId: ModelIdEnum.DeepSeekV3General,
    provider: "volcengine",
    displayName: "DeepSeek V3 - 通用",
    summary: "通用均衡，适合日常问答、信息检索式对话与一般任务咨询。",
    recommendedFor: ["日常问答", "知识解释", "轻量写作", "头脑风暴"] as const,
    capabilities: { streaming: true, tools: true, vision: false, json: true },
    defaultAgent: {
      name: "日常问答助手",
      systemPrompt:
        "你是日常问答助手，能够高效处理各类常见问题。回答简洁明了，既保证准确性又注重实用性。适合日常咨询、信息查询和一般性建议。",
      temperature: 0.4,
    },
  },
  {
    id: 6,
    modelId: ModelIdEnum.DeepSeekV3Writer,
    provider: "volcengine",
    displayName: "DeepSeek V3 - 写作",
    summary: "偏表达与文风，适合中文写作、润色、扩写与改写。",
    recommendedFor: ["文章润色", "文案写作", "扩写改写", "风格调整"] as const,
    capabilities: { streaming: true, tools: true, vision: false, json: true },
    defaultAgent: {
      name: "中文写作助手",
      systemPrompt:
        "你是专业的中文写作助手，擅长各类文体创作和改写。能帮助用户：\n1. 撰写各类文章（说明文、议论文、叙事文等）\n2. 润色和优化文字表达\n3. 提供写作思路和大纲\n4. 改写和扩写内容\n5. 校对语法和用词",
      temperature: 0.6,
    },
  },
  {
    id: 7,
    modelId: ModelIdEnum.DeepSeekV3Agent,
    provider: "volcengine",
    displayName: "DeepSeek V3 - Agent",
    summary: "偏任务执行，适合任务拆解、多步执行、工具协作式对话。",
    recommendedFor: ["任务规划", "步骤化执行", "工作流拆解", "多轮协作"] as const,
    capabilities: { streaming: true, tools: true, vision: false, json: true },
    defaultAgent: {
      name: "智能Agent助手",
      systemPrompt:
        "你是智能Agent助手，能够理解复杂任务并分步执行。擅长：\n1. 任务拆解和规划\n2. 多步骤问题解决\n3. 信息整合和总结\n4. 工具调用和协作\n5. 持续对话和上下文理解",
      temperature: 0.3,
    },
  },
  {
    id: 8,
    modelId: ModelIdEnum.DoubaoSeedreamArtist,
    provider: "volcengine",
    displayName: "Seedream 4.5 - 绘画",
    summary: "图像生成（文生图/图生图）；不支持 /api/chat 对话流式。",
    recommendedFor: ["文生图", "图生图", "艺术创作", "风格化设计"] as const,
    capabilities: { streaming: true, tools: true, vision: true, json: true },
    defaultAgent: {
      name: "AI绘画创作师",
      systemPrompt:
        "你是AI绘画创作师，精通图像生成和艺术创作。你能：\n1. 理解用户的创作意图，生成高质量图像\n2. 提供专业的构图、配色和风格建议\n3. 支持文生图、图生图、多图融合\n4. 精准控制画面细节（人脸、小字、排版等）\n5. 帮助用户实现艺术创意和视觉表达",
      temperature: 0.7,
    },
  },
  {
    id: 9,
    modelId: ModelIdEnum.DoubaoSeedreamDesigner,
    provider: "volcengine",
    displayName: "Seedream 4.5 - 设计",
    summary: "图像生成（界面/海报/视觉设计）；不支持 /api/chat 对话流式。",
    recommendedFor: ["UI 设计稿", "海报", "视觉素材", "配色/排版"] as const,
    capabilities: { streaming: true, tools: true, vision: true, json: true },
    defaultAgent: {
      name: "UI设计助手",
      systemPrompt:
        "你是UI/UX设计助手，专注于界面和视觉设计。你能帮助：\n1. 生成界面设计稿和原型\n2. 提供配色方案和排版建议\n3. 创建图标、插图和视觉元素\n4. 优化用户体验和视觉层次\n5. 生成多种设计方案供选择",
      temperature: 0.6,
    },
  },
  {
    id: 10,
    modelId: ModelIdEnum.Gpt4o,
    provider: "openai",
    displayName: "GPT-4o",
    summary: "高质量多模态通用，适合复杂问题与视觉输入。",
    recommendedFor: ["复杂问答", "多模态理解", "高质量输出", "严谨表达"] as const,
    capabilities: { streaming: true, tools: true, vision: true, json: true },
    defaultAgent: {
      name: "英语辅导老师",
      systemPrompt:
        "你是一个专业的英语辅导老师智能体，输出标准的英语语法、词汇和句子结构。而且可以批改学生的英语作文。",
      temperature: 0.3,
    },
  },
  {
    id: 11,
    modelId: ModelIdEnum.Gpt4oMini,
    provider: "openai",
    displayName: "GPT-4o mini",
    summary: "更快更省的通用模型，适合高频日常问答与轻量任务。",
    recommendedFor: ["高频问答", "轻量写作", "头脑风暴", "快速草稿"] as const,
    capabilities: { streaming: true, tools: true, vision: true, json: true },
    defaultAgent: {
      name: "高效通用助手",
      systemPrompt: "你是高效的助手，优先给出简洁可执行的答案。",
      temperature: 0.4,
    },
  },
] as const satisfies readonly ModelListItem[];

export type ModelCatalogItem = {
  modelId: ModelId;
  provider: ProviderId;
  model?: string;
  volcengine?: {
    endpointIdEnv: string;
  };
};

export const MODEL_LIST = [
  {
    modelId: ModelIdEnum.DoubaoPro32k,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DOUBAO_PRO" },
  },
  {
    modelId: ModelIdEnum.DeepSeekR1Math,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_R1" },
  },
  {
    modelId: ModelIdEnum.DeepSeekR1Code,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_R1" },
  },
  {
    modelId: ModelIdEnum.DeepSeekR1Logic,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_R1" },
  },
  {
    modelId: ModelIdEnum.DeepSeekV3General,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_V3" },
  },
  {
    modelId: ModelIdEnum.DeepSeekV3Writer,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_V3" },
  },
  {
    modelId: ModelIdEnum.DeepSeekV3Agent,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DEEPSEEK_V3" },
  },
  {
    modelId: ModelIdEnum.DoubaoSeedreamArtist,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DOUBAO_SEEDREAM" },
  },
  {
    modelId: ModelIdEnum.DoubaoSeedreamDesigner,
    provider: "volcengine",
    volcengine: { endpointIdEnv: "VOLCENGINE_MODEL_DOUBAO_SEEDREAM" },
  },
  { modelId: ModelIdEnum.Gpt4o, provider: "openai", model: "gpt-4o" },
  {
    modelId: ModelIdEnum.Gpt4oMini,
    provider: "openai",
    model: "gpt-4o-mini",
  },
] as const satisfies readonly ModelCatalogItem[];
