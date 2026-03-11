function cleanText(v) {
  return (v || "").replace(/\s+/g, " ").trim();
}

function parseBoardLoads() {
  const tbody = document.querySelector("#tableBody");
  if (!tbody) return [];

  const rows = Array.from(tbody.querySelectorAll("tr[data-id][data-key]"));

  return rows.map((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 7) return null;

    const rawId = cleanText(cells[0]?.querySelector(".load-id-wrap")?.textContent || "");
    const id = rawId.replace(/^#/, "");
    if (!/^\d{7,}$/.test(id)) return null;

    const from = cleanText(cells[1]?.childNodes[0]?.textContent || "");
    const to = cleanText(cells[2]?.childNodes[0]?.textContent || "");
    const pickup = cleanText(cells[3]?.textContent || "");
    const miles = cleanText(cells[4]?.textContent || "");
    const endsIn = cleanText(cells[5]?.querySelector(".js-ends")?.textContent || "");
    const status = cleanText(cells[6]?.textContent || "");

    const pickupFull = cleanText(cells[1]?.getAttribute("data-full-addr") || "");
    const deliveryFull = cleanText(cells[2]?.getAttribute("data-full-addr") || "");

    return {
      id,
      from,
      to,
      pickup,
      distance: miles ? `${miles} miles` : "",
      endsIn,
      status,
      pickupFull,
      deliveryFull,
      source: "usps-board"
    };
  }).filter(Boolean);
}

async function pushLoadsNow() {
  const loads = parseBoardLoads();
  if (!loads.length) return;

  await chrome.runtime.sendMessage({
    type: "LOADS_UPDATED",
    data: loads
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_LOADS") {
    try {
      sendResponse({ ok: true, data: parseBoardLoads() });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  }
  return true;
});

const observer = new MutationObserver(() => {
  clearTimeout(window.__lwTimer);
  window.__lwTimer = setTimeout(pushLoadsNow, 800);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

setTimeout(pushLoadsNow, 1500);
setTimeout(pushLoadsNow, 4000);
setInterval(pushLoadsNow, 3000);