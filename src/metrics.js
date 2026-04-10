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
  lastLatency: 0,
  lastRevenue: 0,
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
    pizzaMetrics.lastRevenue = price;
  } else {
    pizzaMetrics.failures++;
    pizzaMetrics.lastRevenue = 0;
  }

  pizzaMetrics.lastLatency = latency;
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
    body,
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      'Content-Type': 'application/json',
    },
  }).catch(() => {});
}

function sendAllMetrics() {
  for (const method in httpRequests) {
    sendMetricToGrafana(`http_${method.toLowerCase()}`, httpRequests[method], 'sum', '1');
  }

  sendMetricToGrafana('auth_success', authMetrics.success, 'sum', '1');
  sendMetricToGrafana('auth_failure', authMetrics.failure, 'sum', '1');

  sendMetricToGrafana('active_users', activeUsers.size, 'gauge', '1');

  sendMetricToGrafana('cpu_percent', getCpuUsage(), 'gauge', '%');
  sendMetricToGrafana('memory_percent', getMemoryUsage(), 'gauge', '%');

  sendMetricToGrafana('pizza_sold', pizzaMetrics.sold, 'sum', '1');
  sendMetricToGrafana('pizza_failures', pizzaMetrics.failures, 'sum', '1');

  sendMetricToGrafana('pizza_revenue', pizzaMetrics.lastRevenue, 'gauge', 'usd');
  sendMetricToGrafana('pizza_latency', pizzaMetrics.lastLatency, 'gauge', 'ms');

  httpRequests = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
  authMetrics = { success: 0, failure: 0 };
  pizzaMetrics.sold = 0;
  pizzaMetrics.failures = 0;
  pizzaMetrics.revenue = 0;
  console.log('sending metrics batch');
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