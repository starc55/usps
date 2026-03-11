import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const total = await pool.query(`SELECT COUNT(*)::int AS count FROM loads`);
    const active = await pool.query(`SELECT COUNT(*)::int AS count FROM loads WHERE status = 'Active'`);
    const pickupSoon = await pool.query(`SELECT COUNT(*)::int AS count FROM loads WHERE status = 'Pickup Soon'`);

    res.json({
      ok: true,
      total: total.rows[0].count,
      active: active.rows[0].count,
      pickupSoon: pickupSoon.rows[0].count
    });
  } catch (error) {
    console.error("STATS ERROR:", error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

export default router;