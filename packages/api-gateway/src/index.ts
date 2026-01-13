import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(JSON.stringify({
    type: 'startup',
    message: `API Gateway started`,
    port: config.port,
    env: config.env,
    timestamp: new Date().toISOString(),
  }));
});
