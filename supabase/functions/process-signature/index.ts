import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessSignatureRequest {
  token: string;
  action: 'accept' | 'dispute';
  comments?: string;
  disputeReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, action, comments, disputeReason }: ProcessSignatureRequest = await req.json();

    // Get client IP and User Agent for digital evidence
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("x-real-ip") 
      || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    console.log(`Processing signature for token: ${token}, action: ${action}`);

    // Find signature by token
    const { data: signature, error: findError } = await supabase
      .from('liquidation_signatures')
      .select('*, liquidation:liquidations(id, code, status)')
      .eq('token', token)
      .single();

    if (findError || !signature) {
      console.error("Signature not found:", findError);
      return new Response(
        JSON.stringify({ error: "Token de firma no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already processed
    if (signature.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          error: "Esta liquidación ya ha sido procesada",
          currentStatus: signature.status 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(signature.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "El enlace de firma ha expirado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const newStatus = action === 'accept' ? 'accepted' : 'disputed';
    const now = new Date().toISOString();

    // Update signature with digital evidence
    const { error: updateSignatureError } = await supabase
      .from('liquidation_signatures')
      .update({
        status: newStatus,
        signed_at: now,
        ip_address: ipAddress,
        user_agent: userAgent,
        specialist_comments: comments || null,
        dispute_reason: action === 'dispute' ? disputeReason : null,
      })
      .eq('id', signature.id);

    if (updateSignatureError) {
      console.error("Error updating signature:", updateSignatureError);
      throw new Error("Error al actualizar la firma");
    }

    // Update liquidation status based on action
    const liquidationStatus = action === 'accept' ? 'paid' : 'disputed';
    const updateData: any = { status: liquidationStatus };
    
    if (action === 'accept') {
      updateData.paid_at = now;
    }

    const { error: updateLiqError } = await supabase
      .from('liquidations')
      .update(updateData)
      .eq('id', signature.liquidation_id);

    if (updateLiqError) {
      console.error("Error updating liquidation:", updateLiqError);
      throw new Error("Error al actualizar la liquidación");
    }

    console.log(`Signature processed successfully: ${action}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: action === 'accept' 
          ? "Liquidación aceptada correctamente" 
          : "Disputa registrada correctamente",
        digitalEvidence: {
          signedAt: now,
          ipAddress: ipAddress,
          action: newStatus,
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error processing signature:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
