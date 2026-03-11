const PLATFORM_URL_PATTERNS = [
  "https://usps-board.sean.yukla.org/*"
];

const BACKEND_URL = "http://localhost:4000/api/ingest";
const INGEST_API_KEY = "super_ingest_key_2026";

const KEY_SEEN = "seenLoadFingerprints";
const KEY_ENABLED = "watcherEnabled";

chrome.runtime.onInstalled.addListener(async function () {
  chrome.alarms.create("poll-loads", { periodInMinutes: 1 });

  const data = await chrome.storage.local.get([KEY_SEEN, KEY_ENABLED]);

  if (!data[KEY_SEEN]) {
    await chrome.storage.local.set({ [KEY_SEEN]: {} });
  }

  if (typeof data[KEY_ENABLED] === "undefined") {
    await chrome.storage.local.set({ [KEY_ENABLED]: true });
  }
});

chrome.alarms.onAlarm.addListener(async function (alarm) {
  if (alarm.name !== "poll-loads") return;

  const data = await chrome.storage.local.get([KEY_ENABLED]);
  if (data[KEY_ENABLED] === false) return;

  await pollAllPlatformTabs();
});

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (message?.type === "LOADS_UPDATED") {
    processLoadsArray(message.data || [])
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "MANUAL_POLL") {
    pollAllPlatformTabs()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "RESET_SEEN") {
    chrome.storage.local.set({ [KEY_SEEN]: {} })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "TOGGLE_WATCHER") {
    chrome.storage.local.set({ [KEY_ENABLED]: !!message.enabled })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});

function normalize(v) {
  return (v || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function buildStableFingerprint(item) {
  return [
    normalize(item.id),
    normalize(item.from),
    normalize(item.to),
    normalize(item.pickup),
    normalize(item.distance)
  ].join("::");
}

async function pollAllPlatformTabs() {
  const data = await chrome.storage.local.get([KEY_ENABLED]);
  if (data[KEY_ENABLED] === false) return;

  const tabs = await chrome.tabs.query({ url: PLATFORM_URL_PATTERNS });

  for (const tab of tabs) {
    if (!tab.id) continue;

    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_LOADS" }).catch(() => null);
    if (!response?.ok) continue;

    await processLoadsArray(response.data || []);
  }
}

async function processLoadsArray(loads) {
  if (!Array.isArray(loads) || !loads.length) return;

  const store = await chrome.storage.local.get([KEY_SEEN]);
  const seen = store[KEY_SEEN] || {};
  const newItems = [];
  const now = Date.now();

  for (const item of loads) {
    if (!item?.id) continue;

    const fp = buildStableFingerprint(item);
    if (!seen[fp]) {
      seen[fp] = now;
      newItems.push(item);
    }
  }

  for (const key of Object.keys(seen)) {
    if (now - seen[key] > 7 * 24 * 60 * 60 * 1000) {
      delete seen[key];
    }
  }

  await chrome.storage.local.set({ [KEY_SEEN]: seen });

  if (!newItems.length) return;

  const resp = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ingest-key": INGEST_API_KEY
    },
    body: JSON.stringify({ loads: newItems })
  });

  const text = await resp.text();
  console.log("INGEST STATUS:", resp.status);
  console.log("INGEST RESPONSE:", text);
}