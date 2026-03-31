export type ConversationType = 'idea' | 'script' | 'hashtag' | 'general';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Idea {
  id: string;
  user_id: string;
  topic: string;
  platform: string;
  tone: string;
  ideas: string[]; // Or jsonb
  created_at: string;
}

export interface Script {
  id: string;
  user_id: string;
  topic: string;
  platform: string;
  length?: string;
  conversation: Message[]; // jsonb
  final_script: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  usage_count: number;
  max_usage: number;
  pro_expires_at: string | null;
  activation_key?: string;
}
