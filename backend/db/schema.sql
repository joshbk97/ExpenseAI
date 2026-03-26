-- AI Expense Tracker - Database Schema
-- Compatible with Supabase PostgreSQL

-- Enable UUID extension (optional, using serial IDs for simplicity)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── Categories ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50) DEFAULT '📦',
    description TEXT DEFAULT ''
);

-- ── Receipts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant VARCHAR(255) DEFAULT 'Unknown',
    total FLOAT DEFAULT 0.0,
    currency VARCHAR(10) DEFAULT 'AUD',
    receipt_date TIMESTAMP,
    raw_text TEXT DEFAULT '',
    structured_json TEXT DEFAULT '{}',
    image_path VARCHAR(500) DEFAULT '',
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);

-- ── Receipt Items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_items (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    quantity FLOAT DEFAULT 1.0,
    unit_price FLOAT DEFAULT 0.0,
    total_price FLOAT DEFAULT 0.0,
    category_confidence FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_receipt ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON receipt_items(category_id);

-- ── Seed Categories ──────────────────────────────────
INSERT INTO categories (name, icon, description) VALUES
    ('Groceries',       '🛒', 'Food and grocery items'),
    ('Dining',          '🍽️', 'Restaurants, cafes, and takeaway'),
    ('Transport',       '🚗', 'Fuel, parking, public transport, rideshare'),
    ('Utilities',       '💡', 'Electricity, water, gas, internet'),
    ('Entertainment',   '🎬', 'Movies, games, streaming, events'),
    ('Shopping',        '🛍️', 'Clothing, electronics, general retail'),
    ('Health',          '💊', 'Pharmacy, medical, fitness'),
    ('Education',       '📚', 'Books, courses, training'),
    ('Travel',          '✈️', 'Hotels, flights, accommodation'),
    ('Subscriptions',   '🔄', 'Recurring monthly/yearly services'),
    ('Office',          '🏢', 'Office supplies, co-working'),
    ('Personal Care',   '💇', 'Haircuts, beauty, grooming'),
    ('Home',            '🏠', 'Furniture, maintenance, cleaning'),
    ('Other',           '📦', 'Uncategorised expenses')
ON CONFLICT (name) DO NOTHING;
