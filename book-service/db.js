// db.js - PostgreSQL client setup for Book Service
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'database-service',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'bookexchange',
  password: process.env.PGPASSWORD || 'bookexchange',
  database: process.env.PGDATABASE || 'bookexchange',
});

module.exports = pool;
