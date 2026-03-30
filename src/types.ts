export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type ConversationType = 'idea' | 'script' | 'hashtag';

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  type: ConversationType;
  messages: Message[];
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  usage_count: number;
  max_usage: number;
  is_pro: boolean;
  pro_expires_at: string | null;
};
