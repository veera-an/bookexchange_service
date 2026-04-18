
const axios = require('axios');

const GATEWAY = 'http://localhost';
const api = axios.create({ baseURL: GATEWAY, timeout: 10000 });

// Generate unique IDs per test run to avoid conflicts
const uid = () => crypto.randomUUID();
const testUserId = uid();

describe('Health Checks', () => {
  test('User Service is UP with database connected', async () => {
    const res = await api.get('/health/user-service');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('UP');
    expect(res.data.service).toBe('user-service');
    expect(res.data.database).toBe('UP');
    expect(res.data.timestamp).toBeDefined();
  });

  test('Book Service is UP with database connected', async () => {
    const res = await api.get('/health/book-service');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('UP');
    expect(res.data.service).toBe('book-service');
    expect(res.data.database).toBe('UP');
  });

  test('Exchange Service is UP with database connected', async () => {
    const res = await api.get('/health/exchange-service');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('UP');
    expect(res.data.service).toBe('exchange-service');
    expect(res.data.database).toBe('UP');
  });
});

describe('User Service', () => {
  test('POST /users — creates a new user', async () => {
    const res = await api.post('/users', {
      userId: testUserId,
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      city: 'Helsinki',
      preferences: '{}'
    });
    expect(res.status).toBe(201);
    expect(res.data.message).toContain('User created');
    expect(res.data.event.eventType).toBe('UserRegistered');
  });

  test('GET /users/:userId — returns the created user', async () => {
    const res = await api.get(`/users/${testUserId}`);
    expect(res.status).toBe(200);
    expect(res.data.user_id).toBe(testUserId);
  });

  test('GET /users/:userId — returns 404 for non-existent user', async () => {
    try {
      await api.get(`/users/${uid()}`);
      fail('Expected 404');
    } catch (err) {
      expect(err.response.status).toBe(404);
      expect(err.response.data.error).toBe('User not found');
    }
  });
});

describe('Book Service', () => {
  let bookId;

  test('POST /books — creates a new book', async () => {
    const res = await api.post('/books', {
      name: 'Test Book',
      author: 'Test Author',
      isbn: '978-0000000001',
      genre: 'Testing'
    });
    expect(res.status).toBe(201);
    expect(res.data.book.status).toBe('AVAILABLE');
    bookId = res.data.book.bookId;
  });

  test('GET /books/:bookId — returns book details', async () => {
    const res = await api.get(`/books/${bookId}`);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Test Book');
    expect(res.data.status).toBe('AVAILABLE');
  });

  test('GET /books/:bookId — returns 404 for non-existent book', async () => {
    try {
      await api.get('/books/99999');
      fail('Expected 404');
    } catch (err) {
      expect(err.response.status).toBe(404);
    }
  });
});

describe('Exchange Service — Orchestration (Request-Reply)', () => {
  let bookId;
  let tradeId;

  beforeAll(async () => {
    // Create a book for trade tests
    const res = await api.post('/books', {
      name: 'Trade Test Book',
      author: 'Trade Author',
      isbn: '978-0000000002',
      genre: 'Trading'
    });
    bookId = res.data.book.bookId;
  });

  test('POST /trades — initiates a trade (orchestrator verifies book + user)', async () => {
    const res = await api.post('/trades', {
      bookId,
      requesterId: testUserId
    });
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('PENDING');
    expect(res.data.tradeId).toBeDefined();
    tradeId = res.data.tradeId;
  });

  test('GET /trades/:tradeId — returns trade details', async () => {
    const res = await api.get(`/trades/${tradeId}`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('PENDING');
    expect(res.data.book_id).toBe(bookId);
  });

  test('POST /trades — returns 404 for non-existent user', async () => {
    try {
      await api.post('/trades', {
        bookId,
        requesterId: uid()
      });
      fail('Expected 404');
    } catch (err) {
      expect(err.response.status).toBe(404);
      expect(err.response.data.error).toBe('Requester user not found');
    }
  });

  test('POST /trades — returns 404 for non-existent book', async () => {
    try {
      await api.post('/trades', {
        bookId: 99999,
        requesterId: testUserId
      });
      fail('Expected 404');
    } catch (err) {
      expect(err.response.status).toBe(404);
      expect(err.response.data.error).toBe('Book not found');
    }
  });

  test('POST /trades — returns 400 for missing fields', async () => {
    try {
      await api.post('/trades', {});
      fail('Expected 400');
    } catch (err) {
      expect(err.response.status).toBe(400);
    }
  });
});

describe('Full Trade Workflow — Choreography (RabbitMQ)', () => {
  let bookId;
  let tradeId;

  beforeAll(async () => {
    const res = await api.post('/books', {
      name: 'Choreography Test Book',
      author: 'Event Author',
      isbn: '978-0000000003',
      genre: 'Events'
    });
    bookId = res.data.book.bookId;
  });

  test('1. Book starts as AVAILABLE', async () => {
    const res = await api.get(`/books/${bookId}`);
    expect(res.data.status).toBe('AVAILABLE');
  });

  test('2. Initiate trade — status is PENDING', async () => {
    const res = await api.post('/trades', {
      bookId,
      requesterId: testUserId
    });
    expect(res.data.status).toBe('PENDING');
    tradeId = res.data.tradeId;
  });

  test('3. Accept trade — status becomes COMPLETED', async () => {
    const res = await api.post(`/trades/${tradeId}/accept`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('COMPLETED');
  });

  test('4. Book status updated to EXCHANGED via choreography', async () => {
    // Allow time for RabbitMQ event to propagate
    await new Promise(r => setTimeout(r, 2000));
    const res = await api.get(`/books/${bookId}`);
    expect(res.data.status).toBe('EXCHANGED');
  });

  test('5. Cannot accept an already completed trade', async () => {
    try {
      await api.post(`/trades/${tradeId}/accept`);
      fail('Expected 409');
    } catch (err) {
      expect(err.response.status).toBe(409);
    }
  });

  test('6. Cannot trade a book that is EXCHANGED', async () => {
    try {
      await api.post('/trades', {
        bookId,
        requesterId: testUserId
      });
      fail('Expected 409');
    } catch (err) {
      expect(err.response.status).toBe(409);
    }
  });
});

describe('Trade Rejection', () => {
  let tradeId;

  beforeAll(async () => {
    const bookRes = await api.post('/books', {
      name: 'Reject Test Book',
      author: 'Reject Author',
      isbn: '978-0000000004',
      genre: 'Rejection'
    });
    const tradeRes = await api.post('/trades', {
      bookId: bookRes.data.book.bookId,
      requesterId: testUserId
    });
    tradeId = tradeRes.data.tradeId;
  });

  test('POST /trades/:tradeId/reject — rejects a pending trade', async () => {
    const res = await api.post(`/trades/${tradeId}/reject`, {
      reason: 'Changed my mind'
    });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('REJECTED');
  });

  test('Cannot reject an already rejected trade', async () => {
    try {
      await api.post(`/trades/${tradeId}/reject`);
      fail('Expected 409');
    } catch (err) {
      expect(err.response.status).toBe(409);
    }
  });
});
