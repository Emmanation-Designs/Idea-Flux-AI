export type ConversationType = 'idea' | 'script' | 'hashtag' | 'general';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  type: ConversationType;
  messages: Message[];
  metadata: any;
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
