-- Description: PostgreSQL-specific schema adjustments
-- This migration handles PostgreSQL-specific changes like sequence creation and column type adjustments

-- Create sequences for auto-incrementing IDs
CREATE SEQUENCE IF NOT EXISTS create_order_webhook_events_id_seq;
CREATE SEQUENCE IF NOT EXISTS orders_id_seq;
CREATE SEQUENCE IF NOT EXISTS order_lines_id_seq;
CREATE SEQUENCE IF NOT EXISTS analytics_results_id_seq;

-- Adjust column types and constraints for PostgreSQL
ALTER TABLE create_order_webhook_events ALTER COLUMN id SET DEFAULT nextval('create_order_webhook_events_id_seq');
ALTER TABLE orders ALTER COLUMN id SET DEFAULT nextval('orders_id_seq');
ALTER TABLE order_lines ALTER COLUMN id SET DEFAULT nextval('order_lines_id_seq');
ALTER TABLE analytics_results ALTER COLUMN id SET DEFAULT nextval('analytics_results_id_seq');

-- Set sequence ownership
ALTER SEQUENCE create_order_webhook_events_id_seq OWNED BY create_order_webhook_events.id;
ALTER SEQUENCE orders_id_seq OWNED BY orders.id;
ALTER SEQUENCE order_lines_id_seq OWNED BY order_lines.id;
ALTER SEQUENCE analytics_results_id_seq OWNED BY analytics_results.id;

-- Update timestamp columns to use TIMESTAMP WITH TIME ZONE
ALTER TABLE create_order_webhook_events 
    ALTER COLUMN received_at TYPE TIMESTAMP WITH TIME ZONE,
    ALTER COLUMN processed_at TYPE TIMESTAMP WITH TIME ZONE;

ALTER TABLE orders 
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

ALTER TABLE order_lines 
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

ALTER TABLE analytics_results 
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE; 