export type ConversationType = 'idea' | 'script' | 'hashtag' | 'image' | 'voice' | 'general';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  feedback?: 'like' | 'dislike';
  image_url?: string;
  audio_url?: string;
  filename?: string;
  attachment_name?: string;
  attachment_type?: 'image' | 'video' | 'document' | 'other';
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
  email?: string; // Optional if not in live schema update list
  name?: string | null;
  plan: 'free' | 'pro' | 'plus';
  messages_used_today: number;
  analysis_used_today: number;
  images_used_today: number;
  last_usage_reset: string | null;
  subscription_expires_at: string | null;
}
