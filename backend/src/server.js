import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb } from "./db.js";
import ingestRoute from "./routes/ingest.js";
import loadsRoute from "./routes/loads.js";
import statsRoute from "./routes/stats.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: [process.env.WEB_ORIGIN || "http://localhost:5173"]
}));

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/ingest", ingestRoute);
app.use("/api/loads", loadsRoute);
app.use("/api/stats", statsRoute);

const port = Number(process.env.PORT || 4000);

async function start() {
  await initDb();
  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("SERVER START ERROR:", err);
  process.exit(1);
});