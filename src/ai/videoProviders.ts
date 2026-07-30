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
    if (aspectRatio === '9:16') {
      return isHD ? "1024x1792" : "720x1280";
    }
    return isHD ? "1792x1024" : "1280x720";
  }

  private mapSecondsEnum(duration?: string): "4" | "8" | "12" {
    if (!duration) return "4";
    const num = parseInt(duration);
    if (isNaN(num) || num <= 4) return "4";
    if (num <= 8) return "8";
    return "12";
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
    
    // Internal OpenAI model mapping strictly per documentation
    const openAIModel = isSuperCreative ? 'sora-2-pro' : 'sora-2';
    const secondsEnum = this.mapSecondsEnum(params.duration);
    const resolution = params.resolution || '1080p';
    const aspectRatio = params.aspectRatio || '16:9';
    const size = this.mapAspectRatioToSize(aspectRatio, resolution);
    
    // Cost estimation calculation (Creative sora-2: ~$0.10, Super Creative sora-2-pro: ~$0.35)
    const costEstimateUsd = isSuperCreative ? 0.35 : 0.10;
    const createdAt = new Date().toISOString();

    // Construct prompt including negative prompt if provided
    let fullPrompt = params.prompt.trim();
    if (params.negativePrompt && params.negativePrompt.trim()) {
      fullPrompt += `\n\n[Negative prompt / Do not include: ${params.negativePrompt.trim()}]`;
    }

    const payload: any = {
      prompt: fullPrompt,
      model: openAIModel,
      seconds: secondsEnum,
      size,
    };

    if (params.inputImage) {
      payload.input_reference = { image_url: params.inputImage };
    }

    // Official REST fetch to OpenAI Video generation endpoint POST /v1/videos
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
    const providerJobId = data.id;

    if (!providerJobId) {
      throw new Error("OpenAI Video API response did not contain a valid job ID.");
    }

    const rawStatus = data.status || 'queued';
    const isCompleted = rawStatus === 'completed';
    const videoUrl = data.video_url || data.url || (isCompleted ? `/api/tools/video-studio/content/${providerJobId}` : undefined);

    return {
      id: providerJobId,
      providerJobId: providerJobId,
      videoUrl: videoUrl || undefined,
      thumbnailUrl: data.thumbnail_url || (isCompleted ? `/api/tools/video-studio/content/${providerJobId}?variant=thumbnail` : undefined),
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      duration: `${secondsEnum}s`,
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
    const rawStatus = data.status || 'queued';
    const isCompleted = rawStatus === 'completed';
    const isFailed = rawStatus === 'failed';

    const videoUrl = data.video_url || data.url || (isCompleted ? `/api/tools/video-studio/content/${jobId}` : undefined);
    const thumbnailUrl = data.thumbnail_url || (isCompleted ? `/api/tools/video-studio/content/${jobId}?variant=thumbnail` : undefined);

    return {
      id: jobId,
      providerJobId: jobId,
      videoUrl: videoUrl || undefined,
      thumbnailUrl,
      prompt: data.prompt || '',
      duration: data.seconds ? `${data.seconds}s` : '4s',
      resolution: '1080p',
      aspectRatio: '16:9',
      quality: data.model?.includes('pro') ? 'super-creative' : 'creative',
      modelUsed: data.model || 'sora-2',
      provider: 'openai',
      status: isFailed ? 'failed' : (isCompleted ? 'completed' : 'generating'),
      error: data.error?.message || (isFailed ? 'Video generation failed' : undefined),
      createdAt: data.created_at ? new Date(data.created_at * 1000).toISOString() : new Date().toISOString(),
      completedAt: data.completed_at ? new Date(data.completed_at * 1000).toISOString() : (isCompleted ? new Date().toISOString() : undefined),
      costEstimateUsd: data.model?.includes('pro') ? 0.35 : 0.10
    };
  }
}

export const videoProviderRegistry: Record<string, VideoProvider> = {
  openai: new OpenAISoraProvider(),
  'sora-2': new OpenAISoraProvider(),
  'sora-2-pro': new OpenAISoraProvider(),
  'creative': new OpenAISoraProvider(),
  'super-creative': new OpenAISoraProvider(),
};

export function getVideoProvider(providerName?: string): VideoProvider {
  return videoProviderRegistry.openai;
}

