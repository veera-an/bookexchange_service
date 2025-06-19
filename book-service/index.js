const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const app = express();
const PORT = 5002;

const pool = require('./db');
const redis = createClient({ url: 'redis://redis:6379' });
redis.connect();

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Book Service is running');
});

// Create book (CRUD + event sourcing + publish event)
app.post('/books', async (req, res) => {
  console.log('POST /books called with body:', req.body);
  const { bookId, name, author, isbn, publicationDate, genre } = req.body;
  const event = {
    eventType: 'BookAdded',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: { bookId, name, author, isbn, publicationDate, genre }
  };
  try {
    // Write to books table
    await pool.query(
      'INSERT INTO books (book_id, name, author, isbn, publication_date, genre) VALUES ($1, $2, $3, $4, $5, $6)',
      [bookId, name, author, isbn, publicationDate, genre]
    );
    // Write to events table
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    // Publish event to Redis
    await redis.publish('book-events', JSON.stringify(event));
    res.status(201).json({ message: 'Book created, event stored, and published', event });
  } catch (err) {
    console.error('Error creating book:', err);
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
    data: { bookId, name, status }
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
    console.error('Error updating book:', err);
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
    data: { bookId, userId }
  };
  try {
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    res.status(201).json({ message: 'BookReserved event stored', event });
  } catch (err) {
    console.error('Error storing event:', err);
    res.status(500).json({ error: 'Failed to store event' });
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
    data: { bookId, userId }
  };
  try {
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    res.status(201).json({ message: 'BookReturned event stored', event });
  } catch (err) {
    console.error('Error storing event:', err);
    res.status(500).json({ error: 'Failed to store event' });
  }
});

// Get list of books (reconstructed from events)
app.get('/books', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events WHERE event_type IN ($1, $2, $3, $4) ORDER BY timestamp ASC', [
      'BookAdded', 'BookUpdated', 'BookReserved', 'BookReturned'
    ]);
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
    console.error('Error fetching books:', err);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get book by ID (CRUD)
app.get('/books/:bookId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books WHERE book_id = $1', [req.params.bookId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

app.listen(PORT, () => {
  console.log(`Book Service listening on port ${PORT}`);
});
