const express = require('express');
const { PORT = 8080 } = process.env;

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kokebok server listening on port ${PORT}`);
});
