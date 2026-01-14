-- Create table for request action tokens (for email-based actions)
CREATE TABLE public.request_action_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.financial_requests(id) ON DELETE CASCADE,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  action_type TEXT NOT NULL, -- 'specialist_response', 'work_completed', etc.
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
  expires_at TIMESTAMPTZ NOT NULL,
  acted_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS - access only via edge functions with service role
ALTER TABLE public.request_action_tokens ENABLE ROW LEVEL SECURITY;

-- No policies = access only with service role (edge functions)
-- This is intentional for security - tokens should only be validated/processed by edge functions

-- Create index for faster token lookups
CREATE INDEX idx_request_action_tokens_token ON public.request_action_tokens(token);
CREATE INDEX idx_request_action_tokens_request_id ON public.request_action_tokens(request_id);