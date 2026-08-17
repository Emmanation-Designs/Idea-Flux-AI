export interface LiveVoice {
  id: string;
  name: string;
  description: string;
  gender: 'female' | 'male' | 'neutral';
  tone: string;
}

export const SUPPORTED_LIVE_VOICES: LiveVoice[] = [
  { id: 'marin', name: 'Marin', description: 'Natural and engaging', gender: 'female', tone: 'Natural and engaging' },
  { id: 'cedar', name: 'Cedar', description: 'Calm and grounded', gender: 'male', tone: 'Calm and grounded' },
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
  status: 'idle' | 'connecting' | 'listening' | 'user_speaking' | 'thinking' | 'searching' | 'ai_speaking' | 'muted' | 'error';
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
