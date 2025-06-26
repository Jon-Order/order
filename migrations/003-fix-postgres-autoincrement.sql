-- Drop the webhook events table if it exists
DROP TABLE IF EXISTS create_order_webhook_events;

-- Recreate it with PostgreSQL SERIAL
CREATE TABLE create_order_webhook_events (
    id SERIAL PRIMARY KEY,
    received_at TIMESTAMP NOT NULL,
    payload TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP
);

-- Update timestamp columns to use proper PostgreSQL types
ALTER TABLE owners ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE owners ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE brands ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE brands ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE suppliers ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE suppliers ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE locations ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE locations ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE skus ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE skus ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE sku_masks ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE sku_masks ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE orders ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE orders ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE order_lines ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE order_lines ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp;

ALTER TABLE supplier_mask ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp;
ALTER TABLE supplier_mask ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at::timestamp; 