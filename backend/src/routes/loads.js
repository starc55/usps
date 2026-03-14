import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();
    const limit = Math.min(Number(req.query.limit || 100), 500);

    const conditions = [`(expires_at IS NULL OR expires_at > NOW())`];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`
        (
          load_id ILIKE $${i}
          OR from_city ILIKE $${i}
          OR to_city ILIKE $${i}
          OR pickup ILIKE $${i}
          OR distance ILIKE $${i}
        )
      `);
      values.push(`%${search}%`);
      i += 1;
    }

    if (status && status !== "ALL") {
      conditions.push(`status = $${i}`);
      values.push(status);
      i += 1;
    }

    values.push(limit);

    const result = await pool.query(
      `
      SELECT *
      FROM loads
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${i};
      `,
      values
    );

    res.json({ ok: true, items: result.rows });
  } catch (error) {
    console.error("LOADS ERROR:", error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

export default router;
