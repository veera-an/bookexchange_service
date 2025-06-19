// NotificationService: Consumes BookAdded events from Redis
const { createClient } = require('redis');

const redis = createClient({ url: 'redis://redis:6379' });

(async () => {
  await redis.connect();
  await redis.subscribe('book-events', (message) => {
    const event = JSON.parse(message);
    if (event.eventType === 'BookAdded') {
      console.log('NotificationService: New book added:', event.data);
      // Here you could send an email, push notification, etc.
    }
  });
})();
