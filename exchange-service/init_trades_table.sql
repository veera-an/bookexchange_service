-- Migration: Create trades table for Exchange Service
CREATE TABLE IF NOT EXISTS trades (
    trade_id UUID PRIMARY KEY,
    book_id INTEGER NOT NULL,
    requester_id UUID NOT NULL,
    owner_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    rejected_reason VARCHAR(255)
);

-- Events table for exchange event sourcing
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    version VARCHAR(8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL
);
