-- Drop existing tables if they exist
DROP TABLE IF EXISTS webhook_events;
DROP TABLE IF EXISTS order_lines;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS analytics_results;

-- Create orders table
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    order_date TIMESTAMP NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_lines table
CREATE TABLE order_lines (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    sku_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cpu DECIMAL(10,2) NOT NULL,
    product_code TEXT,
    product_name TEXT,
    supplier_id TEXT,
    supplier_name TEXT,
    unit TEXT DEFAULT 'each',
    location_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Create webhook_events table
CREATE TABLE webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create analytics_results table
CREATE TABLE analytics_results (
    id SERIAL PRIMARY KEY,
    item_id TEXT NOT NULL,
    total_quantity INTEGER NOT NULL,
    average_quantity DECIMAL(10,2) NOT NULL,
    order_count INTEGER NOT NULL,
    first_order_date TIMESTAMP,
    last_order_date TIMESTAMP,
    min_quantity INTEGER,
    max_quantity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_orders_supplier_id ON orders(supplier_id);
CREATE INDEX idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX idx_order_lines_sku_id ON order_lines(sku_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_analytics_results_item_id ON analytics_results(item_id); 