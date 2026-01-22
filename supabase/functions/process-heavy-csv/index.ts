import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, Authorization, x-client-info, apikey, content-type, x-office-id, x-user-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const officeId = req.headers.get("x-office-id");
    const userId = req.headers.get("x-user-id");

    if (!officeId) throw new Error("Missing x-office-id");

    /** 1️⃣ Create Job */
    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .insert({
        office_id: Number(officeId),
        created_by: userId,
        status: "PROCESSING",
        processed_rows: 0,
        total_rows: 0,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    /** 2️⃣ Stream CSV */
    const reader = req.body?.getReader();
    if (!reader) throw new Error("No request body");

    const decoder = new TextDecoder();
    let leftover = "";
    let rowCount = 0;
    let batch: any[] = [];

    const BATCH_SIZE = 500;

    while (true) {
      const { done, value } = await reader.read();
      if (done && !leftover) break;

      const chunk = decoder.decode(value || new Uint8Array(), {
        stream: !done,
      });

      const lines = (leftover + chunk).split(/\r?\n/);
      leftover = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        rowCount++;
        if (rowCount === 1) continue; // skip header

        // SAFE CSV parsing
        const cols =
          line
            .match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
            ?.map((c) => c.replace(/^"|"$/g, "").trim()) || [];

        if (cols.length < 2) continue;

        batch.push({
          plate_number: cols[0].toUpperCase(),
          mv_file: cols[1].toUpperCase(),
          dealer: cols[2] || "N/A",
          office_id: Number(officeId),
        });

        if (batch.length >= BATCH_SIZE) {
          const { error } = await supabase.rpc(
            "sync_plates_enterprise",
            { items: batch, p_job_id: job.id }
          );
          if (error) throw error;
          batch = [];
        }
      }

      if (done) break;
    }

    /** 3️⃣ Final batch */
    if (batch.length) {
      const { error } = await supabase.rpc(
        "sync_plates_enterprise",
        { items: batch, p_job_id: job.id }
      );
      if (error) throw error;
    }

    /** 4️⃣ Finalize job */
    await supabase
      .from("import_jobs")
      .update({
        total_rows: rowCount - 1,
        status: "COMPLETED",
      })
      .eq("id", job.id);

    return new Response(
      JSON.stringify({ success: true, jobId: job.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
