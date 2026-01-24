-- Add appointment time range fields to rep_pins
ALTER TABLE public.rep_pins 
ADD COLUMN IF NOT EXISTS appointment_all_day BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS appointment_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_closer_id UUID REFERENCES public.reps(id);