import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "https://usps-jgp7.onrender.com";

function parseMiles(distance) {
  const m = String(distance || "")
    .replace(/,/g, "")
    .match(/[\d.]+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

function buildMapUrl(item) {
  const origin = encodeURIComponent(item.pickup_full || item.from_city || "");
  const destination = encodeURIComponent(
    item.delivery_full || item.to_city || ""
  );
  if (!origin || !destination) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
}

function formatRemaining(expiresAt, nowMs) {
  if (!expiresAt) return "-";

  const diff = new Date(expiresAt).getTime() - nowMs;
  if (diff <= 0) return "Expired";

  const total = Math.floor(diff / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;

  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function StatCard({ label, value }) {
  return (
    <div className="statCard">
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}

function LoadCard({ item, nowMs, isNew }) {
  const mapUrl = buildMapUrl(item);
  const remaining = formatRemaining(item.expires_at, nowMs);

  return (
    <div className={`card ${isNew ? "cardNew" : ""}`}>
      <div className="cardTop">
        <div className="badge">{item.status || "Load"}</div>
        <div className="loadId">#{item.load_id}</div>
      </div>

      <div className="routeBox">
        <div className="routeRow">
          <span>From</span>
          <strong>{item.from_city}</strong>
        </div>
        <div className="routeRow">
          <span>To</span>
          <strong>{item.to_city}</strong>
        </div>
      </div>

      <div className="metaGrid">
        <div className="metaItem">
          <span>Pickup</span>
          <strong>{item.pickup}</strong>
        </div>
        <div className="metaItem">
          <span>Miles</span>
          <strong>{item.distance}</strong>
        </div>
        <div className="metaItem">
          <span>Ends In</span>
          <strong>{remaining}</strong>
        </div>
      </div>

      {mapUrl && (
        <a className="mapBtn" href={mapUrl} target="_blank" rel="noreferrer">
          📍 Map
        </a>
      )}
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, pickupSoon: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [maxMiles, setMaxMiles] = useState("ALL");
  const [nowMs, setNowMs] = useState(Date.now());
  const seenIdsRef = useRef(new Set());

  async function loadData() {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (status !== "ALL") qs.set("status", status);

    const [loadsResp, statsResp] = await Promise.all([
      fetch(`${API_BASE}/api/loads?${qs.toString()}`),
      fetch(`${API_BASE}/api/stats`),
    ]);

    const loadsJson = await loadsResp.json();
    const statsJson = await statsResp.json();

    if (loadsJson.ok) {
      const nextItems = (loadsJson.items || []).map((item) => {
        const isNew = !seenIdsRef.current.has(item.id);
        seenIdsRef.current.add(item.id);
        return { ...item, __isNew: isNew };
      });

      setItems(nextItems);

      setTimeout(() => {
        setItems((prev) => prev.map((x) => ({ ...x, __isNew: false })));
      }, 2500);
    }

    if (statsJson.ok) setStats(statsJson);
  }

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 5000);
    return () => clearInterval(t);
  }, [search, status]);

  useEffect(() => {
    const t = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];

    list = list.filter((x) => {
      if (!x.expires_at) return true;
      return new Date(x.expires_at).getTime() > nowMs;
    });

    if (maxMiles !== "ALL") {
      const limit = Number(maxMiles);
      list = list.filter((x) => parseMiles(x.distance) <= limit);
    }

    return list;
  }, [items, maxMiles, nowMs]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>USPS Load Dashboard</h1>
          <p>Live desktop monitor</p>
        </div>
      </header>

      <section className="stats">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Pickup Soon" value={stats.pickupSoon} />
      </section>

      <section className="filters">
        <input
          className="input"
          placeholder="Search load / from / to"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All status</option>
          <option value="Active">Active</option>
          <option value="Pickup Soon">Pickup Soon</option>
        </select>

        <select
          className="input"
          value={maxMiles}
          onChange={(e) => setMaxMiles(e.target.value)}
        >
          <option value="ALL">Any miles</option>
          <option value="300">Under 300</option>
          <option value="600">Under 600</option>
          <option value="1000">Under 1000</option>
          <option value="1500">Under 1500</option>
        </select>
      </section>

      <section className="list">
        {filtered.map((item) => (
          <LoadCard
            key={item.id}
            item={item}
            nowMs={nowMs}
            isNew={item.__isNew}
          />
        ))}
      </section>
    </div>
  );
}
