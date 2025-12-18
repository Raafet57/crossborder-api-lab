import { createApp } from "./app";

const PORT = Number(process.env.PORT ?? 4002);

const app = createApp();
app.listen(PORT, () => {
  console.log(`webhook-receiver listening on :${PORT}`);
});

