// db.js - PostgreSQL client setup for Book Service
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'database-service',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'bookexchange',
  password: process.env.DB_PASSWORD || 'bookexchange',
  database: process.env.DB_NAME || 'bookexchange',
});

module.exports = pool;
