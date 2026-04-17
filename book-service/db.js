// db.js - PostgreSQL client setup for Book Service
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'book-db',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'bookservice',
  password: process.env.PGPASSWORD || 'bookservice',
  database: process.env.PGDATABASE || 'bookdb',
});

module.exports = pool;
