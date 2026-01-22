-- Add appointment status to pin_status enum
ALTER TYPE public.pin_status ADD VALUE IF NOT EXISTS 'appointment';

-- Add appointment_date column to rep_pins
ALTER TABLE public.rep_pins 
ADD COLUMN IF NOT EXISTS appointment_date timestamp with time zone;