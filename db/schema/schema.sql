-- Owners table
CREATE TABLE IF NOT EXISTS owners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    require_sign_offs BOOLEAN DEFAULT 0,
    restrict_par_access BOOLEAN DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image TEXT,
    owner_id TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    contact_name TEXT,
    phone TEXT,
    min_order_value REAL,
    order_days TEXT,
    order_cutoff TEXT,
    delivery_arrangement TEXT,
    delivery_days TEXT,
    active BOOLEAN DEFAULT 1,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT,
    owner_id TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    postcode TEXT,
    phone TEXT,
    email TEXT,
    active BOOLEAN DEFAULT 1,
    notes TEXT,
    brand_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

-- SKUs table
CREATE TABLE IF NOT EXISTS skus (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    product_code TEXT,
    unit TEXT,
    cost REAL,
    notes TEXT,
    supplier_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

-- SKU Masks table
CREATE TABLE IF NOT EXISTS sku_masks (
    id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    par_level REAL,
    preset_order_qty REAL,
    pinned BOOLEAN DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (sku_id) REFERENCES skus(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT,
    active BOOLEAN DEFAULT 1,
    brand_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    user_pin TEXT CHECK(length(user_pin) <= 4),
    image TEXT,
    base_location_id TEXT,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (owner_id) REFERENCES owners(id),
    FOREIGN KEY (base_location_id) REFERENCES locations(id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_date DATE NOT NULL,
    status TEXT,
    created_at TEXT,
    updated_at TEXT,
    supplier_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Order Lines table
CREATE TABLE IF NOT EXISTS order_lines (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    sku_id TEXT NOT NULL,
    quantity REAL,
    cpu REAL,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (sku_id) REFERENCES skus(id)
);

-- Supplier Mask table
CREATE TABLE IF NOT EXISTS supplier_mask (
    id TEXT PRIMARY KEY, -- 🔒 Row ID
    loc_id TEXT,         -- LOC ID
    supplier_id TEXT,    -- SUPPLIER ID
    owner_id TEXT,       -- Owner ID
    supplier_name TEXT,  -- Supplier Name
    notes TEXT,          -- Notes
    account_id TEXT,     -- Account ID
    team TEXT,           -- Supplier Mask/Team
    active INTEGER,      -- Supplier Mask/Active (0/1)
    order_days TEXT,     -- Supplier Mask/Order Days WRITE
    created_at TEXT,
    updated_at TEXT
);

-- Staging table for order creation webhook events
CREATE TABLE IF NOT EXISTS create_order_webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed BOOLEAN DEFAULT 0,
    processed_at TEXT
); 