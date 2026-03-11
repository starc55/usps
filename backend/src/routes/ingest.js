import express from "express";
import { pool } from "../db.js";
import { sendTelegram } from "../telegram.js";

const router = express.Router();

function cleanText(v) {
  return (v || "").replace(/\s+/g, " ").trim();
}

function normalizePlace(v) {
  return cleanText(v).toUpperCase();
}

function buildFingerprint(load) {
  return [
    cleanText(load.id),
    normalizePlace(load.from),
    normalizePlace(load.to),
    cleanText(load.pickup),
    cleanText(load.distance),
  ].join("::");
}

router.post("/", async (req, res) => {
  try {
    const apiKey = req.headers["x-ingest-key"];
    if (!apiKey || apiKey !== process.env.INGEST_API_KEY) {
      return res.status(401).json({ ok: false, error: "Invalid ingest key" });
    }

    const loads = Array.isArray(req.body?.loads) ? req.body.loads : [];
    if (!loads.length) {
      return res.status(400).json({ ok: false, error: "No loads provided" });
    }

    const inserted = [];
    const skipped = [];

    for (const raw of loads) {
      const load = {
        id: cleanText(raw.id),
        from: cleanText(raw.from),
        to: cleanText(raw.to),
        pickup: cleanText(raw.pickup),
        distance: cleanText(raw.distance),
        endsIn: cleanText(raw.endsIn),
        status: cleanText(raw.status),
        pickupFull: cleanText(raw.pickupFull),
        deliveryFull: cleanText(raw.deliveryFull),
        source: cleanText(raw.source || "usps-board"),
      };

      if (
        !load.id ||
        !load.from ||
        !load.to ||
        !load.pickup ||
        !load.distance
      ) {
        skipped.push({ reason: "missing_required_fields", load });
        continue;
      }

      const fingerprint = buildFingerprint(load);

      const query = `
        INSERT INTO loads (
          load_id,
          source,
          from_city,
          to_city,
          pickup,
          distance,
          ends_in,
          status,
          pickup_full,
          delivery_full,
          fingerprint
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (fingerprint) DO NOTHING
        RETURNING *;
      `;

      const values = [
        load.id,
        load.source,
        load.from,
        load.to,
        load.pickup,
        load.distance,
        load.endsIn,
        load.status,
        load.pickupFull,
        load.deliveryFull,
        fingerprint,
      ];

      const result = await pool.query(query, values);

      if (result.rows.length) {
        const insertedRow = result.rows[0];
        inserted.push(insertedRow);
        await sendTelegram(insertedRow);
      } else {
        skipped.push({ reason: "duplicate", loadId: load.id });
      }
    }

    return res.json({
      ok: true,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      inserted,
      skipped,
    });
  } catch (error) {
    console.error("INGEST ERROR:", error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

export default router;
