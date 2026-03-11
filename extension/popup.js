const KEY_ENABLED = "watcherEnabled";

const toggleEl = document.getElementById("toggle");
const statusTextEl = document.getElementById("statusText");
const manualPollBtn = document.getElementById("manualPollBtn");
const resetBtn = document.getElementById("resetBtn");

async function loadState() {
  const data = await chrome.storage.local.get([KEY_ENABLED]);
  const enabled = data[KEY_ENABLED] !== false;
  render(enabled);
}

function render(enabled) {
  toggleEl.classList.toggle("active", enabled);
  statusTextEl.textContent = enabled ? "Holat: Yoqilgan" : "Holat: O‘chirilgan";
}

toggleEl.addEventListener("click", async () => {
  const data = await chrome.storage.local.get([KEY_ENABLED]);
  const current = data[KEY_ENABLED] !== false;
  const next = !current;

  await chrome.storage.local.set({ [KEY_ENABLED]: next });
  render(next);

  chrome.runtime.sendMessage({ type: "TOGGLE_WATCHER", enabled: next });
});

manualPollBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "MANUAL_POLL" }).catch(() => null);
});

resetBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "RESET_SEEN" }).catch(() => null);
});

loadState();