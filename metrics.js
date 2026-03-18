const config = require('./config');
const os = require('os');

function sendMetric(name, value, type = 'gauge', unit = '1', attributes = {}) {
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
                      asInt: Math.round(value),
                      timeUnixNano: Date.now() * 1_000_000,
                      attributes: Object.entries(attributes).map(([k, v]) => ({
                        key: k,
                        value: { stringValue: String(v) },
                      })),
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

  if (type === 'sum') {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.aggregationTemporality =
      'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.isMonotonic = true;
  }

  fetch(config.metrics.endpointUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metric),
  }).catch((err) => console.error('Metric error', err));
}

function requestTracker(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    sendMetric('http_requests', 1, 'sum', '1', {
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
    });
    sendMetric('http_latency', duration, 'gauge', 'ms', {
      route: req.originalUrl,
    });
  });
  next();
}

function trackAuth(success) {
  sendMetric('auth_attempts', 1, 'sum', '1', {
    result: success ? 'success' : 'failure',
  });
}

let activeUsers = 0;

function userLogin() {
  activeUsers++;
}

function userLogout() {
  activeUsers--;
}

function pizzaPurchase(success, latency, price) {
  sendMetric('pizza_orders', 1, 'sum', '1', {
    status: success ? 'success' : 'failure',
  });
  sendMetric('pizza_latency', latency, 'gauge', 'ms');
  if (success) {
    sendMetric('pizza_revenue', price, 'sum', 'usd');
  }
}

function getCpu() {
  return (os.loadavg()[0] / os.cpus().length) * 100;
}

function getMemory() {
  return ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
}

setInterval(() => {
  sendMetric('cpu_usage', getCpu(), 'gauge', '%');
  sendMetric('memory_usage', getMemory(), 'gauge', '%');
  sendMetric('active_users', activeUsers, 'gauge', '1');
}, 5000);

module.exports = {
  requestTracker,
  trackAuth,
  pizzaPurchase,
  userLogin,
  userLogout,
};