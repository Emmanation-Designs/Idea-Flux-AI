export type ConversationType = 'idea' | 'script' | 'hashtag' | 'image' | 'general' | 'tts';
export type PersonalityType = 'professional' | 'creative' | 'witty' | 'concise' | 'empathetic' | 'academic';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  feedback?: 'like' | 'dislike';
  image_url?: string;
  filename?: string;
  model?: string;
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
  project_id?: string | null;
  organization_id?: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  organization_id?: string | null;
}

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer';
export type OrganizationMemberStatus = 'active' | 'pending';

export interface Organization {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  status: OrganizationMemberStatus;
  joined_at: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  last_active?: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  token: string;
  expires_at: string;
  created_at: string;
  created_by?: string;
  organization_name?: string;
}

export type WorkspaceType = 'personal' | 'organization';

export interface Workspace {
  type: WorkspaceType;
  organization?: Organization | null;
}

export interface OrganizationPermissions {
  canManageSettings: boolean;
  canManageMembers: boolean;
  canInvite: boolean;
  canCreateProjects: boolean;
  canDeleteProjects: boolean;
  canCreateConversations: boolean;
  isReadOnly: boolean;
}

export interface OrganizationStats {
  memberCount: number;
  projectCount: number;
  conversationCount: number;
  fileCount: number;
  storageUsedBytes: number;
}

export interface Profile {
  id: string;
  email?: string; // Optional if not in live schema update list
  name?: string | null;
  avatar_url?: string | null;
  plan: 'free' | 'pro' | 'plus';
  current_plan?: 'free' | 'pro' | 'plus';
  personality?: PersonalityType;
  messages_used_today: number;
  analysis_used_today: number;
  images_used_today: number;
  last_usage_reset: string | null;
  subscription_expires_at: string | null;
  tts_characters_used?: number;
  tts_reset_date?: string | null;
  subscription_status?: string | null;
  subscription_provider?: string | null;
  subscription_start?: string | null;
  subscription_end?: string | null;
  billing_country?: string | null;
  billing_currency?: string | null;
  billing_email?: string | null;
  country_code?: string | null;
  memory_enabled?: boolean;
}

export type MemoryCategory = 'identity' | 'work' | 'tech' | 'preference' | 'project' | 'general';

export interface UserMemory {
  id: string;
  user_id: string;
  memory: string;
  category?: MemoryCategory | string | null;
  importance: number; // 1: Low (Preference), 2: Medium (Work), 3: High (Identity), 4: Critical (Company/Project/Profession)
  source_conversation?: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

