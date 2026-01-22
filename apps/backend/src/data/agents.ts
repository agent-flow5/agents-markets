import { MODEL_LIST, modelList, type ModelCatalogItem, type ModelId } from "./list";
export type { ModelId } from "./list";

export type AgentConfig = {
  id: string;
  name: string;
  modelId: ModelId | (string & {});
  systemPrompt: string;
  temperature: number;
};

const BASE_AGENT_LIST: AgentConfig[] = [...modelList]
  .sort((a, b) => {
    const aRank = a.provider === "volcengine" ? 0 : 1;
    const bRank = b.provider === "volcengine" ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.id - b.id;
  })
  .map((m) => ({
    id: `${m.modelId}-${m.id}`,
    name: m.defaultAgent.name,
    modelId: m.modelId,
    systemPrompt: m.defaultAgent.systemPrompt,
    temperature: m.defaultAgent.temperature,
  }));

const CUSTOM_AGENT_LIST: AgentConfig[] = [];

export const AGENT_LIST: AgentConfig[] = BASE_AGENT_LIST;

export function getAgentById(agentId: string): AgentConfig | undefined {
  return (
    CUSTOM_AGENT_LIST.find((a) => a.id === agentId) ??
    BASE_AGENT_LIST.find((a) => a.id === agentId)
  );
}

export function getModelByModelId(modelId: string): ModelCatalogItem | undefined {
  return MODEL_LIST.find((m) => m.modelId === modelId);
}

export function listAvailableModelIds(): string {
  return MODEL_LIST.map((m) => m.modelId).join(", ");
}

export function listAgents(): AgentConfig[] {
  return [...BASE_AGENT_LIST, ...CUSTOM_AGENT_LIST];
}

export function createAgent(input: {
  name: string;
  modelId: string;
  systemPrompt: string;
  temperature?: number;
}): AgentConfig {
  const name = input.name.trim();
  if (!name) throw new Error("Invalid name");

  const modelId = input.modelId.trim();
  if (!modelId) throw new Error("Invalid modelId");

  const exists = MODEL_LIST.some((m) => m.modelId === modelId);
  if (!exists) throw new Error("Unknown modelId");

  const systemPrompt = input.systemPrompt.trim();
  if (!systemPrompt) throw new Error("Invalid systemPrompt");

  const rawTemperature = input.temperature;
  const temperature =
    typeof rawTemperature === "number" && !Number.isNaN(rawTemperature)
      ? Math.max(0, Math.min(2, rawTemperature))
      : 0.7;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const agent: AgentConfig = { id, name, modelId, systemPrompt, temperature };
  CUSTOM_AGENT_LIST.unshift(agent);
  return agent;
}
