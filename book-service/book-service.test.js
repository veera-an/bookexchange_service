// book-service.test.js
// Jest + Supertest tests for book-service

const request = require('supertest');
const express = require('express');
const app = require('./index'); // Assuming index.js exports the app for testing
const pool = require('./db');
const { createClient } = require('redis');

jest.mock('./db');
jest.mock('redis', () => {
  const mClient = {
    connect: jest.fn(),
    publish: jest.fn(),
    on: jest.fn(),
    quit: jest.fn()
  };
  return { createClient: jest.fn(() => mClient) };
});

const redis = require('redis').createClient();

// --- Unit Tests ---
describe('POST /books', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a book, store events, and publish to Redis', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ book_id: 1, name: 'Test Book', author: 'Author', isbn: '123', publication_date: '2024-01-01', genre: 'Fiction' }] }) // books insert
      .mockResolvedValueOnce({}); // events insert
    redis.publish.mockResolvedValueOnce(1);

    const book = {
      name: 'Test Book',
      author: 'Author',
      isbn: '123',
      publicationDate: '2024-01-01',
      genre: 'Fiction'
    };
    const res = await request(app).post('/books').send(book);
    expect(res.statusCode).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(redis.publish).toHaveBeenCalledWith(
      'book-events',
      expect.stringContaining('BookAdded')
    );
    expect(res.body.message).toMatch(/created/);
    expect(res.body.book.bookId).toBe(1);
  });

  it('should handle database error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/books').send({ name: 'Error Book', author: 'A', isbn: '', publicationDate: '', genre: '' });
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Failed to create book/);
  });
});

describe('GET /books', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reconstruct state from events', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { event_type: 'BookAdded', data: { bookId: 1, name: 'A', author: 'X', isbn: '', publicationDate: '', genre: '' } },
        { event_type: 'BookUpdated', data: { bookId: 1, name: 'A2', status: 'AVAILABLE' } },
        { event_type: 'BookReserved', data: { bookId: 1, userId: 'u1' } },
        { event_type: 'BookReturned', data: { bookId: 1, userId: 'u1' } }
      ]
    });
    const res = await request(app).get('/books');
    expect(res.statusCode).toBe(200);
    expect(res.body[0].name).toBe('A2');
    expect(res.body[0].status).toBe('AVAILABLE');
  });

  it('should return empty array if no events', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/books');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// --- Integration Tests (example, assumes test DB/Redis running) ---
// You must set up a test database and Redis instance for these to work.
// See README for docker-compose.test.yml example.

describe('Integration: book-service', () => {
  let server;
  beforeAll(async () => {
    // Optionally: set up test DB, run migrations, flush Redis, etc.
    server = app.listen(6002); // Use a different port for tests
  });
  afterAll(async () => {
    await server.close();
    // Optionally: clean up test DB, Redis, etc.
  });

  it('POST /books should create a book and store in DB', async () => {
    const book = {
      name: 'Integration Book',
      author: 'Int Author',
      isbn: '999',
      publicationDate: '2024-01-01',
      genre: 'Test'
    };
    const res = await request(server).post('/books').send(book);
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/created/);
    expect(res.body.book.bookId).toBeDefined();
    // Save book_id for later tests if needed
  });

  it('GET /books/:bookId should return the book', async () => {
    const book = {
      name: 'Get Book',
      author: 'Get Author',
      isbn: '111',
      publicationDate: '2024-01-01',
      genre: 'Test'
    };
    const createRes = await request(server).post('/books').send(book);
    const bookId = createRes.body.book.bookId;
    const res = await request(server).get(`/books/${bookId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.bookId).toBe(bookId);
  });

  it('PUT /books/:bookId should update the book', async () => {
    const book = {
      name: 'Put Book',
      author: 'Put Author',
      isbn: '222',
      publicationDate: '2024-01-01',
      genre: 'Test'
    };
    const createRes = await request(server).post('/books').send(book);
    const bookId = createRes.body.book.bookId;
    const res = await request(server).put(`/books/${bookId}`).send({ name: 'Put Book Updated', status: 'RESERVED' });
    expect(res.statusCode).toBe(201);
  });

  it('POST /books/:bookId/reserve and /return should store events', async () => {
    const book = {
      name: 'Reserve Book',
      author: 'Res Author',
      isbn: '333',
      publicationDate: '2024-01-01',
      genre: 'Test'
    };
    const createRes = await request(server).post('/books').send(book);
    const bookId = createRes.body.book.bookId;
    const res1 = await request(server).post(`/books/${bookId}/reserve`).send({ userId: 'user1' });
    expect(res1.statusCode).toBe(201);
    const res2 = await request(server).post(`/books/${bookId}/return`).send({ userId: 'user1' });
    expect(res2.statusCode).toBe(201);
  });

  it('GET /books should reconstruct state from events', async () => {
    const book = {
      name: 'Recon Book',
      author: 'Recon Author',
      isbn: '444',
      publicationDate: '2024-01-01',
      genre: 'Test'
    };
    const createRes = await request(server).post('/books').send(book);
    const bookId = createRes.body.book.bookId;
    await request(server).post(`/books/${bookId}/reserve`).send({ userId: 'user2' });
    await request(server).post(`/books/${bookId}/return`).send({ userId: 'user2' });
    await request(server).put(`/books/${bookId}`).send({ name: 'Recon Book Updated', status: 'AVAILABLE' });
    const res = await request(server).get('/books');
    expect(res.statusCode).toBe(200);
    expect(res.body.some(b => b.bookId === bookId && b.name === 'Recon Book Updated')).toBe(true);
  });
});

// --- Test Environment Setup Instructions ---
// 1. Create a docker-compose.test.yml with a test Postgres and Redis.
// 2. Run migrations for test DB before tests.
// 3. Set environment variables in test runner to point to test DB/Redis.
// 4. Use Jest's --runInBand for integration tests to avoid race conditions.
// 5. See README for more details.
