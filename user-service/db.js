const { Pool } = require('pg');

const pool = new Pool({
  host: 'database-service', // service name from docker-compose
  user: 'bookexchange',
  password: 'bookexchange',
  database: 'bookexchange',
  port: 5432,
});

module.exports = pool;