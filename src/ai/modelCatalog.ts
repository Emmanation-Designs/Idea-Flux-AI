export type AIProvider = 'openai';
export type AIModelTier = 'free' | 'plus' | 'pro';
export type AIModelSpeed = 'fast' | 'normal' | 'slow';

export interface AIModel {
  id: string;
  displayName: string;
  provider: AIProvider;
  description: string;
  enabled: boolean;
  requiredPlan: AIModelTier;
  defaultForPlan: AIModelTier | null;
  speed: AIModelSpeed;
  reasoningLevel: number; // 1-5 scale
  contextWindow: number;
  supportsVision: boolean;
  supportsImages: boolean;
  supportsFiles: boolean;
  supportsVoice: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsJSON: boolean;
  costLevel: 'free' | 'low' | 'medium' | 'high';
  apiModelName: string;
}

export const PLAN_LEVELS: Record<AIModelTier, number> = {
  free: 1,
  plus: 2,
  pro: 3,
};

// Centralized model configuration (Only place where technical model IDs are defined)
export const MODEL_MAP = {
  thinking: "gpt-5-nano",
  extendedThinking: "gpt-5",
  maximumThinking: "o3",
  imageGeneration: "gpt-image-2",
  imageEditing: "gpt-image-2",
  vision: "gpt-5",
  voice: "elevenlabs"
};

// Internal mapping of custom model IDs to actual OpenAI API names for execution
export const INTERNAL_TO_API_MAP: Record<string, string> = {
  "gpt-5-nano": "gpt-4o-mini",
  "gpt-5": "gpt-4o",
  "o3": "o3-mini",
  "gpt-image-2": "gpt-image-2",
  "elevenlabs": "elevenlabs"
};

export const MODEL_CATALOG: AIModel[] = [
  {
    id: 'thinking',
    displayName: 'Thinking',
    provider: 'openai',
    description: 'Fast AI for everyday conversations, writing, learning and general questions.',
    enabled: true,
    requiredPlan: 'free',
    defaultForPlan: 'free',
    speed: 'fast',
    reasoningLevel: 1,
    contextWindow: 128000,
    supportsVision: true,
    supportsImages: true,
    supportsFiles: true,
    supportsVoice: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsJSON: true,
    costLevel: 'free',
    apiModelName: 'gpt-4o-mini',
  },
  {
    id: 'extendedThinking',
    displayName: 'Extended Thinking',
    provider: 'openai',
    description: 'More capable reasoning, coding, planning and deeper conversations.',
    enabled: true,
    requiredPlan: 'plus',
    defaultForPlan: 'plus',
    speed: 'normal',
    reasoningLevel: 4,
    contextWindow: 128000,
    supportsVision: true,
    supportsImages: true,
    supportsFiles: true,
    supportsVoice: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsJSON: true,
    costLevel: 'medium',
    apiModelName: 'gpt-4o',
  },
  {
    id: 'maximumThinking',
    displayName: 'Maximum Thinking',
    provider: 'openai',
    description: 'Highest intelligence for difficult reasoning, research, advanced software engineering and complex problem solving.',
    enabled: true,
    requiredPlan: 'pro',
    defaultForPlan: 'pro',
    speed: 'slow',
    reasoningLevel: 5,
    contextWindow: 200000,
    supportsVision: true,
    supportsImages: true,
    supportsFiles: true,
    supportsVoice: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsJSON: true,
    costLevel: 'high',
    apiModelName: 'o3-mini',
  }
];

/**
 * Retrieve a model by its unique ID.
 */
export function getModel(id: string): AIModel | undefined {
  return MODEL_CATALOG.find(m => m.id === id);
}

/**
 * Get all enabled models that are available to a specific subscription plan level.
 * Handles cascading plan permission hierarchy (FREE -> PLUS -> PRO).
 */
export function getAvailableModels(plan: string): AIModel[] {
  const normalizedPlan = (plan || 'free').toLowerCase() as AIModelTier;
  const userLevel = PLAN_LEVELS[normalizedPlan] || PLAN_LEVELS.free;

  return MODEL_CATALOG.filter(m => {
    if (!m.enabled) return false;
    const modelLevel = PLAN_LEVELS[m.requiredPlan];
    return userLevel >= modelLevel;
  });
}

/**
 * Get the default model configured for a specific plan level.
 */
export function getDefaultModel(plan: string): AIModel {
  const normalizedPlan = (plan || 'free').toLowerCase() as AIModelTier;
  
  const explicitDefault = MODEL_CATALOG.find(m => m.enabled && m.defaultForPlan === normalizedPlan);
  if (explicitDefault) {
    return explicitDefault;
  }

  if (normalizedPlan === 'pro') {
    const proDefault = MODEL_CATALOG.find(m => m.enabled && m.id === 'maximumThinking');
    if (proDefault) return proDefault;
  }

  if (normalizedPlan === 'plus' || normalizedPlan === 'pro') {
    const plusDefault = MODEL_CATALOG.find(m => m.enabled && m.id === 'extendedThinking');
    if (plusDefault) return plusDefault;
  }

  const freeDefault = MODEL_CATALOG.find(m => m.enabled && m.id === 'thinking');
  if (freeDefault) return freeDefault;

  return MODEL_CATALOG[0];
}

/**
 * Check if a plan has active access permission to use a specific model.
 */
export function canUseModel(modelId: string, plan: string): boolean {
  const model = getModel(modelId);
  if (!model || !model.enabled) return false;

  const normalizedPlan = (plan || 'free').toLowerCase() as AIModelTier;
  const userLevel = PLAN_LEVELS[normalizedPlan] || PLAN_LEVELS.free;
  const modelLevel = PLAN_LEVELS[model.requiredPlan];

  return userLevel >= modelLevel;
}

/**
 * Get all models from a specific AI Provider.
 */
export function getProviderModels(provider: AIProvider): AIModel[] {
  return MODEL_CATALOG.filter(m => m.provider === provider);
}

/**
 * Get all enabled models.
 */
export function getEnabledModels(): AIModel[] {
  return MODEL_CATALOG.filter(m => m.enabled);
}

/**
 * Get premium models (requiring PLUS or PRO plan).
 */
export function getPremiumModels(): AIModel[] {
  return MODEL_CATALOG.filter(m => m.requiredPlan === 'plus' || m.requiredPlan === 'pro');
}
