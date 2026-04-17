const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

let connection = null;
let channel = null;

/**
 * Connect to RabbitMQ with retry logic.
 * Returns the channel for publishing/consuming.
 */
async function connect(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      return channel;
    } catch (err) {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`Failed to connect to RabbitMQ after ${retries} attempts: ${err.message}`);
      }
    }
  }
}

/**
 * Publish a message to a fanout exchange.
 * @param {string} exchange - Exchange name (e.g. 'book_events')
 * @param {object} message - The event payload to publish
 */
async function publish(exchange, message) {
  if (!channel) await connect();
  await channel.assertExchange(exchange, 'fanout', { durable: true });
  channel.publish(exchange, '', Buffer.from(JSON.stringify(message)));
}

/**
 * Subscribe to a fanout exchange.
 * @param {string} exchange - Exchange name to subscribe to
 * @param {string} queueName - Unique queue name for this consumer
 * @param {function} handler - Async callback receiving the parsed message
 */
async function subscribe(exchange, queueName, handler) {
  if (!channel) await connect();
  await channel.assertExchange(exchange, 'fanout', { durable: true });
  const q = await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(q.queue, exchange, '');
  channel.consume(q.queue, async (msg) => {
    if (msg) {
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        channel.ack(msg);
      } catch (err) {
        channel.nack(msg, false, false);
      }
    }
  });
}

module.exports = { connect, publish, subscribe };
