import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface SlackNotificationRequest {
  email: string;
  message: string;
  blocks?: object[];
}

async function lookupUserByEmail(email: string, lovableKey: string, slackKey: string): Promise<string | null> {
  const response = await fetch(`${GATEWAY_URL}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": slackKey,
    },
  });

  const data = await response.json();
  if (!data.ok) {
    console.error("users.lookupByEmail failed:", data.error, "for email:", email);
    return null;
  }
  return data.user?.id ?? null;
}

async function openDM(userId: string, lovableKey: string, slackKey: string): Promise<string | null> {
  const response = await fetch(`${GATEWAY_URL}/conversations.open`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": slackKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ users: userId }),
  });

  const data = await response.json();
  if (!data.ok) {
    console.error("conversations.open failed:", data.error);
    return null;
  }
  return data.channel?.id ?? null;
}

async function postMessage(
  channelId: string,
  message: string,
  blocks: object[] | undefined,
  lovableKey: string,
  slackKey: string
): Promise<boolean> {
  const body: Record<string, unknown> = {
    channel: channelId,
    text: message,
  };
  if (blocks && blocks.length > 0) {
    body.blocks = blocks;
  }

  const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": slackKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) {
    console.error("chat.postMessage failed:", data.error);
    return false;
  }
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) {
      throw new Error("SLACK_API_KEY is not configured. Connect the Slack integration first.");
    }

    const { email, message, blocks }: SlackNotificationRequest = await req.json();

    if (!email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "email and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending Slack DM to: ${email}`);

    // 1. Lookup user by email
    const slackUserId = await lookupUserByEmail(email, LOVABLE_API_KEY, SLACK_API_KEY);
    if (!slackUserId) {
      console.warn(`No Slack user found for email: ${email}`);
      return new Response(
        JSON.stringify({ success: false, error: `No Slack user found for email: ${email}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 2. Open DM channel
    const channelId = await openDM(slackUserId, LOVABLE_API_KEY, SLACK_API_KEY);
    if (!channelId) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to open DM channel" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 3. Send message
    const sent = await postMessage(channelId, message, blocks, LOVABLE_API_KEY, SLACK_API_KEY);

    console.log(`Slack DM to ${email}: ${sent ? "sent" : "failed"}`);

    return new Response(
      JSON.stringify({ success: sent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-slack-notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
