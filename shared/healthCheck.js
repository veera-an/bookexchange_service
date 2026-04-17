const express = require('express');

/**
 * Returns an Express Router with a GET /health endpoint.
 * @param {string} serviceName - Name of the service
 * @param {object} [checks] - Optional dependency check functions
 * @param {function} [checks.db] - Async function that throws if DB is unreachable
 * @returns {express.Router}
 */
function healthCheck(serviceName, checks = {}) {
  const router = express.Router();

  router.get('/health', async (_req, res) => {
    const health = {
      status: 'UP',
      service: serviceName,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    // If a DB check was provided, verify connectivity
    if (checks.db) {
      try {
        await checks.db();
        health.database = 'UP';
      } catch {
        health.status = 'DOWN';
        health.database = 'DOWN';
        return res.status(503).json(health);
      }
    }

    res.json(health);
  });

  return router;
}

module.exports = healthCheck;
