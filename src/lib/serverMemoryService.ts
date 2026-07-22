import { isSensitiveMemory, scoreMemoryConfidence, findDuplicateMemory } from './memoryService.js';
import type { UserMemory } from '../types.js';

/**
 * Server-side helper using Supabase admin client to fetch user memories.
 */
export async function getServerUserMemories(supabaseAdmin: any, userId: string, includeArchived = false): Promise<UserMemory[]> {
  if (!userId || !supabaseAdmin) return [];
  try {
    let query = supabaseAdmin
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
      console.warn('[ServerMemoryService] Error fetching memories:', error.message);
      return [];
    }
    return (data || []) as UserMemory[];
  } catch (err) {
    console.error('[ServerMemoryService] Exception fetching memories:', err);
    return [];
  }
}

/**
 * Server-side helper to save memory.
 */
export async function saveServerUserMemory(
  supabaseAdmin: any,
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

  const existing = await getServerUserMemories(supabaseAdmin, userId, true);
  const duplicate = findDuplicateMemory(cleanText, existing);

  if (duplicate) {
    const targetImportance = Math.max(duplicate.importance, importance || scoredImportance);
    const { data, error } = await supabaseAdmin
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

  const { data, error } = await supabaseAdmin
    .from('user_memories')
    .insert(newRecord)
    .select()
    .single();

  if (error) {
    console.error('[ServerMemoryService] Error inserting memory:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true, memory: data as UserMemory, isDuplicate: false };
}

/**
 * Extracts long-term user memories from a user prompt and AI response pair.
 * Strictly ignores temporary commands, code requests, passwords, tokens, API keys, etc.
 */
export async function extractAndStoreMemoriesFromChat(
  supabaseAdmin: any,
  userId: string,
  userPrompt: string,
  assistantResponse: string,
  conversationId?: string
): Promise<{ extractedCount: number; memories: UserMemory[] }> {
  if (!userId || !userPrompt || !supabaseAdmin) {
    return { extractedCount: 0, memories: [] };
  }

  const promptLower = userPrompt.trim();

  // Basic regex matchers for common personal statements
  const patterns = [
    // Identity & Profession
    /my (?:name|company|startup|job|title|profession|role) is ([^.,!\n]+)/i,
    /i (?:am|work as|serve as) a ([^.,!\n]+)/i,
    /i (?:founded|lead|manage|own) ([^.,!\n]+)/i,
    
    // Tech & Tools
    /i (?:build with|use|code in|prefer) ([^.,!\n]+)/i,
    /my (?:tech stack|preferred framework|primary language) is ([^.,!\n]+)/i,

    // Location
    /i (?:live in|am based in|am located in) ([^.,!\n]+)/i,

    // Preferences & Rules
    /i (?:always|never|prefer to) ([^.,!\n]+)/i,
    /my (?:project|product) is called ([^.,!\n]+)/i
  ];

  const candidateStatements: string[] = [];

  for (const pat of patterns) {
    const match = promptLower.match(pat);
    if (match && match[0]) {
      candidateStatements.push(match[0]);
    }
  }

  // Also check direct "remember that..." or "keep in mind that..." explicit instructions
  const explicitMatch = promptLower.match(/(?:remember that|keep in mind that|note that|for future chats,)\s+([^.,!\n]+)/i);
  if (explicitMatch && explicitMatch[1]) {
    candidateStatements.push(explicitMatch[1]);
  }

  if (candidateStatements.length === 0) {
    return { extractedCount: 0, memories: [] };
  }

  const savedMemories: UserMemory[] = [];

  for (const statement of candidateStatements) {
    try {
      const res = await saveServerUserMemory(
        supabaseAdmin,
        userId,
        statement,
        undefined,
        undefined,
        conversationId
      );
      if (res.success && res.memory) {
        savedMemories.push(res.memory);
      }
    } catch (e) {
      console.warn('[ServerMemoryService] Failed to extract statement:', statement, e);
    }
  }

  return { extractedCount: savedMemories.length, memories: savedMemories };
}
