const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'exchange-db',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'exchangeservice',
  password: process.env.PGPASSWORD || 'exchangeservice',
  database: process.env.PGDATABASE || 'exchangedb',
});

module.exports = pool;
