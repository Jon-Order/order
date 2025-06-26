-- Description: Add error tracking to create_order_webhook_events
-- This migration adds error tracking and retry count columns

-- Add new columns to create_order_webhook_events table
ALTER TABLE create_order_webhook_events 
ADD COLUMN IF NOT EXISTS error TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0; 