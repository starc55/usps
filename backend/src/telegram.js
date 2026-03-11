import dotenv from "dotenv";

dotenv.config();

function buildMapUrl(load) {
  const origin = encodeURIComponent(load.pickup_full || load.from_city || "");
  const destination = encodeURIComponent(load.delivery_full || load.to_city || "");
  if (!origin || !destination) return null;

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
}

function formatTelegramText(load) {
  return [
    `🚚 New Load: #${load.load_id}`,
    "",
    `From: ${load.from_city}`,
    `To: ${load.to_city}`,
    `Pickup: ${load.pickup}`,
    `Miles: ${load.distance}`,
    load.ends_in ? `Ends in: ${load.ends_in}` : null,
    load.status ? `Status: ${load.status}` : null
  ].filter(Boolean).join("\n");
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
    disable_web_page_preview: true
  };

  const mapUrl = buildMapUrl(load);
  if (mapUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "📍 Map", url: mapUrl }]]
    };
  }

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await resp.text();
  console.log("TELEGRAM STATUS:", resp.status);
  console.log("TELEGRAM RESPONSE:", text);
}