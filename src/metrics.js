const config = require('./config');
const os = require('os');

let httpRequests = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
let authMetrics = { success: 0, failure: 0 };
let activeUsers = new Set();
let pizzaMetrics = {
  sold: 0,
  failures: 0,
  revenue: 0,
  lastLatency: 0,
};

function requestTracker(req, res, next) {
  if (httpRequests[req.method] !== undefined) {
    httpRequests[req.method]++;
  }
  if (req.user?.id) {
    activeUsers.add(req.user.id);
  }
  next();
}

function authAttempt(success) {
  if (success) authMetrics.success++;
  else authMetrics.failure++;
}

function pizzaPurchase(success, latency, price) {
  if (success) {
    pizzaMetrics.sold++;
    pizzaMetrics.revenue += price;
  } else {
    pizzaMetrics.failures++;
  }
  pizzaMetrics.lastLatency = latency;
}

function getCpuUsage() {
  const load = os.loadavg()[0];
  const cores = os.cpus().length;
  return (load / cores) * 100;
}

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return (used / total) * 100;
}

function buildMetric(name, value, type, unit) {
  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name,
                unit,
                [type]: {
                  dataPoints: [
                    {
                      asInt: Number.isInteger(value) ? value : undefined,
                      asDouble: !Number.isInteger(value) ? value : undefined,
                      timeUnixNano: Date.now() * 1e6,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };
  if (type === "sum") {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality =
      "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
  }
  return metric;
}

async function sendMetric(name, value, type, unit) {
  const body = JSON.stringify(buildMetric(name, value, type, unit));
  try {
    const res = await fetch(config.metrics.endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.metrics.accountId}:${config.metrics.apiKey}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (!res.ok) {
      console.error("Metric rejected:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Metric send error:", err.message);
  }
}

async function sendAllMetrics() {
  await Promise.all([
    sendMetric("http_get_total", httpRequests.GET, "sum", "1"),
    sendMetric("http_post_total", httpRequests.POST, "sum", "1"),
    sendMetric("http_put_total", httpRequests.PUT, "sum", "1"),
    sendMetric("http_delete_total", httpRequests.DELETE, "sum", "1"),
    sendMetric("auth_success_total", authMetrics.success, "sum", "1"),
    sendMetric("auth_failure_total", authMetrics.failure, "sum", "1"),
    sendMetric("active_users", activeUsers.size, "gauge", "1"),
    sendMetric("cpu_percent", getCpuUsage(), "gauge", "%"),
    sendMetric("memory_percent", getMemoryUsage(), "gauge", "%"),
    sendMetric("pizza_sold_total", pizzaMetrics.sold, "sum", "1"),
    sendMetric("pizza_failures_total", pizzaMetrics.failures, "sum", "1"),
    sendMetric("pizza_revenue", pizzaMetrics.revenue, "gauge", "usd"),
    sendMetric("pizza_latency_milliseconds", pizzaMetrics.lastLatency, "gauge", "ms"),
  ]);
  activeUsers.clear();
  console.log("sending metrics batch");
}

function start(period = 5000) {
  console.log("METRICS START CALLED WITH:", period);
  setInterval(sendAllMetrics, period);
}

module.exports = {
  requestTracker,
  authAttempt,
  pizzaPurchase,
  start,
};

// updated github secrets