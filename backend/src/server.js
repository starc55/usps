import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb, pool } from "./db.js";
import ingestRoute from "./routes/ingest.js";
import loadsRoute from "./routes/loads.js";
import statsRoute from "./routes/stats.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      process.env.WEB_ORIGIN?.replace(/\/$/, ""),
      "http://localhost:5173",
      "http://localhost:3000",
    ].filter(Boolean),
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/ingest", ingestRoute);
app.use("/api/loads", loadsRoute);
app.use("/api/stats", statsRoute);

// 30 minutdan eski loadlarni o‘chirish
async function cleanupOldLoads() {
  try {
    const result = await pool.query(`
      DELETE FROM loads
      WHERE created_at < NOW() - INTERVAL '30 minutes'
      RETURNING id;
    `);

    if (result.rowCount > 0) {
      console.log(`Cleanup removed ${result.rowCount} old loads`);
    }
  } catch (error) {
    console.error("AUTO CLEANUP ERROR:", error);
  }
}

// manual cleanup endpoint
app.post("/api/admin/cleanup", async (_req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM loads
      WHERE created_at < NOW() - INTERVAL '30 minutes'
      RETURNING id;
    `);

    res.json({
      ok: true,
      deletedCount: result.rowCount,
    });
  } catch (error) {
    console.error("MANUAL CLEANUP ERROR:", error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// hammasini o‘chirish uchun vaqtinchalik endpoint
app.post("/api/admin/clear-all", async (_req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM loads
      RETURNING id;
    `);

    res.json({
      ok: true,
      deletedCount: result.rowCount,
    });
  } catch (error) {
    console.error("CLEAR ALL ERROR:", error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

const port = Number(process.env.PORT || 4000);

async function start() {
  await initDb();

  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });

  // har 5 minutda eski loadlarni avtomatik tozalaydi
  setInterval(cleanupOldLoads, 5 * 60 * 1000);
}

start().catch((err) => {
  console.error("SERVER START ERROR:", err);
  process.exit(1);
});