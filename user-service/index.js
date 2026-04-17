const express = require('express');
const cors = require('cors');
const createLogger = require('./shared/logger');
const healthCheck = require('./shared/healthCheck');

const app = express();
const PORT = 5001;
const logger = createLogger('user-service');

const pool = require('./db');

app.use(express.json());
app.use(cors());

// Health check with DB connectivity verification
app.use(healthCheck('user-service', {
  db: () => pool.query('SELECT 1')
}));

app.get('/', (req, res) => {
  res.send('User Service is running');
});

// Create user (CRUD + event sourcing)
app.post('/users', async (req, res) => {
  const { userId, username, email, city, preferences } = req.body;
  const event = {
    eventType: 'UserRegistered',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: { userId, username, email, city, preferences }
  };
  try {
    // Write to users table
    await pool.query(
      'INSERT INTO users (user_id, username, email, city, preferences) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, email, city, preferences]
    );
    // Write to events table
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    logger.info('User created', { userId, username });
    res.status(201).json({ message: 'User created and event stored', event });
  } catch (err) {
    logger.error('Failed to create user', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// List all users
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY username');
    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to list users', { error: err.message });
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Get user by ID (CRUD)
app.get('/users/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.userId]);
    if (result.rows.length === 0) {
      logger.warn('User not found', { userId: req.params.userId });
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to fetch user', { error: err.message, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
app.put('/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const { city, preferences } = req.body;
  const event = {
    eventType: 'UserProfileUpdated',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: { userId, city, preferences }
  };
  try {
    await pool.query(
      'INSERT INTO events (event_type, version, timestamp, data) VALUES ($1, $2, $3, $4)',
      [event.eventType, event.version, event.timestamp, event.data]
    );
    res.status(201).json({ message: 'UserProfileUpdated event stored', event });
  } catch (err) {
    logger.error('Failed to update user profile', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to store event' });
  }
});

app.listen(PORT, () => {
  logger.info(`User Service listening on port ${PORT}`);
});