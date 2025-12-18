import { createApp } from "./app";

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();
app.listen(PORT, () => {
  console.log(`mock-network-api listening on :${PORT}`);
});
