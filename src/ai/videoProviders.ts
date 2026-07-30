import OpenAI from "openai";

export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  quality?: 'creative' | 'super-creative' | string;
  model?: string;
  duration?: string;
  resolution?: string;
  aspectRatio?: string;
  fps?: string;
  cameraMotion?: string;
  motionStrength?: number;
  inputImage?: string; // Image-to-video input
}

export interface VideoGenerationResult {
  id: string;
  providerJobId: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  negativePrompt?: string;
  duration: string;
  resolution: string;
  aspectRatio: string;
  quality: 'creative' | 'super-creative';
  modelUsed: string;
  provider: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  generationTimeMs?: number;
  costEstimateUsd: number;
  error?: string;
}

export interface VideoProvider {
  name: string;
  generateVideo(params: VideoGenerationParams): Promise<VideoGenerationResult>;
  pollVideoStatus?(jobId: string): Promise<VideoGenerationResult>;
}

export class OpenAISoraProvider implements VideoProvider {
  name = "openai";

  private mapAspectRatioToSize(aspectRatio: string = '16:9', resolution: string = '1080p'): string {
    const isHD = resolution === '1080p' || resolution === '4K';
    switch (aspectRatio) {
      case '9:16':
        return isHD ? "1080x1920" : "720x1280";
      case '1:1':
        return isHD ? "1080x1080" : "720x720";
      case '4:3':
        return isHD ? "1440x1080" : "960x720";
      case '21:9':
        return isHD ? "1920x822" : "1280x548";
      case '16:9':
      default:
        return isHD ? "1920x1080" : "1280x720";
    }
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoGenerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes("your_openai") || apiKey.includes("placeholder")) {
      const err: any = new Error("OPENAI_API_KEY environment variable is missing or not configured on the server.");
      err.status = 400;
      throw err;
    }

    const isSuperCreative = params.quality === 'super-creative' || params.quality === 'super_creative';
    const quality: 'creative' | 'super-creative' = isSuperCreative ? 'super-creative' : 'creative';
    
    // Internal OpenAI model mapping
    const openAIModel = isSuperCreative ? 'sora-1.0' : 'sora-1.0-turbo';
    const duration = params.duration || '10s';
    const resolution = params.resolution || '1080p';
    const aspectRatio = params.aspectRatio || '16:9';
    const size = this.mapAspectRatioToSize(aspectRatio, resolution);
    const durationSec = parseInt(duration) || 10;
    
    // Cost estimation calculation (Creative: ~$0.10, Super Creative: ~$0.35)
    const costEstimateUsd = isSuperCreative ? 0.35 : 0.10;
    const createdAt = new Date().toISOString();

    // Construct prompt including negative prompt if provided
    let fullPrompt = params.prompt.trim();
    if (params.negativePrompt && params.negativePrompt.trim()) {
      fullPrompt += `\n\n[Negative prompt / Do not include: ${params.negativePrompt.trim()}]`;
    }

    const payload: any = {
      model: openAIModel,
      prompt: fullPrompt,
      size,
      seconds: durationSec,
    };

    if (params.inputImage) {
      payload.input_image = params.inputImage;
    }

    // Official REST fetch to OpenAI Video generation endpoint
    const res = await fetch("https://api.openai.com/v1/videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errBody: any = null;
      try {
        errBody = await res.json();
      } catch {
        const text = await res.text().catch(() => '');
        errBody = { message: text || `HTTP ${res.status} ${res.statusText}` };
      }
      const message = errBody?.error?.message || errBody?.message || `OpenAI Video API returned HTTP ${res.status}`;
      const err: any = new Error(`OpenAI Video API Error (${res.status}): ${message}`);
      err.status = res.status;
      err.details = errBody;
      throw err;
    }

    const data = await res.json();
    const videoUrl = data.data?.[0]?.url || data.video_url || data.url;
    const providerJobId = data.id || data.job_id;

    if (!providerJobId && !videoUrl) {
      throw new Error("OpenAI Video API response did not contain a valid job ID or video URL.");
    }

    const rawStatus = data.status || (videoUrl ? 'completed' : 'generating');
    const isCompleted = rawStatus === 'succeeded' || rawStatus === 'completed';

    return {
      id: providerJobId || `openai-${Date.now()}`,
      providerJobId: providerJobId || `openai-${Date.now()}`,
      videoUrl: videoUrl || undefined,
      thumbnailUrl: data.thumbnail_url || data.data?.[0]?.thumbnail_url,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      duration,
      resolution,
      aspectRatio,
      quality,
      modelUsed: openAIModel,
      provider: 'openai',
      status: isCompleted ? 'completed' : 'generating',
      createdAt,
      completedAt: isCompleted ? new Date().toISOString() : undefined,
      costEstimateUsd,
    };
  }

  async pollVideoStatus(jobId: string): Promise<VideoGenerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes("your_openai") || apiKey.includes("placeholder")) {
      const err: any = new Error("OPENAI_API_KEY is missing or not configured on the server.");
      err.status = 400;
      throw err;
    }

    const res = await fetch(`https://api.openai.com/v1/videos/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!res.ok) {
      let errBody: any = null;
      try {
        errBody = await res.json();
      } catch {
        const text = await res.text().catch(() => '');
        errBody = { message: text || `HTTP ${res.status} ${res.statusText}` };
      }
      const message = errBody?.error?.message || errBody?.message || `OpenAI Video Polling returned HTTP ${res.status}`;
      const err: any = new Error(`OpenAI Video Polling Error (${res.status}): ${message}`);
      err.status = res.status;
      err.details = errBody;
      throw err;
    }

    const data = await res.json();
    const videoUrl = data.data?.[0]?.url || data.video_url || data.url;
    const rawStatus = data.status || (videoUrl ? 'completed' : 'generating');
    const isCompleted = rawStatus === 'succeeded' || rawStatus === 'completed';
    const isFailed = rawStatus === 'failed' || rawStatus === 'cancelled';

    return {
      id: jobId,
      providerJobId: jobId,
      videoUrl: videoUrl || undefined,
      thumbnailUrl: data.thumbnail_url,
      prompt: data.prompt || '',
      duration: data.duration ? `${data.duration}s` : '10s',
      resolution: '1080p',
      aspectRatio: '16:9',
      quality: data.model?.includes('turbo') ? 'creative' : 'super-creative',
      modelUsed: data.model || 'sora-1.0-turbo',
      provider: 'openai',
      status: isFailed ? 'failed' : (isCompleted ? 'completed' : 'generating'),
      error: data.error?.message || data.error || (isFailed ? 'Video generation failed' : undefined),
      createdAt: data.created_at || new Date().toISOString(),
      completedAt: isCompleted ? new Date().toISOString() : undefined,
      costEstimateUsd: data.model?.includes('turbo') ? 0.10 : 0.35
    };
  }
}

export const videoProviderRegistry: Record<string, VideoProvider> = {
  openai: new OpenAISoraProvider(),
  'sora-1.0-turbo': new OpenAISoraProvider(),
  'sora-1.0': new OpenAISoraProvider(),
  'creative': new OpenAISoraProvider(),
  'super-creative': new OpenAISoraProvider(),
};

export function getVideoProvider(providerName?: string): VideoProvider {
  return videoProviderRegistry.openai;
}

