export interface LiveVoice {
  id: string;
  name: string;
  description: string;
  gender: 'female' | 'male' | 'neutral';
  tone: string;
}

export const SUPPORTED_LIVE_VOICES: LiveVoice[] = [
  { id: 'juniper', name: 'Juniper', description: 'Open and upbeat', gender: 'female', tone: 'Open and upbeat' },
  { id: 'breeze', name: 'Breeze', description: 'Animated and earnest', gender: 'female', tone: 'Animated and earnest' },
  { id: 'cove', name: 'Cove', description: 'Composed and direct', gender: 'male', tone: 'Composed and direct' },
  { id: 'ember', name: 'Ember', description: 'Confident and optimistic', gender: 'male', tone: 'Confident and optimistic' },
  { id: 'sol', name: 'Sol', description: 'Savvy and relaxed', gender: 'female', tone: 'Savvy and relaxed' },
  { id: 'alloy', name: 'Alloy', description: 'Versatile and balanced', gender: 'neutral', tone: 'Versatile and balanced' },
  { id: 'ash', name: 'Ash', description: 'Relaxed and conversational', gender: 'male', tone: 'Relaxed and conversational' },
  { id: 'ballad', name: 'Ballad', description: 'Melodic and expressive', gender: 'neutral', tone: 'Melodic and expressive' },
  { id: 'coral', name: 'Coral', description: 'Friendly and warm', gender: 'female', tone: 'Friendly and warm' },
  { id: 'echo', name: 'Echo', description: 'Warm and articulate', gender: 'male', tone: 'Warm and articulate' },
  { id: 'sage', name: 'Sage', description: 'Calm and serene', gender: 'female', tone: 'Calm and serene' },
  { id: 'shimmer', name: 'Shimmer', description: 'Bright and clear', gender: 'female', tone: 'Bright and clear' },
  { id: 'verse', name: 'Verse', description: 'Dynamic and modern', gender: 'neutral', tone: 'Dynamic and modern' },
];

export interface LiveSessionState {
  status: 'idle' | 'connecting' | 'listening' | 'user_speaking' | 'thinking' | 'ai_speaking' | 'muted' | 'error';
  sessionId: string | null;
  liveSessionId: string | null;
  error: string | null;
  isMuted: boolean;
  selectedVoice: string;
  selectedLanguage: string;
  userVolume: number; // 0 to 1
  aiVolume: number;   // 0 to 1
  activeSeconds: number;
}
