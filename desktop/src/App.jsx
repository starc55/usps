import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://usps-jgp7.onrender.com";

function parseMiles(distance) {
  const m = String(distance || "").replace(/,/g, "").match(/[\d.]+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

function buildMapUrl(item) {
  const origin = encodeURIComponent(item.pickup_full || item.from_city || "");
  const destination = encodeURIComponent(item.delivery_full || item.to_city || "");
  if (!origin || !destination) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
}

function StatCard({ label, value }) {
  return (
    <div className="statCard">
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}

function LoadCard({ item }) {
  const mapUrl = buildMapUrl(item);

  return (
    <div className="card">
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
          <strong>{item.ends_in || "-"}</strong>
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

  async function loadData() {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (status !== "ALL") qs.set("status", status);

    const [loadsResp, statsResp] = await Promise.all([
      fetch(`${API_BASE}/api/loads?${qs.toString()}`),
      fetch(`${API_BASE}/api/stats`)
    ]);

    const loadsJson = await loadsResp.json();
    const statsJson = await statsResp.json();

    if (loadsJson.ok) setItems(loadsJson.items);
    if (statsJson.ok) setStats(statsJson);
  }

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 5000);
    return () => clearInterval(t);
  }, [search, status]);

  const filtered = useMemo(() => {
    let list = [...items];

    if (maxMiles !== "ALL") {
      const limit = Number(maxMiles);
      list = list.filter((x) => parseMiles(x.distance) <= limit);
    }

    return list;
  }, [items, maxMiles]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>USPS Load Dashboard</h1>
          <p>Live web app for logistics team</p>
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

        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All status</option>
          <option value="Active">Active</option>
          <option value="Pickup Soon">Pickup Soon</option>
        </select>

        <select className="input" value={maxMiles} onChange={(e) => setMaxMiles(e.target.value)}>
          <option value="ALL">Any miles</option>
          <option value="300">Under 300</option>
          <option value="600">Under 600</option>
          <option value="1000">Under 1000</option>
          <option value="1500">Under 1500</option>
        </select>
      </section>

      <section className="list">
        {filtered.map((item) => (
          <LoadCard key={item.id} item={item} />
        ))}
      </section>
    </div>
  );
}