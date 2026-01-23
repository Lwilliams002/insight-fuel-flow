-- Add signature fields to deals table
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS signature_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT false;

-- Create storage bucket for signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-signatures', 'deal-signatures', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for signatures storage
CREATE POLICY "Authenticated users can upload signatures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deal-signatures');

CREATE POLICY "Users can view signatures"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'deal-signatures');