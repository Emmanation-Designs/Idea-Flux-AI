import { supabase } from './supabase';
import type { UserMemory, MemoryCategory } from '../types';

// Sensitive patterns that MUST NEVER be stored in memory
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_\s]?key/i,
  /auth/i,
  /bearer/i,
  /private[_\s]?key/i,
  /credit[_\s]?card/i,
  /card[_\s]?number/i,
  /cvv/i,
  /otp/i,
  /pin[_\s]?code/i,
  /ssn/i,
  /social[_\s]?security/i,
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // credit card regex
  /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/, // JWT regex
  /sk-[A-Za-z0-9]{20,}/, // API key regex
];

/**
 * Checks whether a candidate memory string contains sensitive credentials or private info.
 */
export function isSensitiveMemory(text: string): boolean {
  if (!text || typeof text !== 'string') return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Calculates confidence score (0.0 to 1.0) for storing a statement as long-term user memory.
 */
export function scoreMemoryConfidence(statement: string): { confidence: number; category: MemoryCategory; importance: number; cleanText: string } {
  const lower = statement.toLowerCase().trim();

  // Reject if contains sensitive data
  if (isSensitiveMemory(lower)) {
    return { confidence: 0, category: 'general', importance: 1, cleanText: '' };
  }

  // Reject temporary prompts or one-time instructions
  const temporaryKeywords = [
    'write a', 'generate', 'create a', 'explain', 'summarize', 'translate',
    'search for', 'what is', 'how to', 'can you', 'please', 'tell me',
    'debug', 'fix this', 'run', 'convert', 'download', 'image of', 'draw'
  ];
  if (temporaryKeywords.some(kw => lower.startsWith(kw) || lower.includes(kw + ' '))) {
    return { confidence: 0.2, category: 'general', importance: 1, cleanText: '' };
  }

  let category: MemoryCategory = 'general';
  let importance = 1;
  let confidence = 0.85;

  // Personal Identity & Profession (High/Critical)
  if (/\b(i am|my name is|my profession|i work as|my title is|my company|my startup|founder|engineer|developer|designer|doctor|teacher|student)\b/i.test(lower)) {
    category = /\b(company|startup|business|project|trelvix)\b/i.test(lower) ? 'project' : 'identity';
    importance = /\b(company|startup|founder|ceo|cto|project)\b/i.test(lower) ? 4 : 3;
    confidence = 0.95;
  }
  // Tech Stack & Languages (Medium/High)
  else if (/\b(i use|i build with|my stack|prefer|favourite language|favorite language|use react|use typescript|use python|use node|use tailwind)\b/i.test(lower)) {
    category = 'tech';
    importance = 2;
    confidence = 0.92;
  }
  // Location & Personal Details (High)
  else if (/\b(i live in|based in|located in|from|my country|my city)\b/i.test(lower)) {
    category = 'identity';
    importance = 3;
    confidence = 0.90;
  }
  // Preferences (Low/Medium)
  else if (/\b(i prefer|i like|i always|always keep|prefer concise|prefer dark mode|prefer light mode|never use)\b/i.test(lower)) {
    category = 'preference';
    importance = 1;
    confidence = 0.88;
  }
  // Work & Projects (Medium/Critical)
  else if (/\b(my project|my product|building a|working on)\b/i.test(lower)) {
    category = 'work';
    importance = /\b(main|primary|flagship)\b/i.test(lower) ? 4 : 2;
    confidence = 0.90;
  }

  // Formatting clean memory text
  let cleanText = statement.trim();
  cleanText = cleanText.replace(/^(user says|user states|i am|i use|i prefer|my project is|my company is)\s+/i, (match) => {
    return match.toLowerCase();
  });
  // Capitalize first letter
  cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
  if (!cleanText.endsWith('.')) cleanText += '.';

  return { confidence, category, importance, cleanText };
}

/**
 * Normalizes memory text for duplicate comparison
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a new memory string is a duplicate or close semantic match to existing memories.
 */
export function findDuplicateMemory(newMemoryText: string, existingMemories: UserMemory[]): UserMemory | null {
  const normNew = normalizeForComparison(newMemoryText);
  if (!normNew) return null;

  const newWords = new Set(normNew.split(' '));

  for (const item of existingMemories) {
    if (item.archived) continue;
    const normExisting = normalizeForComparison(item.memory);
    if (normExisting === normNew) return item;

    // Substring or Jaccard similarity threshold for close rephrasings
    const existingWords = new Set(normExisting.split(' '));
    const intersection = [...newWords].filter(w => existingWords.has(w));
    const union = new Set([...newWords, ...existingWords]);
    const jaccard = intersection.length / union.size;

    if (jaccard > 0.65 || (normNew.length > 10 && (normExisting.includes(normNew) || normNew.includes(normExisting)))) {
      return item;
    }
  }

  return null;
}

/**
 * Loads all active (non-archived) memories for a given user from Supabase.
 */
export async function getUserMemories(userId: string, includeArchived: boolean = false): Promise<UserMemory[]> {
  if (!userId) return [];
  try {
    let query = supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('archived', false);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[MemoryService] Error fetching user memories:', error.message);
      return [];
    }
    return (data || []) as UserMemory[];
  } catch (err) {
    console.error('[MemoryService] Exception fetching user memories:', err);
    return [];
  }
}

/**
 * Saves a new user memory, with duplicate checking & confidence scoring.
 */
export async function saveUserMemory(
  userId: string,
  rawMemoryText: string,
  category?: string,
  importance?: number,
  sourceConversationId?: string
): Promise<{ success: boolean; memory?: UserMemory; isDuplicate?: boolean; error?: string }> {
  if (!userId || !rawMemoryText || !rawMemoryText.trim()) {
    return { success: false, error: 'User ID and memory text are required.' };
  }

  const { confidence, category: scoredCategory, importance: scoredImportance, cleanText } = scoreMemoryConfidence(rawMemoryText);

  if (confidence < 0.75 || isSensitiveMemory(cleanText)) {
    return { success: false, error: 'Statement did not meet memory confidence or safety criteria.' };
  }

  const existing = await getUserMemories(userId, true);
  const duplicate = findDuplicateMemory(cleanText, existing);

  if (duplicate) {
    // Update existing memory timestamp / importance if higher
    const targetImportance = Math.max(duplicate.importance, importance || scoredImportance);
    const { data, error } = await supabase
      .from('user_memories')
      .update({
        memory: cleanText,
        importance: targetImportance,
        archived: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', duplicate.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, memory: data as UserMemory, isDuplicate: true };
  }

  // Insert new memory
  const newRecord = {
    user_id: userId,
    memory: cleanText,
    category: category || scoredCategory,
    importance: importance || scoredImportance,
    source_conversation: sourceConversationId || null,
    archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('user_memories')
    .insert(newRecord)
    .select()
    .single();

  if (error) {
    console.error('[MemoryService] Error inserting memory:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true, memory: data as UserMemory, isDuplicate: false };
}

/**
 * Updates an existing memory record.
 */
export async function updateUserMemory(
  userId: string,
  memoryId: string,
  updates: Partial<Pick<UserMemory, 'memory' | 'category' | 'importance' | 'archived'>>
): Promise<UserMemory | null> {
  if (!userId || !memoryId) return null;

  const payload: any = { ...updates, updated_at: new Date().toISOString() };

  if (updates.memory) {
    if (isSensitiveMemory(updates.memory)) {
      throw new Error('Memory contains sensitive data.');
    }
    let clean = updates.memory.trim();
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (!clean.endsWith('.')) clean += '.';
    payload.memory = clean;
  }

  const { data, error } = await supabase
    .from('user_memories')
    .update(payload)
    .eq('id', memoryId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('[MemoryService] Error updating memory:', error.message);
    return null;
  }

  return data as UserMemory;
}

/**
 * Deletes a memory record permanently.
 */
export async function deleteUserMemory(userId: string, memoryId: string): Promise<boolean> {
  if (!userId || !memoryId) return false;
  const { error } = await supabase
    .from('user_memories')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId);

  if (error) {
    console.error('[MemoryService] Error deleting memory:', error.message);
    return false;
  }
  return true;
}

/**
 * Deletes ALL memories for a user.
 */
export async function deleteAllUserMemories(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabase
    .from('user_memories')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('[MemoryService] Error deleting all memories:', error.message);
    return false;
  }
  return true;
}

/**
 * Filters memories by relevance to the user's prompt.
 * Always prioritizes Critical (4) and High (3) importance memories, plus relevant keywords.
 */
export function selectRelevantMemories(memories: UserMemory[], prompt: string, maxItems: number = 7): UserMemory[] {
  if (!memories || memories.length === 0) return [];
  const activeMemories = memories.filter(m => !m.archived);
  if (activeMemories.length <= maxItems) return activeMemories;

  const lowerPrompt = (prompt || '').toLowerCase();
  const promptWords = new Set(lowerPrompt.split(/\s+/).filter(w => w.length > 2));

  // Score each memory by relevance + importance
  const scored = activeMemories.map(m => {
    let score = m.importance * 2; // base score from importance
    const lowerMem = m.memory.toLowerCase();

    // Check keyword overlaps
    for (const word of promptWords) {
      if (lowerMem.includes(word)) {
        score += 3;
      }
    }

    // Category relevance
    if (m.category === 'project' && (lowerPrompt.includes('project') || lowerPrompt.includes('app') || lowerPrompt.includes('code'))) {
      score += 4;
    }
    if (m.category === 'tech' && (lowerPrompt.includes('code') || lowerPrompt.includes('stack') || lowerPrompt.includes('build') || lowerPrompt.includes('framework'))) {
      score += 4;
    }
    if (m.category === 'work' && (lowerPrompt.includes('work') || lowerPrompt.includes('job') || lowerPrompt.includes('company'))) {
      score += 4;
    }

    return { memory: m, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxItems).map(s => s.memory);
}

/**
 * Formats a list of relevant memories into a clean string for prompt injection into OpenAI systemInstruction.
 */
export function formatMemoriesForSystemPrompt(relevantMemories: UserMemory[]): string {
  if (!relevantMemories || relevantMemories.length === 0) return '';

  const lines = relevantMemories.map(m => `- ${m.memory}`);

  return `\n\nUSER PERSISTENT MEMORY CONTEXT:
The following are verified, persistent facts and preferences about the user. Incorporate them naturally into your response when relevant. Do NOT announce that you loaded or possess memories unless directly asked:
${lines.join('\n')}`;
}
