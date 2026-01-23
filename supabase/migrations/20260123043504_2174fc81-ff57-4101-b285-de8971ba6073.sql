-- Create storage bucket for pin documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('pin-documents', 'pin-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to pin-documents bucket
CREATE POLICY "Users can upload pin documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pin-documents');

-- Allow users to view pin documents
CREATE POLICY "Users can view pin documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pin-documents');

-- Allow users to delete their own pin documents
CREATE POLICY "Users can delete pin documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'pin-documents');

-- Create table to track pin documents
CREATE TABLE public.pin_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pin_id UUID NOT NULL REFERENCES public.rep_pins(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pin_documents ENABLE ROW LEVEL SECURITY;

-- Reps can view documents for their own pins
CREATE POLICY "Reps can view own pin documents"
ON public.pin_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rep_pins
    WHERE rep_pins.id = pin_documents.pin_id
    AND rep_pins.rep_id = get_rep_id()
  )
);

-- Reps can insert documents for their own pins
CREATE POLICY "Reps can insert own pin documents"
ON public.pin_documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rep_pins
    WHERE rep_pins.id = pin_documents.pin_id
    AND rep_pins.rep_id = get_rep_id()
  )
);

-- Reps can delete documents for their own pins
CREATE POLICY "Reps can delete own pin documents"
ON public.pin_documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rep_pins
    WHERE rep_pins.id = pin_documents.pin_id
    AND rep_pins.rep_id = get_rep_id()
  )
);

-- Admins can manage all pin documents
CREATE POLICY "Admins can manage all pin documents"
ON public.pin_documents
FOR ALL
USING (is_admin());