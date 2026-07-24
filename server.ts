import express from "express";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import crypto from "crypto";
import { getModel, canUseModel, getDefaultModel, getAvailableModels, MODEL_MAP, INTERNAL_TO_API_MAP } from "./src/ai/modelCatalog.js";
import { routeRequest } from "./src/ai/router.js";
import { priorityQueue } from "./src/ai/priorityQueue.js";

// Import Vite types only for type checking
import type { ViteDevServer } from "vite";
import { checkLimit, incrementUsage, getUserUsage, getPlanLimits, getRemainingCapacity, CAPACITY_WARNING_THRESHOLD } from "./src/lib/usageService.js";
import { getSubscription, updateSubscription } from "./src/lib/subscriptionService.js";
import { getPaymentAdapter } from "./src/lib/paymentService.js";
import { getPlan, getPaymentConfiguration } from "./src/subscription/catalog.js";
import { 
  activateSubscription, 
  renewSubscription, 
  cancelSubscription, 
  expireSubscription, 
  downgradeToFree, 
  changePlan, 
  syncSubscription, 
  validateSubscription 
} from "./src/subscription/subscriptionLifecycleService.js";
import { selectRelevantMemories, formatMemoriesForSystemPrompt } from "./src/lib/memoryService.js";
import { getServerUserMemories, saveServerUserMemory, extractAndStoreMemoriesFromChat } from "./src/lib/serverMemoryService.js";

console.log("Server script starting...");
dotenv.config();

// --- Unified Supabase & Authentication Infrastructure ---
let supabaseClientInstance: any = null;

function getSupabaseAdminClient(): any {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error("[Supabase] SUPABASE_URL is not defined in environment variables.");
    throw new Error("Supabase URL is required but missing in server configuration.");
  }

  // Validate Service Role Key or fallback to Anon Key
  let isValidJWT = false;
  if (supabaseKey && !supabaseKey.includes("your_supabase")) {
    const parts = supabaseKey.split(".");
    isValidJWT = parts.length === 3 && supabaseKey.startsWith("eyJ");
  }

  if (!isValidJWT) {
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q";
    if (anonKey && anonKey.startsWith("eyJ") && anonKey.split(".").length === 3) {
      console.warn("[Supabase] SUPABASE_SERVICE_ROLE_KEY missing or invalid. Falling back to SUPABASE_ANON_KEY.");
      supabaseKey = anonKey;
    } else {
      console.error("[Supabase] CRITICAL: Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is a valid JWT!");
      throw new Error("Supabase API key is invalid or missing in server configuration.");
    }
  }

  console.log(`[Supabase] Initializing client with URL: ${supabaseUrl}`);
  supabaseClientInstance = createClient<any>(supabaseUrl, supabaseKey);
  return supabaseClientInstance;
}

/**
 * Reusable helper to authenticate and retrieve the user from the authorization header.
 */
async function authenticateUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw { status: 401, error: "Unauthorized: Missing session token." };
  }

  const token = authHeader.split(" ")[1];
  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (err: any) {
    console.error("[Supabase] Client initialization failed during authentication:", err);
    throw { status: 500, error: "Database configuration error: Failed to initialize database client." };
  }

  try {
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      console.warn("[Authentication] User validation failed with token");
      throw { status: 401, error: "Unauthorized: Invalid session token." };
    }
    const user = userData.user;
    
    // Automatically validate and synchronize subscription (STEP 9)
    try {
      await validateSubscription(supabase, user.id);
    } catch (syncErr: any) {
      console.error(`[Subscription Validation Error] Failed to validate/sync subscription for user ${user.id}:`, syncErr.message || syncErr);
    }

    return user;
  } catch (err: any) {
    if (err.status) throw err;
    console.error("[Authentication] Error checking token:", err);
    throw { status: 401, error: "Unauthorized: Failed to authenticate token." };
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({
  verify: (req: any, res, buf) => {
    if (req.originalUrl.startsWith('/api/stripe/webhook') || req.originalUrl.startsWith('/api/payment/webhook')) {
      req.rawBody = buf;
    }
  }
}));

// Global request logger
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.url}`);
  }
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    hasOpenAIApiKey: !!process.env.OPENAI_API_KEY,
    hasTavilyApiKey: !!process.env.TAVILY_API_KEY,
    environment: process.env.VERCEL ? 'vercel' : 'local'
  });
});

// Organization API: Get Invitation Details by Token
app.get("/api/organizations/invitations/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const supabase = getSupabaseAdminClient();
    
    const { data: invitation, error } = await supabase
      .from("organization_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error || !invitation) {
      return res.status(404).json({ error: "Invitation not found or expired" });
    }

    let orgName = "Organization";
    let orgLogo = null;

    if (invitation.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, logo_url")
        .eq("id", invitation.organization_id)
        .maybeSingle();
      if (org) {
        orgName = org.name;
        orgLogo = org.logo_url;
      }
    }

    res.json({
      invitation: {
        ...invitation,
        organization_name: orgName,
        organization_logo: orgLogo,
      }
    });
  } catch (error: any) {
    console.error("[Org Invitation GET API Error]:", error);
    res.status(500).json({ error: "Failed to fetch invitation details" });
  }
});

// Organization API: Accept Invitation
app.post("/api/organizations/invitations/accept", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Invitation token required" });
    }

    const supabase = getSupabaseAdminClient();

    // Fetch invitation
    const { data: invite, error } = await supabase
      .from("organization_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error || !invite) {
      return res.status(404).json({ error: "Invalid or expired invitation token" });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: "This invitation has expired" });
    }

    // Add user as member
    const { error: memError } = await supabase
      .from("organization_members")
      .upsert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.role,
        status: "active",
        joined_at: new Date().toISOString()
      }, { onConflict: "organization_id,user_id" });

    if (memError) {
      console.error("[Org Accept Invite Error]:", memError);
      return res.status(500).json({ error: "Failed to join organization" });
    }

    // Delete invitation
    await supabase.from("organization_invitations").delete().eq("id", invite.id);

    res.json({ status: "success", organization_id: invite.organization_id });
  } catch (error: any) {
    console.error("[Org Accept Invite API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to accept invitation" });
  }
});

// Organization API: Fast Search across Members, Projects, Invitations
app.get("/api/organizations/:id/search", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const orgId = req.params.id;
    const query = String(req.query.q || "").toLowerCase().trim();

    const supabase = getSupabaseAdminClient();

    // Verify user is member of org
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: "Access denied to organization" });
    }

    // Perform queries
    const [{ data: members }, { data: projects }, { data: invitations }] = await Promise.all([
      supabase.from("organization_members").select("*, profiles(name, email, avatar_url)").eq("organization_id", orgId),
      supabase.from("projects").select("*").eq("organization_id", orgId),
      supabase.from("organization_invitations").select("*").eq("organization_id", orgId)
    ]);

    const filteredMembers = (members || []).filter((m: any) => 
      !query || 
      m.profiles?.name?.toLowerCase().includes(query) ||
      m.profiles?.email?.toLowerCase().includes(query) ||
      m.role.toLowerCase().includes(query)
    );

    const filteredProjects = (projects || []).filter((p: any) =>
      !query || p.title.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query))
    );

    const filteredInvitations = (invitations || []).filter((i: any) =>
      !query || i.email.toLowerCase().includes(query) || i.role.toLowerCase().includes(query)
    );

    res.json({
      members: filteredMembers,
      projects: filteredProjects,
      invitations: filteredInvitations
    });
  } catch (error: any) {
    console.error("[Org Search API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Search failed" });
  }
});

// Organization API: Admin Ready Usage & Stats Endpoint
app.get("/api/organizations/:id/stats", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const orgId = req.params.id;
    const supabase = getSupabaseAdminClient();

    const [
      { count: memberCount },
      { count: projectCount },
      { count: conversationCount },
      { count: fileCount }
    ] = await Promise.all([
      supabase.from("organization_members").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("projects").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("organization_files").select("*", { count: "exact", head: true }).eq("organization_id", orgId)
    ]);

    res.json({
      organization_id: orgId,
      memberCount: memberCount || 0,
      projectCount: projectCount || 0,
      conversationCount: conversationCount || 0,
      fileCount: fileCount || 0,
      storageUsedBytes: (fileCount || 0) * 1024 * 512,
    });
  } catch (error: any) {
    console.error("[Org Stats API Error]:", error);
    res.status(error.status || 500).json({ error: "Failed to fetch organization stats" });
  }
});

// Explicit subscription synchronization endpoint
app.post("/api/subscription/sync", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    await validateSubscription(supabase, user.id);
    const details = await getSubscription(supabase, user.id);
    res.json({ status: "success", subscription: details });
  } catch (error: any) {
    console.error("[Subscription Sync API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to sync subscription" });
  }
});

// Subscription and detailed usage endpoint
app.get("/api/subscription/usage", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    
    try {
      await validateSubscription(supabase, user.id);
    } catch (valErr: any) {
      console.warn("[Subscription Usage] Non-blocking validateSubscription warning:", valErr?.message || valErr);
    }

    const profile = await getSubscription(supabase, user.id);
    const usage = await getUserUsage(supabase, user.id);
    const plan = (profile?.current_plan || 'free').toLowerCase();
    const limits = await getPlanLimits(supabase, plan);

    let totalCapacity = 100;
    if (plan === 'plus') totalCapacity = 2000;
    if (plan === 'pro') totalCapacity = 10000;

    const used = usage?.daily_ai_capacity_used ?? 0;
    const bonus = usage?.rewarded_bonus?.ai_capacity ?? 0;
    const limit = (totalCapacity + bonus) || 100;

    const nearingLimit = limit > 0 ? (used / limit) >= CAPACITY_WARNING_THRESHOLD : false;
    const limitReached = used >= limit;

    const capacity_status = nearingLimit ? "AI usage running low" : "AI usage available";

    res.json({
      usage: usage || {},
      limits: limits || {},
      profile: profile || {},
      capacity_status,
      nearingLimit,
      limitReached,
      tts_used: usage?.tts_characters_used_monthly ?? 0,
      tts_limit: limits?.tts_monthly_limit ?? 10000
    });
  } catch (error: any) {
    console.error("[Subscription Usage API Error]:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({ error: error.error || error.message || "Failed to fetch usage info" });
  }
});

// Cancel subscription endpoint
app.post("/api/subscription/cancel", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    await cancelSubscription(supabase, user.id);
    const details = await getSubscription(supabase, user.id);
    res.json({ status: "success", subscription: details });
  } catch (error: any) {
    console.error("[Subscription Cancel API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to cancel subscription" });
  }
});

// Resume subscription endpoint
app.post("/api/subscription/resume", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    const profile = await getSubscription(supabase, user.id);
    if (profile.subscription_status === 'CANCELLED') {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_status: 'ACTIVE', updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
    }
    const details = await getSubscription(supabase, user.id);
    res.json({ status: "success", subscription: details });
  } catch (error: any) {
    console.error("[Subscription Resume API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to resume subscription" });
  }
});



// --- Persistent Memory System Endpoints ---

// GET /api/memory - List all memories for user
app.get("/api/memory", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    const includeArchived = req.query.includeArchived === 'true';
    const memories = await getServerUserMemories(supabase, user.id, includeArchived);
    res.json({ memories });
  } catch (error: any) {
    console.error("[Memory API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to fetch memories" });
  }
});

// POST /api/memory - Create memory
app.post("/api/memory", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    const { memory, category, importance, sourceConversationId } = req.body;
    const result = await saveServerUserMemory(supabase, user.id, memory, category, importance, sourceConversationId);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to save memory" });
    }
    res.json({ status: "success", memory: result.memory, isDuplicate: result.isDuplicate });
  } catch (error: any) {
    console.error("[Memory API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to create memory" });
  }
});

// PUT /api/memory/:id - Update memory
app.put("/api/memory/:id", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    const memoryId = req.params.id;
    const updates = req.body;

    const { data, error } = await supabase
      .from("user_memories")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", memoryId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: "success", memory: data });
  } catch (error: any) {
    console.error("[Memory API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to update memory" });
  }
});

// DELETE /api/memory/all - Delete all memories
app.delete("/api/memory/all", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("user_memories")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;
    res.json({ status: "success" });
  } catch (error: any) {
    console.error("[Memory API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to clear memories" });
  }
});

// DELETE /api/memory/:id - Delete single memory
app.delete("/api/memory/:id", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    const memoryId = req.params.id;

    const { error } = await supabase
      .from("user_memories")
      .delete()
      .eq("id", memoryId)
      .eq("user_id", user.id);

    if (error) throw error;
    res.json({ status: "success" });
  } catch (error: any) {
    console.error("[Memory API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to delete memory" });
  }
});

// POST /api/memory/extract - Post-chat memory extraction
app.post("/api/memory/extract", async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    const { prompt, response, conversationId } = req.body;
    const result = await extractAndStoreMemoriesFromChat(supabase, user.id, prompt, response, conversationId);
    res.json({ status: "success", extractedCount: result.extractedCount, memories: result.memories });
  } catch (error: any) {
    console.error("[Memory Extract API Error]:", error);
    res.status(error.status || 500).json({ error: error.error || error.message || "Failed to extract memories" });
  }
});

// API routes
app.all("/api/proxy-image", async (req, res) => {
  const imageUrl = (req.method === "POST" ? req.body.url : (req.query.url || req.body.url)) as string;
  if (!imageUrl) return res.status(400).send("URL is required");

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      console.warn(`[Proxy Image] Failed to fetch image (Status ${response.status}) for URL: ${imageUrl.substring(0, 150)}`);
      return res.status(response.status || 500).send(`Failed to proxy image: Status ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="image.png"`);
    res.send(buffer);
  } catch (error: any) {
    console.warn(`[Proxy Image] Connection error while fetching URL: ${imageUrl.substring(0, 150)} - Message: ${error?.message || error}`);
    res.status(500).send("Failed to proxy image due to connection/SSL error");
  }
});

app.post("/api/generate", async (req, res) => {
  return handleGenerate(req, res);
});

app.get("/api/models", async (req, res) => {
  try {
    let userId: string | null = null;
    try {
      const user = await authenticateUser(req);
      userId = user.id;
    } catch (authErr) {
      // Auth token might be missing/invalid during anonymous page visits or setup
    }

    let plan = 'free';
    if (userId) {
      const supabase = getSupabaseAdminClient();
      const subscription = await getSubscription(supabase, userId);
      plan = subscription.current_plan || 'free';
    }

    const availableModels = getAvailableModels(plan as any);
    res.json({ models: availableModels });
  } catch (error: any) {
    console.error("[API Models Error]:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve models" });
  }
});

// --- Provider-Agnostic Payment Integration ---

// Generic Checkout Session route
app.post("/api/payment/checkout", async (req, res) => {
  try {
    const { plan, interval, userId, provider: requestedProvider, region } = req.body;
    const origin = req.headers.origin || "https://trelvixai.com";

    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    if (!plan || !interval) return res.status(400).json({ error: 'Plan and interval are required' });

    const provider = requestedProvider || process.env.ACTIVE_PAYMENT_PROVIDER || 'stripe';

    // Provider validation (STEP 7)
    const validProviders = ['stripe', 'paypal', 'paystack', 'sandbox', 'apple', 'google'];
    if (!validProviders.includes(provider.toLowerCase())) {
      return res.status(400).json({ error: `Invalid payment provider: ${provider}` });
    }

    // Plan validation (STEP 7)
    const planId = plan.toLowerCase();
    const validPlans = ['free', 'plus', 'pro'];
    if (!validPlans.includes(planId)) {
      return res.status(400).json({ error: `Unknown plan: ${plan}` });
    }

    // Inactive plan validation (STEP 7)
    const planConfig = getPlan(planId as any);
    if (!planConfig) {
      return res.status(400).json({ error: `Unknown plan: ${plan}` });
    }
    if (planConfig.identity.status !== 'active') {
      return res.status(400).json({ error: `Plan is inactive: ${plan}` });
    }

    // Region validation (STEP 7)
    const userRegion = (region || 'international').toLowerCase();
    const validRegions = ['nigeria', 'international'];
    if (!validRegions.includes(userRegion)) {
      return res.status(400).json({ error: `Unknown region: ${region}` });
    }

    // Payment configuration check for Paystack (STEP 5 & 7)
    if (provider.toLowerCase() === 'paystack') {
      const paymentConfig = getPaymentConfiguration(planId as any, provider.toLowerCase() as any, userRegion as any) as any;
      if (!paymentConfig || !paymentConfig.planCode) {
        const uppercasePlan = planId.toUpperCase();
        const prettyRegion = userRegion === 'nigeria' ? 'Nigeria' : 'International';
        return res.status(400).json({
          error: `Paystack Plan Code has not yet been configured for ${uppercasePlan} (${prettyRegion}).`
        });
      }
    }

    // Instantiates either Stripe, PayPal, or mock/sandbox provider adapter dynamically
    const adapter = getPaymentAdapter(provider);

    console.log(`[Payment Checkout] Creating session using provider: ${provider} for user: ${userId}`);
    const result = await adapter.createCheckoutSession({
      plan,
      interval,
      userId,
      origin,
      region: userRegion,
      user: { id: userId }
    });

    res.json({ url: result.url });
  } catch (error: any) {
    console.error('[Payment Checkout Error]:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred during checkout creation',
      code: error.code || 'checkout_error'
    });
  }
});

// Generic Webhook Processing route
app.post("/api/payment/webhook", async (req: any, res) => {
  const provider = req.query.provider || process.env.ACTIVE_PAYMENT_PROVIDER || 'stripe';
  
  try {
    const adapter = getPaymentAdapter(provider);
    const result = await adapter.verifyWebhook(req.headers, req.rawBody);

    if (result) {
      const { userId, plan, interval, provider: resolvedProvider, eventType } = result;
      console.log(`[Payment Webhook] Webhook validated via ${resolvedProvider} (${eventType}) for user: ${userId}`);

      const supabase = getSupabaseAdminClient();

      if (eventType === 'subscription.cancelled' || eventType === 'customer.subscription.deleted') {
        await cancelSubscription(supabase, userId);
      } else if (eventType === 'invoice.payment_failed' || eventType === 'subscription.expired') {
        await expireSubscription(supabase, userId);
      } else if (eventType === 'invoice.paid') {
        await renewSubscription(supabase, userId, (interval || 'month') as any);
      } else {
        const planId = plan ? (plan.toLowerCase() as any) : 'plus';
        await activateSubscription(
          supabase,
          userId,
          planId,
          resolvedProvider as any,
          'international',
          (interval || 'month') as any
        );
      }
    } else {
      console.log(`[Payment Webhook] Event processed but did not require profile updates.`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error(`[Payment Webhook Error] (${provider}): ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Backwards compatibility legacy wrappers
app.post("/api/stripe/checkout", async (req, res) => {
  req.body.provider = 'stripe';
  res.redirect(307, '/api/payment/checkout');
});

app.post("/api/stripe/webhook", async (req, res) => {
  res.redirect(307, '/api/payment/webhook?provider=stripe');
});

// --- ElevenLabs Text to Speech Integration ---

let voicesCache: {
  data: any[];
  timestamp: number;
} | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1-minute memory cache for ElevenLabs voices list

/**
 * Fetches the voices from ElevenLabs or retrieves them from the local short-term memory cache.
 */
async function getElevenLabsVoices(apiKey: string): Promise<any[]> {
  const now = Date.now();
  if (voicesCache && (now - voicesCache.timestamp < CACHE_TTL_MS)) {
    return voicesCache.data;
  }

  console.log("[TextToSpeech] Fetching voices from ElevenLabs API...");
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    let errorDetails = "";
    try {
      const errJson = await response.json();
      errorDetails = errJson?.detail?.message || JSON.stringify(errJson);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(`ElevenLabs API failed with status ${response.status}: ${errorDetails}`);
  }

  const json = await response.json();
  const rawVoices = json.voices || [];
  const processedVoices = rawVoices.map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels || {},
    preview_url: v.preview_url || "",
  }));

  voicesCache = {
    data: processedVoices,
    timestamp: now,
  };

  return processedVoices;
}

/**
 * Endpoint to retrieve available ElevenLabs voices.
 */
async function handleGetVoices(req: express.Request, res: express.Response) {
  console.log("[TTS] [Voices] Voices list request received");
  
  try {
    const user = await authenticateUser(req);
    console.log(`[TTS] [Voices] Authenticated user: ${user.email} (ID: ${user.id})`);

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      console.error("[TTS] [ElevenLabs] Missing ELEVENLABS_API_KEY in environment");
      return res.status(500).json({ error: "ElevenLabs API Key is missing in server configuration." });
    }

    const voices = await getElevenLabsVoices(elevenLabsApiKey);
    console.log(`[TTS] [ElevenLabs] Successfully loaded ${voices.length} voices`);
    return res.json({ voices });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.error });
    }
    console.error("[TTS] [Voices] Failed to retrieve voices:", err);
    return res.status(500).json({ error: err.message || "Failed to retrieve voices from ElevenLabs." });
  }
}

app.get("/api/text-to-speech/voices", handleGetVoices);
app.get("/api/tools/text-to-speech/voices", handleGetVoices);

// --- Provider-Agnostic TTS Architecture ---

export interface TTSProvider {
  name: string;
  generateSpeech(params: {
    text: string;
    voiceId: string;
    modelId: string;
    stability?: number;
    similarity?: number;
    style?: number;
  }): Promise<{
    buffer: Buffer;
    latencyMs: number;
    modelUsed: string;
    voiceUsed: string;
  }>;
}

const ElevenLabsProvider: TTSProvider = {
  name: "elevenlabs",
  async generateSpeech({ text, voiceId, modelId, stability, similarity, style }) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ElevenLabs API Key is missing in server configuration.");
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        "accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: stability ?? 0.75,
          similarity_boost: similarity ?? 0.85,
          style: style ?? 0.0
        }
      })
    });

    if (!response.ok) {
      let errorDetails = "";
      try {
        const errJson = await response.json();
        errorDetails = errJson?.detail?.message || JSON.stringify(errJson);
      } catch {
        errorDetails = await response.text();
      }
      throw new Error(`ElevenLabs API failed with status ${response.status}: ${errorDetails}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      latencyMs: 0, // Calculated accurately by the handler
      modelUsed: modelId,
      voiceUsed: voiceId
    };
  }
};

const activeProvider: TTSProvider = ElevenLabsProvider;

// Text to Speech Generation Endpoint
app.post("/api/tools/text-to-speech", async (req, res) => {
  const requestId = crypto.randomUUID();
  console.log(`[TTS][Request: ${requestId}] Speech synthesis request received`);

  let user: any = null;
  let supabase: any = null;

  try {
    user = await authenticateUser(req);
    console.log(`[TTS][Request: ${requestId}] Authenticated User: ${user.email} (ID: ${user.id})`);
  } catch (err: any) {
    console.error(`[TTS][Request: ${requestId}] Authentication failed:`, err);
    if (err.status) {
      return res.status(err.status).json({ error: err.error });
    }
    return res.status(500).json({ error: "Failed to initialize request authorization." });
  }

  try {
    supabase = getSupabaseAdminClient();
  } catch (err: any) {
    console.error(`[TTS][Request: ${requestId}] [Database Client Failed] Exception during initialization:`, err.message);
    return res.status(500).json({ error: `Database configuration error: ${err.message}` });
  }

  const { text, voice, voiceId, model, modelId, speed = 1.0, stability = 0.75, similarity = 0.85, style = 0.0 } = req.body;
  
  // Extract and prefer explicit ElevenLabs parameters over legacy fields
  const targetVoiceId = voiceId || voice;
  let targetModelId = modelId || model || "eleven_turbo_v2_5";

  // Sanitize and map legacy OpenAI models to valid ElevenLabs models
  if (targetModelId === "tts-1" || targetModelId === "gpt-4o-mini-tts" || targetModelId === "gpt-4o-tts") {
    targetModelId = "eleven_turbo_v2_5";
  } else if (targetModelId === "tts-1-hd") {
    targetModelId = "eleven_multilingual_v2";
  }

  // Validate the ElevenLabs model ID defensively
  const VALID_ELEVENLABS_MODELS = [
    "eleven_turbo_v2_5",
    "eleven_multilingual_v2",
    "eleven_monolingual_v1",
    "eleven_turbo_v2",
    "eleven_flash_v2_5",
    "eleven_flash_v2"
  ];

  if (!VALID_ELEVENLABS_MODELS.includes(targetModelId)) {
    console.error(`[TTS][Request: ${requestId}] Invalid model ID requested: "${targetModelId}"`);
    return res.status(400).json({
      error: `Invalid model ID: "${targetModelId}". Please select a valid ElevenLabs model (e.g., "eleven_turbo_v2_5" or "eleven_multilingual_v2").`
    });
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    console.error(`[TTS][Request: ${requestId}] Validation failed: text payload is empty`);
    return res.status(400).json({ error: "Text payload is required." });
  }

  if (!targetVoiceId) {
    console.error(`[TTS][Request: ${requestId}] Validation failed: voice ID is missing`);
    return res.status(400).json({ error: "Voice ID is required." });
  }

  const characterCount = text.length;

  // 1. Check Subscriptions and Plan Limits using the Centralized Limit Engine
  let allowed = true;
  let reason = "";

  try {
    const limitResult = await checkLimit(supabase, user.id, 'tts', characterCount);
    allowed = limitResult.allowed;
    reason = limitResult.reason || "";
  } catch (err: any) {
    console.error(`[TTS][Request: ${requestId}] Central limit check failed:`, err.message);
    allowed = false;
    reason = "Failed to verify character usage limit.";
  }

  if (!allowed) {
    console.warn(`[TTS][Request: ${requestId}] Limit validation rejected request. Reason: ${reason}`);
    return res.status(403).json({ error: reason || "Monthly character limit reached." });
  }

  console.log(`[TTS][Request: ${requestId}] Limits Validated`);

  // Resolve human-readable voice name dynamically in backend if possible
  let voiceName = targetVoiceId;
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsApiKey) {
    try {
      const voices = await getElevenLabsVoices(elevenLabsApiKey);
      const foundVoice = voices.find((v: any) => v.voice_id === targetVoiceId);
      if (foundVoice) {
        voiceName = foundVoice.name;
      }
    } catch (vErr: any) {
      console.warn(`[TTS][Request: ${requestId}] Voice name dynamic resolution warning:`, vErr?.message || vErr);
    }
  }

  // 3. Create Pending Generation Record - Fail loudly, do not continue on failure
  let generationId: string | null = null;
  const createdAt = new Date().toISOString();

  try {
    const { data: genLog, error: insertErr } = await supabase
      .from("tts_generations")
      .insert({
        user_id: user.id,
        character_count: characterCount,
        selected_voice: targetVoiceId,
        selected_model: targetModelId,
        generation_status: "pending",
        provider: activeProvider.name,
        voice_id: targetVoiceId,
        metadata: {
          original_text: text,
          text_snippet: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
          voice_id: targetVoiceId,
          voice_name: voiceName,
          selected_model: targetModelId,
          speed: speed,
          created_at: createdAt,
          request_id: requestId
        }
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(`[TTS][Request: ${requestId}] [Database insert failed] Error creating log record:`, insertErr);
      return res.status(500).json({ error: `Failed to record speech generation history: ${insertErr.message}` });
    }

    if (!genLog) {
      console.error(`[TTS][Request: ${requestId}] [Database insert failed] No generation log returned`);
      return res.status(500).json({ error: "Failed to create speech generation log." });
    }

    generationId = genLog.id;
    console.log(`[TTS][Request: ${requestId}] Pending Record Created (ID: ${generationId})`);
  } catch (dbInsertErr: any) {
    console.error(`[TTS][Request: ${requestId}] [Database insert failed] Exception during insert:`, dbInsertErr?.message || dbInsertErr);
    return res.status(500).json({ error: `Database insert exception: ${dbInsertErr?.message || dbInsertErr}` });
  }

  // 4. Generate audio via our provider abstraction
  console.log(`[TTS][Request: ${requestId}] ${activeProvider.name.toUpperCase()} Generation Started`);
  const startTime = Date.now();
  let audioBuffer: Buffer;
  let latencyMs = 0;

  try {
    const generationResult = await activeProvider.generateSpeech({
      text,
      voiceId: targetVoiceId,
      modelId: targetModelId,
      stability,
      similarity,
      style
    });

    audioBuffer = generationResult.buffer;
    latencyMs = Date.now() - startTime;
    console.log(`[TTS][Request: ${requestId}] ${activeProvider.name.toUpperCase()} Generation Completed (${latencyMs} ms)`);
  } catch (providerErr: any) {
    const errorMsg = providerErr?.message || "Speech synthesis failed.";
    console.error(`[TTS][Request: ${requestId}] [Generation Failed] Provider Error:`, errorMsg);

    // Update state to failed in DB so it doesn't get stuck in pending
    if (generationId) {
      try {
        await supabase
          .from("tts_generations")
          .update({
            generation_status: "failed",
            metadata: {
              original_text: text,
              text_snippet: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
              voice_id: targetVoiceId,
              voice_name: voiceName,
              selected_model: targetModelId,
              speed: speed,
              created_at: createdAt,
              completed_at: new Date().toISOString(),
              request_id: requestId,
              failure_reason: errorMsg,
              provider_error: errorMsg
            }
          })
          .eq("id", generationId);
        console.log(`[TTS][Request: ${requestId}] Record status updated to 'failed' in database`);
      } catch (failedUpdateErr: any) {
        console.error(`[TTS][Request: ${requestId}] Failed to mark record as failed in database:`, failedUpdateErr?.message || failedUpdateErr);
      }
    }

    return res.status(520).json({ error: errorMsg });
  }

  // 5. Attempt Database Completion Update (Non-destructive: we return audio anyway even if this fails)
  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startTime;

  console.log(`[TTS][Request: ${requestId}] Attempting Database Completion Update`);
  try {
    const { error: updateErr } = await supabase
      .from("tts_generations")
      .update({
        generation_status: "completed",
        generation_time_ms: totalDurationMs,
        file_size_bytes: audioBuffer.length,
        metadata: {
          original_text: text,
          text_snippet: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
          voice_id: targetVoiceId,
          voice_name: voiceName,
          selected_model: targetModelId,
          speed: speed,
          created_at: createdAt,
          completed_at: completedAt,
          audio_base64: audioBuffer.toString("base64"),
          request_id: requestId,
          generation_duration_ms: totalDurationMs,
          provider_latency_ms: latencyMs,
          audio_size_bytes: audioBuffer.length,
          provider: activeProvider.name,
          provider_model: targetModelId,
          provider_voice: targetVoiceId
        }
      })
      .eq("id", generationId);

    if (updateErr) {
      console.error(`[TTS][Request: ${requestId}] [Database Update Failed] CRITICAL error updating record:`, updateErr);
      console.error(`[TTS][Request: ${requestId}] [CRITICAL] Speech generated successfully but the history update failed. ID: ${generationId}`);
    } else {
      console.log(`[TTS][Request: ${requestId}] Database Updated Successfully`);

      // Update monthly character quota consumed on profile and centralized tracking
      try {
        await incrementUsage(supabase, user.id, 'tts', characterCount);
        console.log(`[TTS][Request: ${requestId}] Incremented centralized tts characters used by ${characterCount}`);
        
        // Keep legacy profiles.tts_characters_used in sync for complete safety
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("tts_characters_used")
          .eq("id", user.id)
          .single();
        const updatedUsed = (currentProfile?.tts_characters_used || 0) + characterCount;
        await supabase
          .from("profiles")
          .update({ tts_characters_used: updatedUsed })
          .eq("id", user.id);
      } catch (quotaErr: any) {
        console.warn(`[TTS][Request: ${requestId}] Quota update exception:`, quotaErr?.message || quotaErr);
      }
    }
  } catch (dbUpdateException: any) {
    console.error(`[TTS][Request: ${requestId}] [Database Update Failed] Exception during update:`, dbUpdateException?.message || dbUpdateException);
    console.error(`[TTS][Request: ${requestId}] [CRITICAL] Exception updating generation status. Audio generated successfully but untracked. ID: ${generationId}`);
  }

  // 6. Return successfully generated audio to user
  console.log(`[TTS][Request: ${requestId}] Returned Audio`);
  res.set({
    "Content-Type": "audio/mpeg",
    "Content-Length": audioBuffer.length,
    "Accept-Ranges": "bytes"
  });
  return res.send(audioBuffer);
});

// Retrieve generated past audio from tracking database
app.get("/api/tools/text-to-speech/retrieve/:id", async (req, res) => {
  const retrieveRequestId = crypto.randomUUID();
  console.log(`[TTS][Request: ${retrieveRequestId}] Retrieval request received for ID: ${req.params.id}`);

  try {
    const user = await authenticateUser(req);
    const supabase = getSupabaseAdminClient();
    const { id } = req.params;

    if (!id) {
      console.error(`[TTS][Request: ${retrieveRequestId}] Missing generation ID parameter`);
      return res.status(400).json({ error: "Generation ID parameter is required." });
    }

    console.log(`[TTS][Request: ${retrieveRequestId}] Fetching generation ${id} for user ${user.email}`);

    const { data: genLog, error: fetchErr } = await supabase
      .from("tts_generations")
      .select("metadata")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !genLog || !genLog.metadata?.audio_base64) {
      console.warn(`[TTS][Request: ${retrieveRequestId}] Record or audio not found for ID: ${id}`);
      return res.status(404).json({ error: "Audio record or playback data not found." });
    }

    const buffer = Buffer.from(genLog.metadata.audio_base64, "base64");
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length
    });
    console.log(`[TTS][Request: ${retrieveRequestId}] Audio retrieved successfully`);
    return res.send(buffer);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.error });
    }
    console.error(`[TTS][Request: ${retrieveRequestId}] Exception during audio retrieval:`, err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed to retrieve past audio track." });
  }
});

// Support legacy endpoint
app.post("/api/chat", async (req, res) => {
  return handleGenerate(req, res);
});

// Guard in case any unhandled error or mismatch in /api/ routes occurs
app.use("/api", (req, res, next) => {
  res.status(404).json({ error: `API endpoint ${req.method} ${req.originalUrl} not found`, type: "not_found" });
});

// Global error handler for robust JSON error reporting
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Server Error Handler] Unhandled exception:", err);
  if (req.path.startsWith("/api")) {
    return res.status(err.status || 500).json({
      error: err.message || "Internal server error occurred.",
      type: "internal_error"
    });
  }
  next(err);
});

async function appendReplyToConversation(
  conversationId: string, 
  replyMessage: any, 
  userId?: string, 
  conversationType?: string, 
  previousMessages?: any[],
  isTemporary?: boolean
) {
  if (!conversationId) return;
  try {
    const supabase = getSupabaseAdminClient();
    // Select the existing messages
    const { data: conv, error: fetchErr } = await supabase
      .from('conversations')
      .select('messages')
      .eq('id', conversationId)
      .single();

    if (fetchErr || !conv) {
      if (fetchErr && fetchErr.code === 'PGRST116') {
        const targetUserId = userId || null;
        console.log(`[Server DB] Conversation ${conversationId} not found, attempting creating from fallback (userId: ${targetUserId})...`);
        const initialMessages = previousMessages ? [...previousMessages] : [];
        if (!initialMessages.some(m => m.id === replyMessage.id)) {
          initialMessages.push(replyMessage);
        }
        let titleText = 'New Conversation';
        if (previousMessages && previousMessages.length > 0) {
          titleText = previousMessages[0].content || 'New Conversation';
        } else if (replyMessage && replyMessage.content) {
          titleText = replyMessage.content;
        }
        if (titleText.length > 50) {
          titleText = titleText.slice(0, 48) + '...';
        }

        const newConv: any = {
          id: conversationId,
          user_id: targetUserId,
          title: titleText,
          type: conversationType || 'general',
          messages: initialMessages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        let insertErr;
        if (isTemporary) {
          const { error } = await supabase
            .from('conversations')
            .insert({ ...newConv, is_temporary: true });
          if (error && error.message.includes('is_temporary')) {
            console.warn("[Server DB] Database lacks is_temporary column, retrying fallback insert...");
            const { error: fallbackErr } = await supabase
              .from('conversations')
              .insert(newConv);
            insertErr = fallbackErr;
          } else {
            insertErr = error;
          }
        } else {
          const { error } = await supabase
            .from('conversations')
            .insert(newConv);
          insertErr = error;
        }

        if (insertErr) {
          console.warn(`[Server DB] Could not insert fallback conversation: ${insertErr.message}`);
        } else {
          console.log(`[Server DB] Created conversation ${conversationId} during fallback flow successfully.`);
        }
        return;
      }

      console.error(`[Server DB] Failed to fetch conversation ${conversationId}:`, fetchErr);
      return;
    }

    const currentMessages = conv.messages || [];
    // Only append if the last message in DB is NOT already an assistant reply
    const hasAssisReply = currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant';
    if (!hasAssisReply) {
      const updatedMessages = [...currentMessages, replyMessage];
      const { error: updateErr } = await supabase
        .from('conversations')
        .update({
          messages: updatedMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateErr) {
        console.error(`[Server DB] Failed to update conversation ${conversationId}:`, updateErr);
      } else {
        console.log(`[Server DB] Successfully appended reply to conversation ${conversationId} on backend`);
      }
    } else {
      console.log(`[Server DB] Response already persisted in conversation ${conversationId}, skipping server append.`);
    }
  } catch (err) {
    console.error("[Server DB] Error inside appendReplyToConversation:", err);
  }
}

function formatMessagesForGemini(openAiMessages: any[]) {
  const systemMessage = openAiMessages.find(m => m.role === 'system');
  const systemInstruction = systemMessage ? systemMessage.content : undefined;

  const contents = openAiMessages
    .filter(m => m.role !== 'system')
    .map(m => {
      let role = m.role;
      if (role === 'assistant') {
        role = 'model';
      } else if (role !== 'user' && role !== 'model') {
        role = 'user';
      }
      
      let parts: any[] = [];
      if (typeof m.content === 'string') {
        parts.push({ text: m.content });
      } else if (Array.isArray(m.content)) {
        m.content.forEach((part: any) => {
          if (part.type === 'text') {
            parts.push({ text: part.text });
          } else if (part.type === 'image_url') {
            const url = part.image_url?.url;
            if (url && url.startsWith('data:')) {
              const matches = url.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                parts.push({
                  inlineData: {
                    mimeType: matches[1],
                    data: matches[2]
                  }
                });
              }
            }
          }
        });
      }
      
      if (parts.length === 0) {
        parts.push({ text: "" });
      }
      
      return { role, parts };
    });

  return { contents, systemInstruction };
}

async function handleGenerate(req: express.Request, res: express.Response) {
  let { type, prompt, messages = [], ready_to_copy = false, personality = "creative", model = "gpt-5-nano", autoMode = true, prevModelId, webSearch = false } = req.body;

  let activeTagBackend: string | null = null;
  if (prompt && typeof prompt === 'string') {
    if (prompt.startsWith('@Image')) {
      activeTagBackend = '@Image';
      prompt = prompt.slice('@Image'.length).trim();
    } else if (prompt.startsWith('@Write')) {
      activeTagBackend = '@Write';
      prompt = prompt.slice('@Write'.length).trim();
    } else if (prompt.startsWith('@WebSearch')) {
      activeTagBackend = '@WebSearch';
      prompt = prompt.slice('@WebSearch'.length).trim();
    }
  }

  messages = messages.map((m: any) => {
    if (m && m.content && typeof m.content === 'string') {
      let mContent = m.content;
      if (mContent.startsWith('@Image')) {
        activeTagBackend = activeTagBackend || '@Image';
        mContent = mContent.slice('@Image'.length).trim();
      } else if (mContent.startsWith('@Write')) {
        activeTagBackend = activeTagBackend || '@Write';
        mContent = mContent.slice('@Write'.length).trim();
      } else if (mContent.startsWith('@WebSearch')) {
        activeTagBackend = activeTagBackend || '@WebSearch';
        mContent = mContent.slice('@WebSearch'.length).trim();
      }
      return { ...m, content: mContent };
    }
    return m;
  });

  const needsWebSearch = (text: string) => {
    const searchKeywords = [
      "news", "weather", "price", "today", "latest", "current", "2024", "2025", "2026",
      "politics", "who is", "what happened", "stock", "dollar", "usd", "ngn", "naira",
      "exchange rate", "score", "match", "result", "live", "now", "crypto",
      "happening", "event", "bitcoin", "forecast", "market", "president", 
      "how much is", "price of", "time in", "update on", "current time", "inflation",
      "election", "winner of", "standings in", "scheduled for", "rate in", "worth in",
      "who won", "yesterday", "tonight", "who is currently", "latest on"
    ];
    const lower = text.toLowerCase();
    
    // Force search for financial symbols or currency pairs
    const financialForce = /\b(usd|ngn|eur|gbp|btc|eth|sol)\b/i.test(lower) && 
                          (lower.includes("rate") || lower.includes("price") || lower.includes("worth") || lower.includes("value") || lower.includes("to") || lower.includes("convert"));

    const dateForce = lower.includes("2024") || lower.includes("2025") || lower.includes("2026") || lower.includes("today") || lower.includes("current");

    return financialForce || dateForce || searchKeywords.some(k => lower.includes(k)) || 
           (lower.includes("?") && (lower.includes("who") || lower.includes("how much") || lower.includes("is there") || lower.includes("what happened")));
  };

  console.log(`[Generate] Model: ${model}, Type: ${type}, Personality: ${personality}, Prompt length: ${prompt?.length || 0}`);

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Generate] Missing OPENAI_API_KEY");
      return res.status(500).json({ error: "OpenAI API Key is missing in server environment" });
    }

    const openai = new OpenAI({ apiKey });

    // Early model resolution & backward compatibility mapping
    let requestedModelId = model || 'thinking';
    if (requestedModelId === 'trelvix-mini' || requestedModelId === 'gpt-5-nano') {
      requestedModelId = 'thinking';
    } else if (requestedModelId === 'trelvix-ultra' || requestedModelId === 'gpt-5' || requestedModelId === 'gpt-5-mini') {
      requestedModelId = 'extendedThinking';
    } else if (requestedModelId === 'trelvix-visual' || requestedModelId === 'o4-mini' || requestedModelId === 'o3' || requestedModelId === 'gemini-pro' || requestedModelId === 'gemini-flash') {
      requestedModelId = 'maximumThinking';
    }

    if (requestedModelId !== 'thinking' && requestedModelId !== 'extendedThinking' && requestedModelId !== 'maximumThinking') {
      requestedModelId = 'thinking';
    }

    // 0. Intelligence Controller: Determine the best engine based on intent
    const lastMessageContent = (messages[messages.length - 1]?.content || prompt || "").trim();
    
    // Comprehensive document/file exclusion list to prevent false positive image generation triggers
    const docExclusionFilter = /\b(pdf|docx|xlsx|word|excel|spreadsheet|csv|document|resume|report|cv|curriculum\s*vitae|invoice|presentation|budget|letter|email|cover\s*letter|essay|article|post|text|contract|agreement|outline|syllabus|proposal|workbook|chart|table|schema|blueprint|database)\b/i;

    // Stricter image intent detection: must start with or specifically request an image, or edit an uploaded image
    const lowerLast = lastMessageContent.toLowerCase();
    const fileHasImage = (messages || []).some((m: any) => m.image_url && m.image_url.startsWith("data:image"));
    const isImageIntent = (type === "image" || activeTagBackend === "@Image" || requestedModelId === "extendedThinking" || 
                          (lowerLast.startsWith("generate image") || 
                           lowerLast.startsWith("create image") || 
                           lowerLast.startsWith("draw") || 
                           lowerLast.startsWith("make an image") || 
                           lowerLast.startsWith("paint") || 
                           lowerLast.includes("generate a photorealistic image") || 
                           lowerLast.includes("show me an image of") ||
                           (fileHasImage && /edit|modify|change|more professional|add text|similar style|re-create|recreate/i.test(lowerLast)))) &&
                          !docExclusionFilter.test(lowerLast);
    
    // Explicitly detect if the user wants to compile a document, CV, layout, text sheet or report
    const isDocRequest = docExclusionFilter.test(lastMessageContent);

    // --- Centralized Limit Verification Protocol ---
    let userId = req.body.userId;
    if (!userId && req.headers.authorization) {
      try {
        const authenticatedUser = await authenticateUser(req);
        userId = authenticatedUser.id;
      } catch (err) {
        console.warn("[Generate] Failed to authenticate user from header:", err);
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user authentication context." });
    }

    const supabase = getSupabaseAdminClient();

    // Automatically validate and synchronize subscription (STEP 9)
    try {
      await validateSubscription(supabase, userId);
    } catch (syncErr: any) {
      console.error(`[Subscription Validation Error in handleGenerate] Failed for user ${userId}:`, syncErr.message || syncErr);
    }

    // --- Retrieve active subscription & route intelligently using Phase 3 Smart AI Router ---
    const subscription = await getSubscription(supabase, userId);
    const userPlan = (subscription.current_plan || 'free') as 'free' | 'plus' | 'pro';

    const routeDecision = routeRequest(prompt || '', messages, userPlan, requestedModelId, autoMode !== false, prevModelId);
    let activeModelObj = getModel(routeDecision.selectedModelId) || getDefaultModel(userPlan);

    // Strictly resolve actual API model from centralized configuration maps
    const internalModelId = MODEL_MAP[activeModelObj.id as keyof typeof MODEL_MAP] || MODEL_MAP.thinking;
    const realModel = INTERNAL_TO_API_MAP[internalModelId] || "gpt-4o-mini";
    const currentBranding = activeModelObj.displayName;
    const modelProvider = activeModelObj.provider;

    // Dynamically map intent to centralized usage tracking feature
    let feature: string = 'chat_simple';

    if (isImageIntent) {
      if (fileHasImage) {
        feature = 'image_edit';
      } else {
        feature = 'image_generation';
      }
    } else if (fileHasImage) {
      const lowerPrompt = lastMessageContent.toLowerCase();
      if (lowerPrompt.match(/\b(ocr|extract|read text|transcribe|read the text)\b/)) {
        feature = 'ocr';
      } else {
        feature = 'image_analysis';
      }
    } else if (isDocRequest) {
      const lowerPrompt = lastMessageContent.toLowerCase();
      if (lowerPrompt.includes("pdf")) {
        feature = 'pdf';
      } else {
        feature = 'document_ai';
      }
    } else {
      if (activeModelObj.id === 'maximumThinking') {
        feature = 'chat_maximum';
      } else if (activeModelObj.id === 'extendedThinking') {
        feature = 'chat_reasoning';
      } else {
        feature = 'chat_simple';
      }
    }

    console.log(`[Limit Engine] Checking usage limit for user:${userId} on feature:${feature}`);
    try {
      const limitResult = await checkLimit(supabase, userId, feature, 1);
      if (!limitResult.allowed) {
        console.warn(`[Limit Engine] Limit check REJECTED for user:${userId} on feature:${feature}. Reason: ${limitResult.reason}`);
        return res.status(429).json({ error: limitResult.reason, limitReached: true });
      }
      console.log(`[Limit Engine] Limit check PASSED for user:${userId} on feature:${feature}`);
    } catch (limitErr: any) {
      console.error("[Limit Engine] Error in limit verification pipeline:", limitErr.message);
      // Fallback: allow to prevent downtime if table is missing during setup
    }

    const searchRequired = (webSearch || activeTagBackend === "@WebSearch" || needsWebSearch(lastMessageContent)) && !isImageIntent;

    console.log(`[Intelligence Controller] Resolved Model: ${activeModelObj.id} (API Name: ${realModel}, Provider: ${modelProvider}) for Plan: ${userPlan}, Intent: ${type}, Search: ${searchRequired}`);

    // Helper for Tavily Search
    const searchWeb = async (query: string) => {
      const tavilyKey = process.env.TAVILY_API_KEY;
      
      console.log(`[Search] Initiating Global Search for: ${query}`);
      if (tavilyKey) {
        console.log(`[Search] Using Tavily Key: ${tavilyKey.substring(0, 4)}...`);
      } else {
        console.error(`[Search] ERROR: No TAVILY_API_KEY found in process.env`);
      }
      
      try {
        // 1. Primary engine: Tavily (if key available)
        if (tavilyKey) {
          console.log(`[Search] Calling Tavily API for query: "${query}"`);
          const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: tavilyKey,
              query,
              search_depth: "advanced",
              include_answer: true,
              max_results: 8
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`[Search] Tavily response received. Results count: ${data.results?.length || 0}`);
            if (data.results && data.results.length > 0) {
              const results = data.results.map((r: any) => ({
                title: r.title,
                url: r.url,
                snippet: r.content
              }));
              return `SOURCE_DATA:\n${JSON.stringify(results)}\nSUMMARY: ${data.answer || "Real-time data retrieved."}`;
            } else {
              console.warn(`[Search] Tavily returned no results for query: "${query}"`);
            }
          } else {
            const errorText = await response.text();
            console.error(`[Search] Tavily API failed: ${response.status} ${response.statusText}`, errorText);
          }
        }

        // 2. Fallback Engine: Rapid Information Lookup
        console.warn("[Search] Primary search failed or unavailable, using fallback lookup.");
        return `SEARCH_SYSTEM_STATUS: LIMITED_ACCESS. The AI is currently operating with pre-trained data only for this turn due to search connectivity issues. If the query requires ultra-precise real-time metrics (like live stock prices at this exact second), provide the best available estimate and note the limitation.`;

      } catch (err) {
        console.error("[Search] Critical Search Error:", err);
        return "SEARCH_SYSTEM_OFFLINE. Connectivity logic failed to resolve. Proceed with internal data and model capabilities.";
      }
    };



    // 1. Image Generation
    if (type === "image" || isImageIntent) {
      // Set headers for chunked rendering to prevent gateway timeouts on long image runs
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Write an initial space chunk immediately to flush headers and wake the browser connection
      res.write(" ");

      // Space heartbeat generator - writes a single space byte every 2 seconds to keep the Cloud Run / Vercel gateway active
      const keepAliveInterval = setInterval(() => {
        try {
          if (!res.writableEnded) {
            res.write(" ");
          }
        } catch (e) {
          console.warn("[Keep-Alive] Failed to write heartbeat space chunk:", e);
        }
      }, 2000);

      try {
        let promptText = req.body.prompt || req.body.message || prompt || "a beautiful image";

        console.log("[Image Generation] Original prompt length:", promptText.length);

        // Vision-Guided Image Description & Editing Synthesis (when user has uploaded an image)
        const messagesWithImage = (messages || []).filter((m: any) => m.image_url && m.image_url.startsWith("data:image"));
        const lastImageMessage = messagesWithImage[messagesWithImage.length - 1];

        if (lastImageMessage) {
          console.log("[Image Generation] Uploaded image detected. Utilizing Vision-Guided Image Description & Editing Synthesis (GPT-4o) to merge original visual contents with user edits...");
          try {
            const visionResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: `You are the Trelvix Vision & Image Synthesis Director. A user has uploaded an image and wants to edit, vary, style, or generate a similar image based on it. 
Your job is to look at the user's uploaded image and their editing instructions, and synthesize a single, highly detailed, photorealistic prompt for DALL-E (gpt-image-2 / gpt-image-1) that describes the entire final edited image in perfect English.
To make it look like an edit or variation of the input image:
1. Analyze the original image's style (oil painting, sketch, realist photograph, digital art, logo design, flat design, etc.), subject, composition, background, color theme, and camera perspective in vivid detail to maintain visual continuity.
2. Incorporate the user's editing/modifying instructions perfectly (e.g. adding text, altering clothes, swapping backgrounds, introducing new objects, making it more professional, or generating a similar style).
3. Combine both into a cohesive, highly descriptive paragraph of the desired target image.
4. Output ONLY the raw final image description prompt. Do not add any conversational text, explanations, or pleasantries.`
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: `User request/modifications: "${promptText}"` },
                    { type: "image_url", image_url: { url: lastImageMessage.image_url } }
                  ]
                }
              ],
              max_tokens: 350,
              temperature: 0.7
            });

            const synthesizedPrompt = visionResponse.choices[0]?.message?.content?.trim();
            if (synthesizedPrompt) {
              console.log("[Image Generation] Synthesized Vision-Guided prompt:", synthesizedPrompt);
              promptText = synthesizedPrompt;
            }
          } catch (visionErr) {
            console.error("[Image Generation] Vision-Guided prompt synthesis failed, falling back to conversational text synthesis:", visionErr);
            
            // Fallback to text-only synthesis if vision API fails
            if (messages && messages.length > 1) {
              try {
                console.log(`[Image Generation] Multi-message context fallback (Count: ${messages.length}). Synthesizing cohesive, cumulative image prompt...`);
                const promptSynthesisConversation = [
                  {
                    role: "system",
                    content: "You are the Trelvix Prompt Synthesizer. Your job is to read a conversation history between a user and an AI image assistant, and synthesize a single, detailed, highly descriptive image prompt for DALL-E (the image generator) that incorporates all cumulative details, revisions, adjustments, corrections, elements, and style instructions requested from the entire conversation. Output ONLY the raw final image description prompt. Do not add any conversational text, pleasantries, or explanations. Do not say things like 'Here is the revised prompt'. Produce a single paragraph description of the scene that perfectly captures the latest desired state, preserving the details of the original request except where the user explicitly asked to change them."
                  },
                  ...messages.filter((m: any) => m.role === 'user' || m.role === 'assistant').map((m: any) => ({
                    role: m.role,
                    content: m.content || ""
                  }))
                ];

                const synthesisResponse = await openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: promptSynthesisConversation as any,
                  max_tokens: 350,
                  temperature: 0.7
                });

                const synthesizedPrompt = synthesisResponse.choices[0]?.message?.content?.trim();
                if (synthesizedPrompt) {
                  console.log("[Image Generation] Synthesized Prompt from History:", synthesizedPrompt);
                  promptText = synthesizedPrompt;
                }
              } catch (synthesisError) {
                console.error("[Image Generation] Fallback prompt synthesis failed:", synthesisError);
              }
            }
          }
        } else {
          // Conversational multi-turn image description synthesis using GPT-4o-mini
          if (messages && messages.length > 1) {
            try {
              console.log(`[Image Generation] Multi-message context detected (Count: ${messages.length}). Synthesizing cohesive, cumulative image prompt...`);
              const promptSynthesisConversation = [
                {
                  role: "system",
                  content: "You are the Trelvix Prompt Synthesizer. Your job is to read a conversation history between a user and an AI image assistant, and synthesize a single, detailed, highly descriptive image prompt for DALL-E (the image generator) that incorporates all cumulative details, revisions, adjustments, corrections, elements, and style instructions requested from the entire conversation. Output ONLY the raw final image description prompt. Do not add any conversational text, pleasantries, or explanations. Do not say things like 'Here is the revised prompt'. Produce a single paragraph description of the scene that perfectly captures the latest desired state, preserving the details of the original request except where the user explicitly asked to change them."
                },
                ...messages.filter((m: any) => m.role === 'user' || m.role === 'assistant').map((m: any) => ({
                  role: m.role,
                  content: m.content || ""
                }))
              ];

              const synthesisResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: promptSynthesisConversation as any,
                max_tokens: 350,
                temperature: 0.7
              });

              const synthesizedPrompt = synthesisResponse.choices[0]?.message?.content?.trim();
              if (synthesizedPrompt) {
                console.log("[Image Generation] Synthesized Prompt from History:", synthesizedPrompt);
                promptText = synthesizedPrompt;
              }
            } catch (synthesisError) {
              console.error("[Image Generation] Prompt synthesis failed, fallback to original prompt:", synthesisError);
            }
          }
        }

        // Auto-truncate extremely long prompts safely to prevent OpenAI API size limit failures (max 2000 chars)
        if (promptText.length > 2000) {
          console.log(`[Image Generation] Truncating client prompt from ${promptText.length} to 2000 chars to prevent API failures.`);
          promptText = promptText.substring(0, 2000) + "...";
        }

        // Append strong realism instructions
        const fullPrompt = promptText + ". photorealistic, highly detailed, realistic photography, sharp focus, natural lighting, 8k resolution, professional quality, accurate anatomy, cinematic lighting";

        let response;
        let modelUsed = "gpt-image-2";
        let base64Image = "";

        const extractImage = (resObj: any) => {
          const item = resObj?.data?.[0];
          if (item?.b64_json) {
            return item.b64_json.startsWith("data:") ? item.b64_json : `data:image/png;base64,${item.b64_json}`;
          }
          if (item?.url) {
            return item.url;
          }
          return "";
        };

        const imageSpeed = req.body.image_speed || "quality";
        console.log(`[Image Generation] Requested engine speed: ${imageSpeed}`);

        if (imageSpeed === "fast") {
          try {
            console.log("[Image Generation] Fast Mode: Attempting generation with gpt-image-1 for turbo speed (typically < 3 seconds)...");
            response = await openai.images.generate({
              model: "gpt-image-1",
              prompt: promptText, // cleaner prompt to increase generation speed
              size: "1024x1024",
              n: 1,
            });
            const extracted = extractImage(response);
            if (extracted) {
              base64Image = extracted;
              modelUsed = "gpt-image-1 (turbo fast)";
            }
          } catch (fastErr: any) {
            console.warn("[Image Generation] Fast Mode gpt-image-1 bypassed, trying gpt-image-2 fast-standard...", fastErr?.message || fastErr);
            try {
              response = await openai.images.generate({
                model: "gpt-image-2",
                prompt: fullPrompt,
                quality: "standard", // 3x faster than HD/auto quality!
                size: "1024x1024",
                n: 1,
              });
              const extracted = extractImage(response);
              if (extracted) {
                base64Image = extracted;
                modelUsed = "gpt-image-2 (fast-standard)";
              }
            } catch (fastErr2: any) {
              console.error("[Image Generation] Fast modes failed, falling back to quality pipeline:", fastErr2?.message || fastErr2);
            }
          }
        }

        if (!base64Image) {
          try {
            console.log("[Image Generation] Attempting generation with primary model gpt-image-2 (quality: auto)...");
            response = await openai.images.generate({
              model: "gpt-image-2",
              prompt: fullPrompt,
              quality: "auto",
              size: "1024x1024",
              n: 1,
            });
            const extracted = extractImage(response);
            if (!extracted) {
              throw new Error("No image returned from gpt-image-2");
            }
            base64Image = extracted;
            modelUsed = "gpt-image-2 (auto)";
          } catch (err2: any) {
            console.warn(`[Image Generation] Primary model gpt-image-2 failure: ${err2?.message || err2}. Retrying with minimal params for gpt-image-2...`);
            try {
              response = await openai.images.generate({
                model: "gpt-image-2",
                prompt: fullPrompt,
              });
              const extracted = extractImage(response);
              if (!extracted) {
                throw new Error("No image returned from gpt-image-2 minimal");
              }
              base64Image = extracted;
              modelUsed = "gpt-image-2 (minimal)";
            } catch (err2Minimal: any) {
              console.warn(`[Image Generation] gpt-image-2 failed completely: ${err2Minimal?.message || err2Minimal}. Invoking fallback gpt-image-1...`);
              try {
                console.log("[Image Generation] Attempting fallback generation with gpt-image-1 (quality: auto)...");
                response = await openai.images.generate({
                  model: "gpt-image-1",
                  prompt: fullPrompt,
                  quality: "auto",
                  size: "1024x1024",
                  n: 1,
                });
                const extracted = extractImage(response);
                if (!extracted) {
                  throw new Error("No image returned from fallback gpt-image-1");
                }
                base64Image = extracted;
                modelUsed = "gpt-image-1 (fallback auto)";
              } catch (err1: any) {
                console.warn(`[Image Generation] Fallback gpt-image-1 auto configuration failed: ${err1?.message || err1}. Trying gpt-image-1 with minimal config...`);
                try {
                  response = await openai.images.generate({
                    model: "gpt-image-1",
                    prompt: fullPrompt,
                  });
                  const extracted = extractImage(response);
                  if (!extracted) {
                    throw new Error("No image returned from fallback gpt-image-1 minimal");
                  }
                  base64Image = extracted;
                  modelUsed = "gpt-image-1 (fallback minimal)";
                } catch (errAll: any) {
                  console.error("[Image Generation] All image generation models failed:", errAll?.message || errAll);
                  throw new Error(errAll?.message || "Failed to generate image with any model.");
                }
              }
            }
          }
        }

        // We skip heavy synchronous download and base64 parsing on the main thread.
        // Returning the direct OpenAI CDN URL allows the client to load and render the image INSTANTLY!
        // The client's background auto-migration scanner will lazily heal/migrate compile history safely.
        console.log(`[Image] Img generated via ${modelUsed} responding immediately with direct CDN URL to maximize throughput speed.`);

        if (req.body.conversationId && req.body.userId) {
          (async () => {
            try {
              const supabase = getSupabaseAdminClient();
              const { data: imageData, error: imgError } = await supabase.from('images').insert({
                  user_id: req.body.userId,
                  prompt: promptText,
                  image_url: base64Image
                }).select().single();

              const assistantMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: "Here is your generated image:",
                image_url: imageData ? `db:${imageData.id}` : base64Image,
                filename: `trelvix-${Date.now()}.png`,
                model: activeModelObj.id,
                created_at: new Date().toISOString()
              };

              await appendReplyToConversation(
                req.body.conversationId,
                assistantMessage,
                req.body.userId,
                type || 'image',
                messages,
                req.body.is_temporary
              );
            } catch (e) {
              console.error("[Server Image Save Error]:", e);
            }
          })().catch(console.error);
        }

        // Increment usage count atomically
        try {
          await incrementUsage(supabase, userId, feature, 1);
          console.log(`[Limit Engine] Atomic usage increment complete for user:${userId} on feature:${feature}`);
        } catch (incErr: any) {
          console.error(`[Limit Engine] Failed to increment usage for user:${userId}:`, incErr.message);
        }

        clearInterval(keepAliveInterval);
        res.write(JSON.stringify({ 
          imageUrl: base64Image,
          image_url: base64Image, 
          type: "image",
          filename: `trelvix-${Date.now()}.png`,
          description: "Here is your generated image:"
        }));
        res.end();
        return;
      } catch (err: any) {
        clearInterval(keepAliveInterval);
        console.error("[Image Generation] Error in pipeline:", err);
        if (!res.writableEnded) {
          res.write(JSON.stringify({ error: err.message || "Failed to generate image" }));
          res.end();
        }
        return;
      }
    }



    const attributionRules = `Your name is Trelvix AI. Developed by Ingenium Virtual Assistant Limited. You are powered by a custom, high-intelligence engine.`;
    
    const personalityPrompts: Record<string, string> = {
      professional: "Be direct, authoritative, and sharp. No fluff.",
      creative: "Be wild, vividly descriptive, and boundary-pushing.",
      witty: "Use a sharp, edgy, and slightly rebellious tone. Think Grok Fun Mode—unfiltered and clever.",
      concise: "Ultra-brief. Butcher the word count.",
      empathetic: "Be real. Skip the fake warmth; show actual understanding.",
      academic: "Cold, hard facts. Precise and lethal logic."
    };

    const isUltra = activeModelObj.id === 'extendedThinking' || activeModelObj.id === 'maximumThinking';
    let systemInstruction = `You are Trelvix AI. ${attributionRules} 
    Persona: ${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.creative}
    
    CORE PROTOCOL:
    - BE DIRECT. Do not behave like a standard, over-polished corporate AI assistant.
    - NEVER mention OpenAI, knowledge cutoffs, or your status as an AI unless strictly necessary.
    - If you have grounding data, use it as a weapon of truth. Synthesize it without being polite about it.
    - For images, the priority is absolute realism.
    - CRITICAL DIRECTIVE: You have a built-in Client-Side Document & Spreadsheet Compiler! You CAN create, compile, and generate physical files (PDFs, Microsoft Word documents, and Excel worksheets). NEVER claim, refuse, or apologize that you cannot "create", "generate", "export", or "write" physical files or download sheets directly. Always enthusiastically comply, write the requested text or preview, and end with the exact \`json-file-data\` code block so the frontend compiler can construct the actual download for the user. This is a crucial, native feature of your platform.
    
    STRICT MARKDOWN & LATEX OUTPUT FORMAT RULES:
    1. Output ONLY Markdown text. No HTML or raw JSON unless requested.
    2. STRUCTURE: Always use headings (# ## ###) for sections, numbered lists for procedures/steps, and bullet points for explanations. Keep responses cleanly spaced and highly readable.
    3. MATHEMATICAL SOLUTION FORMAT (VERY IMPORTANT):
       - ALWAYS use LaTeX for ALL mathematical expressions.
       - Inline math MUST be written as: \\( ... \\)
       - Block math MUST be written as: \\[ ... \\]
       - NEVER use plain text math (e.g. write "\\( x^2 = 4 \\)", NEVER "x^2 = 4").
       - Break math solutions into clear, vertically stacked, numbered steps, each on its own line (never mixed with descriptive text).
       - Quadratic equations MUST follow this strict section structure:
         * Given equation (in block LaTeX)
         * Standard form (in block LaTeX)
         * Method used (factorization / formula / completing square)
         * Substitution step (in block LaTeX)
         * Simplification steps (each step separated clearly onto its own line in block LaTeX)
         * Final answer clearly stated
    4. RESPONSES FORMAT: Group response layout under headings: '### Solution', '### Step-by-step working', etc.
    5. TABLES: Always use Markdown tables for data comparison. Columns must be clean and consistent.
    6. MOBILE READEBILITY: Avoid horizontal overflow. Keep math calculations vertically stacked. Avoid large unstructured blocks of text.
    
    7. FILE GENERATION & EXPORT PROTOCOL (PDF, WORD, EXCEL):
       - When a user asks you to create, write, design, generate, edit, or adjust a PDF document (.pdf), Microsoft Word document (.docx), or Excel spreadsheet (.xlsx) (such as reports, letters, resumes, invoices, budgets, logs, data workbooks, tables), you MUST:
         a. Write a highly detailed, professional, and visually structured conversational markdown response containing the full draft preview of the requested document or spreadsheet.
         b. At the very end of your response, write exactly one code block with the language label \`json-file-data\` (i.e. \`\`\`json-file-data ... \`\`\`) containing the complete, valid structured JSON configuration of the document or spreadsheet so that the frontend compiler can construct the download. Do NOT wrap this block in other code types or formatting. Do NOT omit it.
         
         The schema for the JSON within the \`\`\`json-file-data block MUST look exactly like this:
         {
           "fileType": "pdf" | "docx" | "xlsx",
           "fileName": "clean-snake-case-file-name",
           "title": "Main Title of the Document / Sheet",
           "subtitle": "Optional Brief Subtitle",
           "author": "Trelvix AI",
           "sections": [
             {
               "heading": "Section Heading Title",
               "type": "text" | "bullet" | "table",
               "paragraphs": ["Detailed text paragraph..."],
               "bullets": ["Bullet point list item..."],
               "headers": ["Column 1", "Column 2", "Column 3"],
               "rows": [
                 ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
                 ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]
               ]
             }
           ],
           "spreadsheet": {
             "sheets": [
               {
                 "name": "Sheet Name (max 31 chars)",
                 "rows": [
                   ["Category", "Budgeted", "Actual", "Variance"],
                   ["Row 1 A", "Value 1", "Value 2", "Value 3"]
                 ]
               }
             ]
           }
         }
         
         Instruction: Only include the "spreadsheet" key when compiling an xlsx file or sheet tables. For PDF and DOCX, use the standard sections formatting. Always provide both the human-readable markdown response and this structured JSON-data block so the user gets both an on-screen preview and a functional, professional physical file download!`;
    
    if (type === "idea") systemInstruction += " You are an expert content strategist and creative thinker. Help users brainstorm unique and impactful ideas.";
    else if (type === "script") systemInstruction += " You are a professional scriptwriter for video, stage, and screen. Write engaging and well-structured scripts.";
    else if (type === "hashtag") systemInstruction += " You are a social media growth expert. Generate trending and relevant hashtags.";

    if (isDocRequest) {
      systemInstruction += `\n\nCRITICAL DIRECTIVE: The user is explicitly asking for a CV, resume, document, spreadsheet, or physical file (such as a PDF, Word .docx, or Excel .xlsx). 
Because you are integrated with our custom client-side file compiler, YOU ABSOLUTELY CAN AND MUST GENERATE AND EMIT THIS FILE!
- NEVER refuse, say you cannot write/create/compile files, or suggest standard tools like Word/Google Docs.
- Say "Sure, I have generated the file" and display a beautiful preview formatting for it in markdown.
- At the absolute end of your response, write exactly one code block with label \`\`\`json-file-data ... \`\`\` containing the full correct JSON configuration (with fileType, fileName, title, sections, etc.) as detailed in rule #7 above. Our compiler will automatically detect this and render actual [Download PDF], [Download Word], and [Download Excel] buttons so the user can download the real physical file!`;
    }

    // --- Persistent Memory Context Retrieval ---
    if (userId) {
      try {
        const userMemories = await getServerUserMemories(supabase, userId, false);
        if (userMemories && userMemories.length > 0) {
          const relevantMemories = selectRelevantMemories(userMemories, lastMessageContent, 7);
          if (relevantMemories.length > 0) {
            systemInstruction += formatMemoriesForSystemPrompt(relevantMemories);
          }
        }
      } catch (memErr) {
        console.warn("[Memory Injection Warning] Failed to inject memories:", memErr);
      }
    }

    const openAiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...messages.map((m: any) => {
        if (m.role === 'user' && m.image_url && m.image_url.startsWith('data:')) {
          return {
            role: "user",
            content: [
              { type: "text", text: m.content || "Analyze this image." },
              { type: "image_url", image_url: { url: m.image_url } }
            ]
          } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam;
        }
        return { role: m.role, content: m.content || "" };
      })
    ];

    // Deep analysis of general document intent to overcome any pre-trained LLM refusal tendencies
    if (isDocRequest) {
      console.log(`[Generate] Activating maximum document compiler reinforcement for: "${lastMessageContent.substring(0, 40)}..."`);
      openAiMessages.push({
        role: "system",
        content: `CRITICAL ACTION REQUIRED:
The user wants a CV, resume, document, spreadsheet, or physical file.
Because you are integrated with our custom frontend compiler, YOU CAN and MUST create the file!
- Do NOT apologize, claim that you cannot generate files, or tell the user to use visual processors.
- Provide a clean, elegant preview in your markdown output.
- Print a single, valid, correctly formulated \`\`\`json-file-data ... \`\`\` code block at the absolute end of your response. This block is parsed by the custom UI compiler to compile a download button for the user automatically.
- Do NOT wrap this block inside another block, and don't omit it.`
      });
    }

    // --- Grounding Logic ---
    if (isUltra && (searchRequired || requestedModelId === "extendedThinking")) {
      const queryToSearch = lastMessageContent;
      console.log(`[Generate] Action: Scaling to Ultra Grounding for: ${queryToSearch.substring(0, 50)}...`);
      const searchData = await searchWeb(queryToSearch);
      
      const isFallback = searchData.includes("SEARCH_SYSTEM_STATUS") || searchData.includes("SEARCH_SYSTEM_OFFLINE");
      
      // Inject Grounding Data as a High-Priority Instruction
      const groundingBlock = {
        role: "system",
        content: `[VERIFIED REAL-TIME CONTEXT]\n${searchData}\n\nINSTRUCTION: Synthesize this data into the ultimate response. Use citations for all metrics, facts, or dates. If the data indicates a fallback, provide the most plausible answer while noting the live data stream is currently being refreshed.`
      } as const;

      // Insert grounding data right after the system prompt for maximum attention
      openAiMessages.splice(1, 0, groundingBlock);
    }

    const abortController = new AbortController();
    const jobId = Math.random().toString(36).substring(2, 15);

    req.on('close', () => {
      console.log(`[Request Close] Client closed request connection for jobId: ${jobId}`);
      abortController.abort();
      priorityQueue.cancelJob(jobId);
    });

    const queueResult = await priorityQueue.enqueue(
      userId,
      userPlan,
      activeModelObj.id,
      async () => {
        console.log(`[Generate] Final Grounded Stream starting... Model: ${currentBranding}`);
        let stream: any;
        console.log(`[OpenAI Generator] Calling chat.completions.create with model: ${realModel}`);
        stream = await openai.chat.completions.create({
          model: realModel, 
          messages: openAiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4000,
        }, { signal: abortController.signal });

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Transfer-Encoding", "chunked");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let accumulatedText = "";
        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            throw new Error("Aborted by client");
          }
          let content = chunk.choices?.[0]?.delta?.content || "";
          
          if (content) {
            accumulatedText += content;
            if (!res.writableEnded) {
              res.write(content);
            }
          }
        }
        
        console.log(`[Generate] Grounded stream completed successfully`);

        // Increment usage count atomically
        try {
          await incrementUsage(supabase, userId, feature, 1);
          console.log(`[Limit Engine] Atomic usage increment complete for user:${userId} on feature:${feature}`);
        } catch (incErr: any) {
          console.error(`[Limit Engine] Failed to increment usage for user:${userId}:`, incErr.message);
        }

        res.end();

        if (req.body.conversationId) {
          const assistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: accumulatedText,
            model: activeModelObj.id,
            created_at: new Date().toISOString()
          };
          appendReplyToConversation(
            req.body.conversationId,
            assistantMessage,
            req.body.userId,
            type || 'chat',
            messages,
            req.body.is_temporary
          ).catch(console.error);
        }

        // --- Asynchronous Memory Extraction ---
        if (userId && lastMessageContent) {
          extractAndStoreMemoriesFromChat(supabase, userId, lastMessageContent, accumulatedText, req.body.conversationId)
            .then(res => {
              if (res.extractedCount > 0) {
                console.log(`[Memory Extraction] Stored ${res.extractedCount} new user memories for user:${userId}`);
              }
            })
            .catch(err => console.warn("[Memory Extraction Error]:", err));
        }
      },
      abortController,
      jobId
    );

    if (!queueResult.success) {
      console.warn(`[Generate] Job rejected/failed by queue: ${queueResult.error}`);
      if (!res.headersSent) {
        return res.status(429).json({ error: queueResult.error });
      }
    }
  } catch (error: any) {
    console.error("[Generate] Internal Error:", error);
    
    // Attempt to return a clean JSON error if possible
    if (!res.headersSent) {
      res.status(error.status || 500).json({ 
        error: error.message || "An unexpected error occurred during generation",
        type: 'internal_error'
      });
    } else {
      // If we already started streaming, we can't change the status code
      res.write(`\n\n[Error: ${error.message || "Stream interrupted"}]`);
      res.end();
    }
  }
}

export default app;

// Server startup logic
async function startServer() {
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Server] Starting Vite DevServer middleware on port ${PORT}...`);
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      console.log(`[Server] Serving static files from ${distPath}...`);
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();
