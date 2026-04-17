const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'user-db',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'userservice',
  password: process.env.PGPASSWORD || 'userservice',
  database: process.env.PGDATABASE || 'userdb',
});

module.exports = pool;