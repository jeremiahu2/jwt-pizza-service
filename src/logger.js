const config = require('./config');

async function sendLog(level, message, meta = {}) {
  const logEvent = {
    streams: [
      {
        stream: {
          source: config.logging.source || "jwt-pizza-service",
        },
        values: [
          [
            `${Date.now()}000000`,
            JSON.stringify({
              level,
              message,
              ...meta,
            }),
          ],
        ],
      },
    ],
  };
  try {
    const res = await fetch(config.logging.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(
            `${config.logging.accountId}:${config.logging.apiKey}`
          ).toString("base64"),
      },
      body: JSON.stringify(logEvent),
    });
    if (!res.ok) {
      console.error("Failed to send log to Grafana:", await res.text());
    }
  } catch (err) {
    console.error("Logging error:", err.message);
  }
}

module.exports = {
  log: sendLog,
};