const winston = require('winston');

/**
 * Creates a structured JSON logger for a microservice.
 * @param {string} serviceName - Name of the calling service (e.g. 'user-service')
 * @returns {winston.Logger}
 */
function createLogger(serviceName) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { service: serviceName },
    transports: [
      new winston.transports.Console()
    ]
  });
}

module.exports = createLogger;
