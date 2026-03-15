import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import logo from "./assets/logo.jpg";

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

function timerClass(expiresAt, nowMs) {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - nowMs;
  if (diff <= 0 || diff < 5 * 60000) return "timerRed";
  if (diff < 15 * 60000) return "timerYellow";
  return "";
}

function playBeep() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const play = (freq, startOffset, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
      gain.gain.linearRampToValueAtTime(
        0.18,
        ctx.currentTime + startOffset + 0.02
      );
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startOffset + dur);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + dur + 0.05);
    };
    play(880, 0, 0.35);
    play(1100, 0.2, 0.3);
  } catch (e) {}
}

function Toast({ message, show }) {
  return <div className={`toast ${show ? "toastShow" : ""}`}>{message}</div>;
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`statCard ${accent || ""}`}>
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}

function LoadCard({ item, nowMs, isNew, isFav, onToggleFav }) {
  const mapUrl = buildMapUrl(item);
  const remaining = formatRemaining(item.expires_at, nowMs);
  const tc = timerClass(item.expires_at, nowMs);
  const badgeCls = `badge ${item.status === "Pickup Soon" ? "badgeSoon" : ""}`;

  return (
    <div className={`card ${isNew ? "cardNew" : ""}`}>
      <button
        className={`cardStar ${isFav ? "cardStarActive" : ""}`}
        onClick={() => onToggleFav(item.id)}
        title={isFav ? "Remove from saved" : "Save load"}
      >
        ★
      </button>

      <div className="cardTop">
        <span className={badgeCls}>{item.status || "Load"}</span>
        <span className="loadId">#{item.load_id}</span>
      </div>

      <div className="routeBox">
        <div className="routeRow">
          <span className="routeLabel">From</span>
          <span className="routeVal">{item.from_city || "-"}</span>
        </div>
        <div className="routeRow">
          <span className="routeLabel">To</span>
          <span className="routeVal">{item.to_city || "-"}</span>
        </div>
      </div>

      <div className="metaGrid">
        <div className="metaCell">
          <span>Pickup</span>
          <strong>{item.pickup || "-"}</strong>
        </div>
        <div className="metaCell">
          <span>Miles</span>
          <strong>{item.distance || "-"}</strong>
        </div>
        <div className="metaCell">
          <span>Ends In</span>
          <strong className={tc}>{remaining}</strong>
        </div>
      </div>

      <div className="cardFooter">
        {mapUrl ? (
          <a className="mapBtn" href={mapUrl} target="_blank" rel="noreferrer">
            📍 Map
          </a>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <button className="favStrip" onClick={() => onToggleFav(item.id)}>
          {isFav ? "★ Saved" : "☆ Save"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, pickupSoon: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [maxMiles, setMaxMiles] = useState("ALL");
  const [sortMode, setSortMode] = useState("default");
  const [nowMs, setNowMs] = useState(Date.now());
  const [clock, setClock] = useState("");
  const [toast, setToast] = useState({ show: false, msg: "" });
  const [favorites, setFavorites] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("usps_favs") || "[]"));
    } catch {
      return new Set();
    }
  });

  const seenIdsRef = useRef(new Set());
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast({ show: true, msg });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast({ show: false, msg: "" }),
      2800
    );
  }, []);

  const toggleFav = useCallback((id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("usps_favs", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (status !== "ALL") qs.set("status", status);

      const [loadsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/loads?${qs}`),
        fetch(`${API_BASE}/api/stats`),
      ]);
      const loadsJson = await loadsRes.json();
      const statsJson = await statsRes.json();

      if (statsJson.ok) setStats(statsJson);

      if (loadsJson.ok) {
        const now = Date.now();
        let hasNew = false;
        const nextItems = (loadsJson.items || [])
          .filter(
            (item) =>
              !item.expires_at || new Date(item.expires_at).getTime() > now
          )
          .map((item) => {
            const isNew = !seenIdsRef.current.has(item.id);
            if (isNew) {
              seenIdsRef.current.add(item.id);
              hasNew = true;
            }
            return { ...item, __isNew: isNew };
          });

        if (hasNew && seenIdsRef.current.size > 0) {
          playBeep();
          showToast("🔔 New load arrived!");
        }

        setItems(nextItems);
        setTimeout(() => {
          setItems((prev) => prev.map((x) => ({ ...x, __isNew: false })));
        }, 2500);
      }
    } catch (e) {
      console.warn("API error:", e);
    }
  }, [search, status, showToast]);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 5000);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setItems((prev) =>
        prev.filter(
          (x) => !x.expires_at || new Date(x.expires_at).getTime() > now
        )
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const updateClock = () => {
      setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    };
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    let list = items.filter((x) => {
      if (maxMiles !== "ALL" && parseMiles(x.distance) > Number(maxMiles))
        return false;
      return true;
    });

    if (sortMode === "miles-asc")
      list = [...list].sort(
        (a, b) => parseMiles(a.distance) - parseMiles(b.distance)
      );
    else if (sortMode === "miles-desc")
      list = [...list].sort(
        (a, b) => parseMiles(b.distance) - parseMiles(a.distance)
      );
    else if (sortMode === "expire")
      list = [...list].sort((a, b) => {
        const ta = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
        const tb = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
        return ta - tb;
      });
    else if (sortMode === "favs")
      list = [...list].sort(
        (a, b) => (favorites.has(b.id) ? 1 : 0) - (favorites.has(a.id) ? 1 : 0)
      );

    return list;
  }, [items, maxMiles, sortMode, favorites]);

  const SORT_OPTS = [
    { key: "default", label: "Default" },
    { key: "miles-asc", label: "Miles ↑" },
    { key: "miles-desc", label: "Miles ↓" },
    { key: "expire", label: "Expiring" },
    { key: "favs", label: "⭐ Saved" },
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="logoWrap">
          <div className="logoIcon">
            <img src={logo} alt="" />
          </div>
          <div className="logoText">
            <h1>USPS Load Dashboard</h1>
            <p>Live freight monitor</p>
          </div>
        </div>
        <div className="headerRight">
          <div className="liveBadge">
            <div className="liveDot" />
            LIVE
          </div>
          <span className="clockText">{clock}</span>
        </div>
      </header>

      <section className="statsRow">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Active" value={stats.active} accent="green" />
        <StatCard
          label="Pickup Soon"
          value={stats.pickupSoon}
          accent="yellow"
        />
      </section>

      <section className="filters">
        <input
          className="filterInput"
          placeholder="Search load ID, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filterInput"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All status</option>
          <option value="Active">Active</option>
          <option value="Pickup Soon">Pickup Soon</option>
        </select>
        <select
          className="filterInput"
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

      <div className="toolbar">
        <span className="resultsInfo">
          {filtered.length} load{filtered.length !== 1 ? "s" : ""}
        </span>
        <div className="sortBtns">
          {SORT_OPTS.map((o) => (
            <button
              key={o.key}
              className={`sortBtn ${sortMode === o.key ? "sortBtnActive" : ""}`}
              onClick={() => setSortMode(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <section className="cardsGrid">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="emptyIcon">📭</div>
            <p>No loads match your filters</p>
          </div>
        ) : (
          filtered.map((item) => (
            <LoadCard
              key={item.id}
              item={item}
              nowMs={nowMs}
              isNew={item.__isNew}
              isFav={favorites.has(item.id)}
              onToggleFav={toggleFav}
            />
          ))
        )}
      </section>

      <Toast message={toast.msg} show={toast.show} />
    </div>
  );
}
