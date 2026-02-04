-- Add notes column to operational_requests for status annotations and progress tracking
ALTER TABLE public.operational_requests 
ADD COLUMN IF NOT EXISTS notes text;