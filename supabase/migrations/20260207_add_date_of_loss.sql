-- Migration: Add date_of_loss column if it doesn't exist
-- This ensures the column exists for older database instances

DO $$
BEGIN
    -- Add date_of_loss column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'deals' AND column_name = 'date_of_loss'
    ) THEN
        ALTER TABLE deals ADD COLUMN date_of_loss DATE;
        RAISE NOTICE 'Added date_of_loss column to deals table';
    ELSE
        RAISE NOTICE 'date_of_loss column already exists';
    END IF;
END $$;

