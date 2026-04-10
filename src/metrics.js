const config = require('./config');
const os = require('os');

let httpRequests = {
  GET: 0,
  POST: 0,
  PUT: 0,
  DELETE: 0,
};
let authMetrics = {
  success: 0,
  failure: 0,
};
let activeUsers = new Set();
let pizzaMetrics = {
  sold: 0,
  failures: 0,
  revenue: 0,
  latency: 0,
};

function requestTracker(req, res, next) {
  if (httpRequests[req.method] !== undefined) {
    httpRequests[req.method]++;
  }
  if (req.user && req.user.id) {
    activeUsers.add(req.user.id);
  }

  next();
}

function authAttempt(success) {
  if (success) {
    authMetrics.success++;
  } else {
    authMetrics.failure++;
  }
}

function pizzaPurchase(success, latency, price) {
  if (success) {
    pizzaMetrics.sold++;
    pizzaMetrics.revenue += price;
  } else {
    pizzaMetrics.failures++;
  }
  pizzaMetrics.latency += latency;
}

function getCpuUsage() {
  const load = os.loadavg()[0];
  const cores = os.cpus().length;
  return ((load / cores) * 100).toFixed(2);
}

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return ((used / total) * 100).toFixed(2);
}

function sendMetricToGrafana(metricName, metricValue, type, unit) {
  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      asInt: Math.floor(metricValue),
                      timeUnixNano: Date.now() * 1000000,
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
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality =
      'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
  }
  const body = JSON.stringify(metric);
  fetch(config.metrics.endpointUrl, {
    method: 'POST',
    body: body,
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      'Content-Type': 'application/json',
    },
  })
    .then((res) => {
      if (!res.ok) {
        res.text().then((text) => {
          console.error(`Metric push failed: ${text}`);
        });
      }
    })
    .catch((err) => {
      console.error('Metric error:', err);
    });
}
function sendAllMetrics() {
  try {
    for (const method in httpRequests) {
      sendMetricToGrafana(
        `http_${method.toLowerCase()}`,
        httpRequests[method],
        'sum',
        '1'
      );
    }
    sendMetricToGrafana('auth_success', authMetrics.success, 'sum', '1');
    sendMetricToGrafana('auth_failure', authMetrics.failure, 'sum', '1');
    sendMetricToGrafana('active_users', activeUsers.size, 'gauge', '1');
    sendMetricToGrafana('cpu', getCpuUsage(), 'gauge', '%');
    sendMetricToGrafana('memory', getMemoryUsage(), 'gauge', '%');
    sendMetricToGrafana('pizza_sold', pizzaMetrics.sold, 'sum', '1');
    sendMetricToGrafana('pizza_failures', pizzaMetrics.failures, 'sum', '1');
    sendMetricToGrafana('pizza_revenue', pizzaMetrics.revenue, 'sum', 'usd');
    sendMetricToGrafana('pizza_latency', pizzaMetrics.latency, 'sum', 'ms');
  } catch (err) {
    console.error('Error sending metrics batch:', err);
  }
}

function start(period = 5000) {
  setInterval(sendAllMetrics, period);
}

module.exports = {
  requestTracker,
  authAttempt,
  pizzaPurchase,
  start,
};