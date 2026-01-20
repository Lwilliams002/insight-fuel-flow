-- Create app_settings table for storing configuration like JotForm URL
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage all settings
CREATE POLICY "Admins can manage app_settings"
ON public.app_settings
FOR ALL
USING (is_admin());

-- Reps can only read settings
CREATE POLICY "Reps can read app_settings"
ON public.app_settings
FOR SELECT
USING (has_role(auth.uid(), 'rep'));

-- Insert default JotForm URL placeholder
INSERT INTO public.app_settings (key, value) VALUES ('jotform_url', '');

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();