import { EventStore } from '@crossborder/core';
import { createWebhookApp } from './app';
import { config } from './config';

// Create shared event store (in production, this would be passed from main orchestrator)
const eventStore = new EventStore();

const { app, polygonPoller } = createWebhookApp({ eventStore });

const server = app.listen(config.port, () => {
  console.log(JSON.stringify({
    type: 'startup',
    message: 'Webhook service started',
    port: config.port,
    timestamp: new Date().toISOString(),
  }));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(JSON.stringify({ type: 'shutdown', message: 'Received SIGTERM' }));
  polygonPoller.stop();
  server.close(() => {
    process.exit(0);
  });
});
