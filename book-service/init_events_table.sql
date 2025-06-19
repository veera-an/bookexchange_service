-- Migration: Create events table for event sourcing
DROP TABLE IF EXISTS events CASCADE;
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    version VARCHAR(8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL
);
