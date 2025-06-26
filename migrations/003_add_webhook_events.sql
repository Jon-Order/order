-- Description: Add webhook events table
-- This migration adds a table to store incoming webhook events before processing

-- Drop existing table if it exists
DROP TABLE IF EXISTS create_order_webhook_events;

-- Create webhook events table with database-agnostic auto-incrementing ID
CREATE TABLE webhook_events (
    id SERIAL PRIMARY KEY,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error TEXT,
    retry_count INTEGER DEFAULT 0
); 