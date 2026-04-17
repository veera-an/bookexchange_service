const createLogger = require('./shared/logger');
const { subscribe } = require('./shared/messaging');

const logger = createLogger('notification-service');

async function start() {
  logger.info('Notification Service starting...');

  // Subscribe to BOOK_CREATED events from book_events exchange
  await subscribe('book_events', 'notification_book_created', (event) => {
    if (event.type === 'BOOK_CREATED') {
      logger.info(`Notification: New book "${event.payload.title}" is now available for exchange!`, {
        bookId: event.payload.bookId,
        title: event.payload.title,
        author: event.payload.author
      });
    }
  });

  logger.info('Subscribed to book_events exchange');

  // Subscribe to EXCHANGE_COMPLETED events from exchange_events exchange
  await subscribe('exchange_events', 'notification_exchange_completed', (event) => {
    if (event.type === 'EXCHANGE_COMPLETED') {
      logger.info(`Notification: Trade ${event.payload.tradeId} completed! Book ${event.payload.bookId} has been exchanged.`, {
        tradeId: event.payload.tradeId,
        bookId: event.payload.bookId
      });
    }
  });

  logger.info('Subscribed to exchange_events exchange');
}

start().catch(err => {
  logger.error('Notification Service failed to start', { error: err.message });
  process.exit(1);
});
