-- Migration: Create books table for read model
CREATE TABLE IF NOT EXISTS books (
    book_id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    author VARCHAR(100) NOT NULL,
    isbn VARCHAR(20),
    publication_date DATE,
    genre VARCHAR(50),
    status VARCHAR(20) DEFAULT 'AVAILABLE'
);
