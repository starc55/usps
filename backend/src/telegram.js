import dotenv from "dotenv";

dotenv.config();

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMapUrl(load) {
  const origin = encodeURIComponent(load.pickup_full || load.from_city || "");
  const destination = encodeURIComponent(
    load.delivery_full || load.to_city || ""
  );
  if (!origin || !destination) return null;

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
}

function makeTag(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function formatTelegramText(load) {
  const loadId = escapeHtml(load.load_id || "-");
  const fromCity = escapeHtml(load.from_city || "-");
  const toCity = escapeHtml(load.to_city || "-");
  const pickup = escapeHtml(load.pickup || "-");
  const distance = escapeHtml(load.distance || "-");
  const endsIn = escapeHtml(load.ends_in || "-");
  const status = escapeHtml(load.status || "LOAD");

  const fromTag = makeTag(load.from_city);
  const statusTag = makeTag(load.status);

  return [
    `🚚 <b>USPS LOAD ALERT</b>`,
    ``,
    `👥 <b>${status}</b> • <code>${loadId}</code>`,
    ``,
    `📍 <b>FROM:</b> ${fromCity}`,
    `📍 <b>TO:</b> ${toCity}`,
    ``,
    `🕒 <b>PICKUP:</b> ${pickup}`,
    `⏳ <b>ENDS IN:</b> ${endsIn}`,
    `🛣 <b>DISTANCE:</b> ${distance}`,
    ``,
    `#${statusTag || "LOAD"} #${fromTag || "USPS"}`,
  ].join("\n");
}

export async function sendTelegram(load) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("Telegram credentials missing, skipping telegram send");
    return;
  }

  const payload = {
    chat_id: chatId,
    text: formatTelegramText(load),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  const mapUrl = buildMapUrl(load);
  if (mapUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "📍 Load Route", url: mapUrl }]],
    };
  }

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  console.log("TELEGRAM STATUS:", resp.status);
  console.log("TELEGRAM RESPONSE:", text);
}
