-- Add columns for status validation requirements
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS permit_file_url TEXT,
ADD COLUMN IF NOT EXISTS install_images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS completion_images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS payment_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMP WITH TIME ZONE;

-- Create storage bucket for deal documents (permits, install photos, completion photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-documents', 'deal-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for deal-documents bucket
CREATE POLICY "Authenticated users can upload deal documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deal-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view deal documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'deal-documents');

CREATE POLICY "Users can delete their uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'deal-documents' AND auth.uid() IS NOT NULL);