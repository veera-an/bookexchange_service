const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const createLogger = require('./shared/logger');
const healthCheck = require('./shared/healthCheck');
const { connect: connectMQ, publish } = require('./shared/messaging');

const app = express();
const PORT = 5003;
const logger = createLogger('exchange-service');

const pool = require('./db');

const BOOK_SERVICE_URL = process.env.BOOK_SERVICE_URL || 'http://book-service:5002';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:5001';

// Connect to RabbitMQ (with retry)
connectMQ().then(() => logger.info('Connected to RabbitMQ')).catch(err => logger.error('RabbitMQ connection failed', { error: err.message }));

app.use(express.json());
app.use(cors());

// Health check with DB connectivity verification
app.use(healthCheck('exchange-service', {
  db: () => pool.query('SELECT 1')
}));

app.get('/', (req, res) => {
  res.send('Exchange Service is running');
});

// ─── POST /trades — Orchestrate a new trade ──────────────────
app.post('/trades', async (req, res) => {
  const { bookId, requesterId } = req.body;

  if (!bookId || !requesterId) {
    return res.status(400).json({ error: 'bookId and requesterId are required' });
  }

  const tradeId = uuidv4();
  logger.info('Trade orchestration started', { tradeId, bookId, requesterId });

  // Step 1: Verify the book exists and is available (Request-Reply to Book Service)
  let book;
  try {
    logger.info('Checking book availability', { tradeId, bookId });
    const bookRes = await axios.get(`${BOOK_SERVICE_URL}/books/${bookId}`, { timeout: 5000 });
    book = bookRes.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      logger.warn('Book not found', { tradeId, bookId });
      return res.status(404).json({ error: 'Book not found' });
    }
    logger.error('Book Service unreachable', { tradeId, error: err.message });
    return res.status(502).json({ error: 'Book Service unavailable' });
  }

  if (book.status !== 'AVAILABLE') {
    logger.warn('Book not available for trade', { tradeId, bookId, status: book.status });
    return res.status(409).json({ error: `Book is not available (status: ${book.status})` });
  }
  logger.info('Book is available', { tradeId, bookId });

  // Step 2: Verify the requester exists (Request-Reply to User Service)
  try {
    logger.info('Verifying requester', { tradeId, requesterId });
    await axios.get(`${USER_SERVICE_URL}/users/${requesterId}`, { timeout: 5000 });
  } catch (err) {
    if (err.response && err.response.status === 404) {
      logger.warn('Requester not found', { tradeId, requesterId });
      return res.status(404).json({ error: 'Requester user not found' });
    }
    logger.error('User Service unreachable', { tradeId, error: err.message });
    return res.status(502).json({ error: 'User Service unavailable' });
  }
  logger.info('Requester verified', { tradeId, requesterId });

  // Step 3: Create the trade record with status PENDING
  const event = {
    eventType: 'TradeInitiated',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: { tradeId, bookId, requesterId, ownerId: book.owner_id || null }
  };

  try {
    await pool.query(
      `INSERT INTO trades (trade_id, book_id, requester_id, owner_id, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [tradeId, bookId, requesterId, book.owner_id || null]
    );
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );

    logger.info('Trade created successfully', { tradeId, status: 'PENDING' });
    res.status(201).json({ message: 'Trade initiated', tradeId, status: 'PENDING' });
  } catch (err) {
    logger.error('Failed to create trade', { tradeId, error: err.message });
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// ─── GET /trades/:tradeId — Fetch trade status ──────────────
app.get('/trades/:tradeId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trades WHERE trade_id = $1', [req.params.tradeId]);
    if (result.rows.length === 0) {
      logger.warn('Trade not found', { tradeId: req.params.tradeId });
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to fetch trade', { tradeId: req.params.tradeId, error: err.message });
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// ─── GET /trades — List all trades ───────────────────────────
app.get('/trades', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trades ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to list trades', { error: err.message });
    res.status(500).json({ error: 'Failed to list trades' });
  }
});

// ─── POST /trades/:tradeId/accept — Complete a trade ─────────
app.post('/trades/:tradeId/accept', async (req, res) => {
  const { tradeId } = req.params;

  try {
    const result = await pool.query('SELECT * FROM trades WHERE trade_id = $1', [tradeId]);
    if (result.rows.length === 0) {
      logger.warn('Trade not found for accept', { tradeId });
      return res.status(404).json({ error: 'Trade not found' });
    }

    const trade = result.rows[0];
    if (trade.status !== 'PENDING') {
      logger.warn('Trade not in PENDING state', { tradeId, status: trade.status });
      return res.status(409).json({ error: `Trade cannot be accepted (status: ${trade.status})` });
    }

    // Update trade status to COMPLETED
    await pool.query(
      'UPDATE trades SET status = $1, completed_at = NOW() WHERE trade_id = $2',
      ['COMPLETED', tradeId]
    );

    // Store event
    const event = {
      eventType: 'TradeCompleted',
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: { tradeId, bookId: trade.book_id, requesterId: trade.requester_id }
    };
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );

    // Publish EXCHANGE_COMPLETED to RabbitMQ (choreography)
    await publish('exchange_events', {
      eventId: `${tradeId}-${Date.now()}`,
      type: 'EXCHANGE_COMPLETED',
      timestamp: event.timestamp,
      payload: {
        tradeId,
        bookId: trade.book_id,
        requesterId: trade.requester_id
      }
    });

    logger.info('Trade accepted and EXCHANGE_COMPLETED published', { tradeId, bookId: trade.book_id });
    res.json({ message: 'Trade completed', tradeId, status: 'COMPLETED' });
  } catch (err) {
    logger.error('Failed to accept trade', { tradeId, error: err.message });
    res.status(500).json({ error: 'Failed to accept trade' });
  }
});

// ─── POST /trades/:tradeId/reject — Reject a trade ──────────
app.post('/trades/:tradeId/reject', async (req, res) => {
  const { tradeId } = req.params;
  const { reason } = req.body;

  try {
    const result = await pool.query('SELECT * FROM trades WHERE trade_id = $1', [tradeId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const trade = result.rows[0];
    if (trade.status !== 'PENDING') {
      return res.status(409).json({ error: `Trade cannot be rejected (status: ${trade.status})` });
    }

    await pool.query(
      'UPDATE trades SET status = $1, rejected_reason = $2 WHERE trade_id = $3',
      ['REJECTED', reason || null, tradeId]
    );

    logger.info('Trade rejected', { tradeId, reason });
    res.json({ message: 'Trade rejected', tradeId, status: 'REJECTED' });
  } catch (err) {
    logger.error('Failed to reject trade', { tradeId, error: err.message });
    res.status(500).json({ error: 'Failed to reject trade' });
  }
});

app.listen(PORT, () => {
  logger.info(`Exchange Service listening on port ${PORT}`);
});
