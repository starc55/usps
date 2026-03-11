import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb } from "./db.js";
import ingestRoute from "./routes/ingest.js";
import loadsRoute from "./routes/loads.js";
import statsRoute from "./routes/stats.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  process.env.WEB_ORIGIN,
  "http://localhost:5173"
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  }
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
    console.log(`Backend running on port ${port}`);
    console.log("Allowed origins:", allowedOrigins);
  });
}

start().catch((err) => {
  console.error("SERVER START ERROR:", err);
  process.exit(1);
});