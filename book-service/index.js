const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const createLogger = require('./shared/logger');
const healthCheck = require('./shared/healthCheck');
const { connect: connectMQ, publish, subscribe } = require('./shared/messaging');

const app = express();
const PORT = 5002;
const logger = createLogger('book-service');

const pool = require('./db');
const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redis.connect();

// Connect to RabbitMQ (with retry) and subscribe to exchange events
connectMQ().then(async () => {
  logger.info('Connected to RabbitMQ');

  // Subscribe to EXCHANGE_COMPLETED — update book status to EXCHANGED
  await subscribe('exchange_events', 'book_exchange_completed', async (event) => {
    if (event.type === 'EXCHANGE_COMPLETED') {
      const { bookId } = event.payload;
      try {
        await pool.query("UPDATE books SET status = 'EXCHANGED' WHERE book_id = $1", [bookId]);
        logger.info('Book status updated to EXCHANGED via choreography', { bookId });
      } catch (err) {
        logger.error('Failed to update book status from EXCHANGE_COMPLETED', { bookId, error: err.message });
      }
    }
  });
  logger.info('Subscribed to exchange_events');
}).catch(err => logger.error('RabbitMQ connection failed', { error: err.message }));

app.use(express.json());
app.use(cors());

// Health check with DB connectivity verification
app.use(healthCheck('book-service', {
  db: () => pool.query('SELECT 1')
}));

app.get('/', (req, res) => {
  res.send('Book Service is running');
});

// Create book (CRUD + event sourcing + publish event)
app.post('/books', async (req, res) => {
  const { name, author, isbn, publicationDate, genre } = req.body;
  try {
    // Write to books table, letting DB generate book_id (serial)
    const insertResult = await pool.query(
      'INSERT INTO books (name, author, isbn, publication_date, genre) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, author, isbn, publicationDate, genre]
    );
    const book = insertResult.rows[0];
    // Write to events table
    const event = {
      eventType: 'BookAdded',
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        bookId: book.book_id,
        name: book.name,
        author: book.author,
        isbn: book.isbn,
        publicationDate: book.publication_date,
        genre: book.genre,
        status: book.status
      }
    };
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    // Publish event to Redis (legacy)
    await redis.publish('book-events', JSON.stringify(event));
    // Publish BOOK_CREATED to RabbitMQ (choreography)
    await publish('book_events', {
      eventId: `${book.book_id}-${Date.now()}`,
      type: 'BOOK_CREATED',
      timestamp: event.timestamp,
      payload: {
        bookId: book.book_id,
        title: book.name,
        author: book.author,
        status: book.status
      }
    });
    logger.info('Book created and BOOK_CREATED event published', { bookId: book.book_id, name: book.name });
    res.status(201).json({
      message: 'Book created, event stored, and published',
      event,
      book: {
        bookId: book.book_id,
        name: book.name,
        author: book.author,
        isbn: book.isbn,
        publicationDate: book.publication_date,
        genre: book.genre,
        status: book.status
      }
    });
  } catch (err) {
    logger.error('Failed to create book', { error: err.message });
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// Update book details
app.put('/books/:bookId', async (req, res) => {
  const { bookId } = req.params;
  const { name, status } = req.body;
  const event = {
    eventType: 'BookUpdated',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: { bookId: Number(bookId), name, status }
  };
  try {
    // Update books table (read model)
    await pool.query(
      'UPDATE books SET name = $1, status = $2 WHERE book_id = $3',
      [name, status, bookId]
    );
    // Store event
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    res.status(201).json({ message: 'BookUpdated event stored and book updated', event });
  } catch (err) {
    logger.error('Failed to update book', { error: err.message, bookId: Number(bookId) });
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Reserve a book
app.post('/books/:bookId/reserve', async (req, res) => {
  const { bookId } = req.params;
  const { userId } = req.body;
  const event = {
    eventType: 'BookReserved',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: { bookId: Number(bookId), userId }
  };
  try {
    // Update books table (read model)
    await pool.query(
      'UPDATE books SET status = $1, reserved_by = $2 WHERE book_id = $3',
      ['RESERVED', userId, bookId]
    );
    // Store event
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    res.status(201).json({ message: 'BookReserved event stored and book reserved', event });
  } catch (err) {
    logger.error('Failed to reserve book', { error: err.message, bookId: Number(bookId) });
    res.status(500).json({ error: 'Failed to reserve book' });
  }
});

// Return a book
app.post('/books/:bookId/return', async (req, res) => {
  const { bookId } = req.params;
  const { userId } = req.body;
  const event = {
    eventType: 'BookReturned',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: { bookId: Number(bookId), userId }
  };
  try {
    // Update books table (read model)
    await pool.query(
      'UPDATE books SET status = $1, reserved_by = NULL WHERE book_id = $2',
      ['AVAILABLE', bookId]
    );
    // Store event
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    res.status(201).json({ message: 'BookReturned event stored and book returned', event });
  } catch (err) {
    logger.error('Failed to return book', { error: err.message, bookId: Number(bookId) });
    res.status(500).json({ error: 'Failed to return book' });
  }
});

// Get list of books (reconstructed from events)
app.get('/books', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM events WHERE event_type IN ('BookAdded', 'BookUpdated', 'BookReserved', 'BookReturned') ORDER BY timestamp ASC"
    );
    const books = {};
    result.rows.forEach(event => {
      const { event_type, data } = event;
      if (event_type === 'BookAdded') {
        books[data.bookId] = { ...data, status: 'AVAILABLE' };
      } else if (event_type === 'BookUpdated' && books[data.bookId]) {
        if (data.name) books[data.bookId].name = data.name;
        if (data.status) books[data.bookId].status = data.status;
      } else if (event_type === 'BookReserved' && books[data.bookId]) {
        books[data.bookId].status = 'RESERVED';
        books[data.bookId].reservedBy = data.userId;
      } else if (event_type === 'BookReturned' && books[data.bookId]) {
        books[data.bookId].status = 'AVAILABLE';
        delete books[data.bookId].reservedBy;
      }
    });
    res.json(Object.values(books));
  } catch (err) {
    logger.error('Failed to fetch books', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get book by ID (CRUD)
app.get('/books/:bookId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books WHERE book_id = $1', [req.params.bookId]);
    if (result.rows.length === 0) {
      logger.warn('Book not found', { bookId: req.params.bookId });
      return res.status(404).json({ error: 'Book not found' });
    }
    const book = result.rows[0];
    res.json({
      bookId: book.book_id,
      name: book.name,
      author: book.author,
      isbn: book.isbn,
      publicationDate: book.publication_date,
      genre: book.genre,
      status: book.status
    });
  } catch (err) {
    logger.error('Failed to fetch book', { error: err.message, bookId: req.params.bookId });
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Only start the server if this file is run directly (not when imported for tests)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Book Service listening on port ${PORT}`);
  });
}

module.exports = app;
