import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://web-swart-xi-99.vercel.app",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith("chrome-extension://");
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Verify JWT and extract user ID, with fallback for single-user mode
async function verifyAuth(req: Request, bodyUserId?: string): Promise<{ user_id: string } | { error: string }> {
  const authHeader = req.headers.get("Authorization");

  // If JWT provided, verify it
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      return { error: "Invalid or expired token" };
    }

    return { user_id: user.id };
  }

  // Fallback: Single-user mode - allow if user_id matches the configured single user
  // Set SINGLE_USER_ID env var in Supabase Edge Function settings for this to work
  const singleUserId = Deno.env.get("SINGLE_USER_ID");
  if (singleUserId && bodyUserId === singleUserId) {
    return { user_id: singleUserId };
  }

  // No valid auth method
  return { error: "Missing or invalid authorization" };
}

interface KindleHighlight {
  title: string;
  author?: string | null;
  highlight: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body first to get user_id for single-user mode fallback
    const body = await req.json();
    const { user_id: bodyUserId, highlights } = body;

    if (!highlights || !Array.isArray(highlights)) {
      return new Response(
        JSON.stringify({ error: "highlights array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify authentication (JWT or single-user mode)
    const authResult = await verifyAuth(req, bodyUserId);
    if ("error" in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user_id = authResult.user_id;

    if (highlights.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No highlights to import", imported: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get existing Kindle highlights to check for duplicates
    const { data: existingSaves, error: fetchError } = await supabase
      .from("saves")
      .select("highlight, title")
      .eq("user_id", user_id)
      .not("highlight", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    // Create set of existing highlights for O(1) lookup
    const existingSet = new Set(
      (existingSaves || []).map((s: { highlight: string; title: string }) =>
        `${s.highlight}|||${s.title}`
      )
    );

    // Filter out duplicates
    const newHighlights = (highlights as KindleHighlight[]).filter((h) => {
      const key = `${h.highlight}|||${h.title}`;
      return !existingSet.has(key);
    });

    if (newHighlights.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `All ${highlights.length} highlights already synced`,
          imported: 0,
          duplicates: highlights.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare saves for batch insert
    const savesToInsert = newHighlights.map((h) => ({
      user_id,
      title: h.title,
      author: h.author || null,
      highlight: h.highlight,
      site_name: "Kindle",
      source: "kindle",
    }));

    // Insert in batches of 50
    const batchSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < savesToInsert.length; i += batchSize) {
      const batch = savesToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("saves")
        .insert(batch);

      if (insertError) {
        throw insertError;
      }
      insertedCount += batch.length;
    }

    const skipped = highlights.length - newHighlights.length;
    const message = skipped > 0
      ? `Synced ${insertedCount} new highlights (${skipped} duplicates skipped)`
      : `Synced ${insertedCount} new highlights`;

    return new Response(
      JSON.stringify({
        success: true,
        message,
        imported: insertedCount,
        duplicates: skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Save Kindle error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
