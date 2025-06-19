-- Migration: Create books table for read model
DROP TABLE IF EXISTS books CASCADE;
CREATE TABLE books (
    book_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    author VARCHAR(100) NOT NULL,
    isbn VARCHAR(20),
    publication_date DATE,
    genre VARCHAR(50),
    status VARCHAR(20) DEFAULT 'AVAILABLE'
);
