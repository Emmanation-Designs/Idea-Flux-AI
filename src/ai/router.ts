import { getModel, canUseModel, getDefaultModel, AIModel } from './modelCatalog.js';

export type TaskType =
  | 'GENERAL_CHAT'
  | 'LONG_REASONING'
  | 'CODING'
  | 'IMAGE_ANALYSIS'
  | 'OCR'
  | 'DOCUMENT_AI'
  | 'PDF_AI'
  | 'IMAGE_GENERATION'
  | 'IMAGE_EDIT'
  | 'VOICE'
  | 'SEARCH'
  | 'UNKNOWN';

export type IntentType = TaskType;

export interface AIRouteDecision {
  selectedModelId: string;
  reason: string;
  taskType: TaskType;
  confidence: number;
  fallbackUsed: boolean;
  executionTimeMs?: number;
}

/**
 * Smart Intent Detection Engine
 * Analyzes the user prompt, messages structure, and message history to classify the request's core intent.
 */
export function detectIntent(prompt: string, messages: any[] = []): { taskType: TaskType; confidence: number } {
  const text = (prompt || '').trim().toLowerCase();
  
  // Combine last few messages to understand context if available
  const contextText = messages
    .slice(-3)
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .join(' ')
    .toLowerCase();

  const combinedText = `${text} ${contextText}`;

  // 1. Check for files & images in messages first
  const hasImages = messages.some((m: any) => {
    if (m.image_url && m.image_url.startsWith('data:image')) return true;
    if (Array.isArray(m.content)) {
      return m.content.some((part: any) => part.type === 'image_url');
    }
    return false;
  });

  const hasPdfs = messages.some((m: any) => {
    const filename = m.filename || '';
    return filename.toLowerCase().endsWith('.pdf') || (typeof m.content === 'string' && m.content.includes('[PDF Document]'));
  });

  const hasDocs = messages.some((m: any) => {
    const filename = m.filename || '';
    return (
      filename.toLowerCase().endsWith('.docx') ||
      filename.toLowerCase().endsWith('.txt') ||
      filename.toLowerCase().endsWith('.json') ||
      filename.toLowerCase().endsWith('.csv') ||
      (typeof m.content === 'string' && m.content.includes('[Document]'))
    );
  });

  // 2. IMAGE GENERATION / EDIT
  const isImageGenerationKeywords =
    text.startsWith('generate image') ||
    text.startsWith('create image') ||
    text.startsWith('draw') ||
    text.startsWith('paint') ||
    text.startsWith('make a photo') ||
    text.startsWith('generate a picture') ||
    text.includes('generate a highly detailed image') ||
    text.includes('create an image of');

  if (isImageGenerationKeywords) {
    if (hasImages || text.includes('edit') || text.includes('modify') || text.includes('change')) {
      return { taskType: 'IMAGE_EDIT', confidence: 0.95 };
    }
    return { taskType: 'IMAGE_GENERATION', confidence: 0.98 };
  }

  // 3. IMAGE ANALYSIS & OCR
  if (hasImages) {
    const isOcrKeywords =
      combinedText.includes('ocr') ||
      combinedText.includes('read text') ||
      combinedText.includes('extract text') ||
      combinedText.includes('transcribe') ||
      combinedText.includes('read the writing') ||
      combinedText.includes('what does it say');
    
    if (isOcrKeywords) {
      return { taskType: 'OCR', confidence: 0.92 };
    }
    return { taskType: 'IMAGE_ANALYSIS', confidence: 0.95 };
  }

  // 4. PDF_AI & DOCUMENT_AI
  if (hasPdfs) {
    return { taskType: 'PDF_AI', confidence: 0.95 };
  }
  if (hasDocs || combinedText.includes('resume') || combinedText.includes('document summary') || combinedText.includes('analyze this text file')) {
    return { taskType: 'DOCUMENT_AI', confidence: 0.90 };
  }

  // 5. VOICE
  const isVoiceKeywords =
    combinedText.includes('voice note') ||
    combinedText.includes('text to speech') ||
    combinedText.includes('speak this') ||
    combinedText.includes('read aloud') ||
    combinedText.includes('audio file') ||
    combinedText.includes('tts');
  if (isVoiceKeywords) {
    return { taskType: 'VOICE', confidence: 0.88 };
  }

  // 6. SEARCH
  const isSearchKeywords =
    combinedText.includes('current weather') ||
    combinedText.includes('latest news') ||
    combinedText.includes('search the web') ||
    combinedText.includes('browse for') ||
    combinedText.includes('stock price of') ||
    combinedText.includes('what is the price of') ||
    combinedText.includes('today\'s news') ||
    combinedText.includes('recently in 2026') ||
    combinedText.includes('what happened in 2025') ||
    combinedText.includes('news about');
  if (isSearchKeywords) {
    return { taskType: 'SEARCH', confidence: 0.90 };
  }

  // 7. CODING
  const isCodingKeywords =
    combinedText.includes('function') ||
    combinedText.includes('typescript') ||
    combinedText.includes('javascript') ||
    combinedText.includes('python') ||
    combinedText.includes('react component') ||
    combinedText.includes('html/css') ||
    combinedText.includes('write a script') ||
    combinedText.includes('debug') ||
    combinedText.includes('compile error') ||
    combinedText.includes('sql query') ||
    combinedText.includes('git commit') ||
    combinedText.includes('json parser') ||
    combinedText.includes('css styling') ||
    combinedText.includes('dockerfile') ||
    combinedText.includes('npm install') ||
    combinedText.includes('```');
  if (isCodingKeywords) {
    return { taskType: 'CODING', confidence: 0.92 };
  }

  // 8. LONG_REASONING
  const isReasoningKeywords =
    combinedText.includes('think step by step') ||
    combinedText.includes('deep thinking') ||
    combinedText.includes('complex logic') ||
    combinedText.includes('solve this riddle') ||
    combinedText.includes('prove that') ||
    combinedText.includes('math puzzle') ||
    combinedText.includes('chess puzzle') ||
    combinedText.includes('explain in detail') ||
    combinedText.includes('reason through this') ||
    combinedText.includes('philosophical analysis') ||
    combinedText.includes('scientific derivation');
  if (isReasoningKeywords) {
    return { taskType: 'LONG_REASONING', confidence: 0.85 };
  }

  // 9. GENERAL_CHAT (Default fallback if anything is left)
  if (text.length > 0) {
    return { taskType: 'GENERAL_CHAT', confidence: 0.80 };
  }

  return { taskType: 'UNKNOWN', confidence: 0.50 };
}

/**
 * Core Router Logic
 * Routes a prompt intelligently based on subscriber tier and detected intent.
 */
export function routeRequest(
  prompt: string,
  messages: any[] = [],
  userPlan: 'free' | 'plus' | 'pro' = 'free',
  selectedModelId?: string,
  autoMode: boolean = true,
  prevModelId?: string
): AIRouteDecision {
  const startTime = Date.now();
  
  // 1. If manual override is active (Auto Mode OFF), respect the user's selected model
  if (!autoMode && selectedModelId) {
    const isAllowed = canUseModel(selectedModelId, userPlan);
    const modelObj = getModel(selectedModelId);

    if (isAllowed && modelObj) {
      return {
        selectedModelId,
        reason: 'Manual override: Active user choice.',
        taskType: 'UNKNOWN',
        confidence: 1.0,
        fallbackUsed: false,
        executionTimeMs: Date.now() - startTime,
      };
    } else {
      // Automatic fallback if chosen model is forbidden for current plan
      const defaultModel = getDefaultModel(userPlan);
      return {
        selectedModelId: defaultModel.id,
        reason: `Manual selection ${selectedModelId} forbidden for ${userPlan} tier. Fallback applied.`,
        taskType: 'UNKNOWN',
        confidence: 1.0,
        fallbackUsed: true,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // 2. Auto Mode is ON. Perform intent detection
  const { taskType, confidence } = detectIntent(prompt, messages);

  // 3. Conversation consistency logic
  let targetModelId = 'thinking';
  let reason = '';

  // Determine target model purely based on task mapping rules
  switch (taskType) {
    case 'GENERAL_CHAT':
    case 'SEARCH':
    case 'IMAGE_GENERATION':
    case 'IMAGE_EDIT':
    case 'VOICE':
      targetModelId = 'thinking';
      reason = 'Routed to Thinking intelligence level.';
      break;
    case 'CODING':
    case 'IMAGE_ANALYSIS':
    case 'OCR':
    case 'DOCUMENT_AI':
    case 'PDF_AI':
      targetModelId = 'extendedThinking';
      reason = 'Complex tasks routed to Extended Thinking intelligence level.';
      break;
    case 'LONG_REASONING':
      targetModelId = 'maximumThinking';
      reason = 'High-complexity logic routed to Maximum Thinking intelligence level.';
      break;
    default:
      targetModelId = 'thinking';
      reason = 'Default fallback to Thinking intelligence level.';
      break;
  }

  // Check if we should enforce conversation consistency
  if (prevModelId && prevModelId !== targetModelId) {
    const prevModelObj = getModel(prevModelId);
    const isDrasticShift = 
      taskType === 'IMAGE_GENERATION' || 
      taskType === 'IMAGE_EDIT' || 
      taskType === 'IMAGE_ANALYSIS' ||
      taskType === 'OCR' ||
      taskType === 'PDF_AI' ||
      taskType === 'DOCUMENT_AI';

    if (!isDrasticShift && prevModelObj && canUseModel(prevModelId, userPlan)) {
      targetModelId = prevModelId;
      reason = `Maintaining conversation consistency with previously active level: ${prevModelObj.displayName}.`;
    }
  }

  // 4. Subscription & Fallback Logic
  let finalModelId = targetModelId;
  let fallbackUsed = false;

  if (!canUseModel(finalModelId, userPlan)) {
    fallbackUsed = true;
    
    // Fallback cascade logic
    if (userPlan === 'free') {
      finalModelId = 'thinking';
      reason = `Downgraded to Thinking for Free subscriber tier.`;
    } else if (userPlan === 'plus') {
      finalModelId = 'extendedThinking';
      reason = `Mapped to Extended Thinking for Plus subscriber tier.`;
    } else {
      const def = getDefaultModel(userPlan);
      finalModelId = def.id;
      reason = `Fallback to default level: ${def.displayName}.`;
    }
  }

  const executionTimeMs = Date.now() - startTime;

  // Server-only logging diagnostics
  if (typeof window === 'undefined') {
    console.log(`[Smart Router Diagnostic Log]
  - Task Detected: ${taskType} (Confidence: ${(confidence * 100).toFixed(1)}%)
  - User Plan: ${userPlan}
  - Intended Intelligence Level: ${targetModelId}
  - Selected Intelligence Level: ${finalModelId}
  - Fallback Used: ${fallbackUsed}
  - Reason: ${reason}
  - Execution Time: ${executionTimeMs}ms`);
  }

  return {
    selectedModelId: finalModelId,
    reason,
    taskType,
    confidence,
    fallbackUsed,
    executionTimeMs,
  };
}
