export type QueuePriority = 'LOW' | 'HIGH' | 'HIGHEST';

export interface QueueJob<T = any> {
  id: string;
  userId: string;
  userPlan: 'free' | 'plus' | 'pro';
  priority: QueuePriority;
  modelId: string;
  createdAt: number; // timestamp
  startedAt?: number; // timestamp
  completedAt?: number; // timestamp
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  execute: () => Promise<T>;
  abortController?: AbortController;
}

export interface QueueResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  waitTimeMs: number;
  executionTimeMs: number;
}

export interface QueueMetrics {
  currentQueueLength: number;
  averageWaitTimeMs: number;
  averageExecutionTimeMs: number;
  jobsCompleted: number;
  jobsFailed: number;
  queueUtilization: number;
}

export interface QueueStatistics {
  metrics: QueueMetrics;
  activeJobsCount: number;
  queuedJobsCount: number;
}

class IntelligentPriorityQueue {
  private jobs: Map<string, QueueJob> = new Map();
  private activeJobsCount = 0;
  private maxConcurrent = 10; // Max global concurrent executions
  private globalMaxQueueLength = 100;

  // Track historical metrics for rolling averages
  private totalWaitTime = 0;
  private totalExecutionTime = 0;
  private completedCount = 0;
  private failedCount = 0;

  // Track last request time per user for cooldown enforcement
  private userLastRequestTime: Map<string, number> = new Map();

  constructor() {
    // Run automatic cleanup of stale jobs every 10 seconds
    if (typeof window === 'undefined') {
      setInterval(() => this.cleanupStaleJobs(), 10000);
    }
  }

  /**
   * Maps subscription plans to priority levels.
   */
  public getPriorityForPlan(plan: 'free' | 'plus' | 'pro'): QueuePriority {
    switch (plan) {
      case 'pro':
        return 'HIGHEST';
      case 'plus':
        return 'HIGH';
      case 'free':
      default:
        return 'LOW';
    }
  }

  /**
   * Burst Protection & Cooldown check.
   * Returns null if clean, or an error string if rejected.
   */
  public checkRateLimits(userId: string, plan: 'free' | 'plus' | 'pro'): string | null {
    const activeUserJobs = Array.from(this.jobs.values()).filter(
      (j) => j.userId === userId && (j.status === 'queued' || j.status === 'processing')
    );

    const queuedUserJobsCount = activeUserJobs.filter((j) => j.status === 'queued').length;
    const concurrentUserJobsCount = activeUserJobs.filter((j) => j.status === 'processing').length;

    // Plan-specific limits
    const maxConcurrent = plan === 'pro' ? 8 : plan === 'plus' ? 4 : 1;
    const maxQueued = plan === 'pro' ? 20 : plan === 'plus' ? 10 : 2;

    if (concurrentUserJobsCount >= maxConcurrent) {
      return `Burst Protection: You have reached the maximum concurrent requests for your plan (${maxConcurrent}).`;
    }

    if (queuedUserJobsCount >= maxQueued) {
      return `Queue Limit: You have too many pending requests. Please wait for them to finish.`;
    }

    if (this.jobs.size >= this.globalMaxQueueLength) {
      return `Server Busy: The global queue is currently full. Please try again in a few moments.`;
    }

    // Cooldown Rules:
    // Free users: 3s cooldown between requests if under heavy load (global active/queued jobs > 5)
    if (plan === 'free') {
      const now = Date.now();
      const lastTime = this.userLastRequestTime.get(userId) || 0;
      const currentLoad = Array.from(this.jobs.values()).filter(
        (j) => j.status === 'queued' || j.status === 'processing'
      ).length;

      if (currentLoad > 5 && now - lastTime < 3000) {
        const remaining = Math.ceil((3000 - (now - lastTime)) / 1000);
        return `Cooldown Active: Please wait ${remaining}s before sending another request (System is under heavy load).`;
      }
    }

    return null;
  }

  /**
   * Enqueues a new AI generation task.
   */
  public async enqueue<T>(
    userId: string,
    plan: 'free' | 'plus' | 'pro',
    modelId: string,
    executeFn: () => Promise<T>,
    abortController?: AbortController,
    customJobId?: string
  ): Promise<QueueResult<T>> {
    const startTime = Date.now();

    // 1. Check Burst Protection & Cooldowns
    const rateLimitError = this.checkRateLimits(userId, plan);
    if (rateLimitError) {
      return {
        success: false,
        error: rateLimitError,
        waitTimeMs: 0,
        executionTimeMs: 0,
      };
    }

    // Update cooldown timestamp
    this.userLastRequestTime.set(userId, startTime);

    const priority = this.getPriorityForPlan(plan);
    const jobId = customJobId || Math.random().toString(36).substring(2, 15);

    const job: QueueJob<T> = {
      id: jobId,
      userId,
      userPlan: plan,
      priority,
      modelId,
      createdAt: startTime,
      status: 'queued',
      execute: executeFn,
      abortController,
    };

    this.jobs.set(jobId, job);

    console.log(`[Queue Enqueued] JobId: ${jobId}, User: ${userId}, Plan: ${plan}, Priority: ${priority}, Model: ${modelId}`);

    // Trigger dispatcher check
    this.dispatch();

    // 2. Wait until the job starts or is cancelled/failed
    return new Promise<QueueResult<T>>((resolve) => {
      const checkInterval = setInterval(() => {
        const currentJob = this.jobs.get(jobId);

        if (!currentJob) {
          clearInterval(checkInterval);
          resolve({
            success: false,
            error: 'Job disappeared or cleaned up.',
            waitTimeMs: Date.now() - startTime,
            executionTimeMs: 0,
          });
          return;
        }

        if (currentJob.status === 'cancelled') {
          clearInterval(checkInterval);
          resolve({
            success: false,
            error: 'Request aborted by user.',
            waitTimeMs: Date.now() - startTime,
            executionTimeMs: 0,
          });
          return;
        }

        if (currentJob.status === 'failed') {
          clearInterval(checkInterval);
          const waitTime = (currentJob.startedAt || Date.now()) - currentJob.createdAt;
          const execTime = (currentJob.completedAt || Date.now()) - (currentJob.startedAt || Date.now());
          resolve({
            success: false,
            error: 'Execution failed.',
            waitTimeMs: waitTime,
            executionTimeMs: execTime,
          });
          return;
        }

        if (currentJob.status === 'completed') {
          clearInterval(checkInterval);
          const waitTime = (currentJob.startedAt || Date.now()) - currentJob.createdAt;
          const execTime = (currentJob.completedAt || Date.now()) - (currentJob.startedAt || Date.now());
          resolve({
            success: true,
            waitTimeMs: waitTime,
            executionTimeMs: execTime,
          });
          return;
        }
      }, 50);
    });
  }

  /**
   * Core dispatcher logic.
   * Employs starvation-free scheduling (aging).
   */
  private async dispatch() {
    if (this.activeJobsCount >= this.maxConcurrent) {
      return;
    }

    // Gather all queued jobs
    const queuedJobs = Array.from(this.jobs.values()).filter((j) => j.status === 'queued');
    if (queuedJobs.length === 0) {
      return;
    }

    const now = Date.now();

    // Sort with Starvation-Free Aging Algorithm
    // Base weight for priorities: LOW = 0, HIGH = 10, HIGHEST = 25
    // Aging factor: We add 1 point for every 500ms spent waiting in the queue.
    const getJobScore = (job: QueueJob) => {
      let baseScore = 0;
      if (job.priority === 'HIGH') baseScore = 10;
      if (job.priority === 'HIGHEST') baseScore = 25;

      const waitTimeMs = now - job.createdAt;
      const agingScore = waitTimeMs / 500; // 2 points per second

      return baseScore + agingScore;
    };

    queuedJobs.sort((a, b) => getJobScore(b) - getJobScore(a));

    // Execute the top scoring job
    const jobToExecute = queuedJobs[0];
    this.activeJobsCount++;
    jobToExecute.status = 'processing';
    jobToExecute.startedAt = now;

    const waitTime = now - jobToExecute.createdAt;
    this.totalWaitTime += waitTime;

    console.log(`[Queue Dispatch] JobId: ${jobToExecute.id}, Plan: ${jobToExecute.userPlan}, Priority: ${jobToExecute.priority}, Wait Time: ${waitTime}ms`);

    // Run execution payload asynchronously so dispatcher remains non-blocking
    (async () => {
      try {
        await jobToExecute.execute();
        jobToExecute.status = 'completed';
        this.completedCount++;
      } catch (err: any) {
        console.error(`[Queue Execution Failed] JobId: ${jobToExecute.id}:`, err);
        jobToExecute.status = 'failed';
        this.failedCount++;
      } finally {
        jobToExecute.completedAt = Date.now();
        const executionTime = jobToExecute.completedAt - (jobToExecute.startedAt || now);
        this.totalExecutionTime += executionTime;

        this.activeJobsCount--;

        // Complying with instruction: Server-side logs
        console.log(`[Smart Queue Metrics Event]
  - User ID: ${jobToExecute.userId}
  - Plan: ${jobToExecute.userPlan}
  - Priority: ${jobToExecute.priority}
  - Model: ${jobToExecute.modelId}
  - Queue Wait: ${waitTime}ms
  - Execution Time: ${executionTime}ms
  - Status: ${jobToExecute.status}`);

        // Safe memory removal after completion
        this.jobs.delete(jobToExecute.id);

        // Keep dispatching
        this.dispatch();
      }
    })();
  }

  /**
   * Explicitly cancels a job (e.g. if a user aborts / closes the connection)
   */
  public cancelJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      if (job.status === 'queued') {
        job.status = 'cancelled';
        console.log(`[Queue Aborted] Queued JobId ${jobId} successfully cancelled.`);
        this.jobs.delete(jobId);
      } else if (job.status === 'processing') {
        job.status = 'cancelled';
        console.log(`[Queue Aborted] Processing JobId ${jobId} cancelled. Invoking AbortController.`);
        if (job.abortController) {
          try {
            job.abortController.abort();
          } catch (e) {
            // Safe abort guard
          }
        }
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Garbage collects stale jobs that might have timed out or been abandoned (stuck in queue/processing for > 2 mins)
   */
  private cleanupStaleJobs() {
    const now = Date.now();
    const TIMEOUT_THRESHOLD = 2 * 60 * 1000; // 2 minutes

    for (const [id, job] of this.jobs.entries()) {
      const age = now - job.createdAt;
      if (age > TIMEOUT_THRESHOLD) {
        console.warn(`[Queue Garbage Collection] Cleaning up stale job: ${id} (Age: ${Math.round(age / 1000)}s, Status: ${job.status})`);
        if (job.status === 'processing') {
          this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
        }
        this.jobs.delete(id);
      }
    }
  }

  /**
   * Retrieve active performance statistics
   */
  public getStatistics(): QueueStatistics {
    const all = Array.from(this.jobs.values());
    const queuedCount = all.filter((j) => j.status === 'queued').length;
    const processingCount = all.filter((j) => j.status === 'processing').length;

    const totalJobsProcessed = this.completedCount + this.failedCount;
    const averageWaitTimeMs = totalJobsProcessed > 0 ? this.totalWaitTime / totalJobsProcessed : 0;
    const averageExecutionTimeMs = totalJobsProcessed > 0 ? this.totalExecutionTime / totalJobsProcessed : 0;

    const queueUtilization = this.maxConcurrent > 0 ? (processingCount / this.maxConcurrent) * 100 : 0;

    return {
      activeJobsCount: processingCount,
      queuedJobsCount: queuedCount,
      metrics: {
        currentQueueLength: queuedCount,
        averageWaitTimeMs,
        averageExecutionTimeMs,
        jobsCompleted: this.completedCount,
        jobsFailed: this.failedCount,
        queueUtilization,
      },
    };
  }
}

// Singleton global queue
export const priorityQueue = new IntelligentPriorityQueue();
