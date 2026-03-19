const os = require('os');
const fetch = require('node-fetch');

class Metrics {
  constructor(config) {
    this.config = config;
    this.httpMetrics = {
      totalRequests: 0,
      getRequests: 0,
      postRequests: 0,
      putRequests: 0,
      deleteRequests: 0,
    };
    this.authMetrics = {
      successfulAttempts: 0,
      failedAttempts: 0,
    };
    this.userMetrics = {
      activeUsers: new Set(),
    };
    this.purchaseMetrics = {
      pizzasSold: 0,
      creationFailures: 0,
      totalRevenue: 0,
      latencies: [],
    };
  }

  requestTracker = (req, res, next) => {
    this.httpMetrics.totalRequests++;
    const method = req.method.toUpperCase();
    switch (method) {
      case 'GET':
        this.httpMetrics.getRequests++;
        break;
      case 'POST':
        this.httpMetrics.postRequests++;
        break;
      case 'PUT':
        this.httpMetrics.putRequests++;
        break;
      case 'DELETE':
        this.httpMetrics.deleteRequests++;
        break;
    }
    if (req.user && req.user.id) {
      this.userMetrics.activeUsers.add(req.user.id);
    }
    next();
  };

  trackAuthAttempt(success) {
    if (success) {
      this.authMetrics.successfulAttempts++;
    } else {
      this.authMetrics.failedAttempts++;
    }
  }

  pizzaPurchase(success, latency, price) {
    if (success) {
      this.purchaseMetrics.pizzasSold++;
      this.purchaseMetrics.totalRevenue += price;
    } else {
      this.purchaseMetrics.creationFailures++;
    }
    this.purchaseMetrics.latencies.push(latency);
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return parseFloat((cpuUsage * 100).toFixed(2));
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(2);
    return parseFloat(memoryUsage);
  }

  buildMetricsPayload() {
    const now = Date.now();
    const timestamp = now * 1000000;
    const payload = {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.config.source },
              },
            ],
          },
          scopeMetrics: [
            {
              scope: { name: 'jwt-pizza-service' },
              metrics: [
                {
                  name: 'http_requests_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.httpMetrics.totalRequests,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'http_requests_get_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.httpMetrics.getRequests,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'http_requests_post_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.httpMetrics.postRequests,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'http_requests_put_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.httpMetrics.putRequests,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'http_requests_delete_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.httpMetrics.deleteRequests,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'auth_attempts_successful_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.authMetrics.successfulAttempts,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'auth_attempts_failed_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.authMetrics.failedAttempts,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'active_users',
                  type: 'Gauge',
                  dataPoints: [
                    {
                      value: this.userMetrics.activeUsers.size,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'process_cpu_usage_percent',
                  type: 'Gauge',
                  dataPoints: [
                    {
                      value: this.getCpuUsagePercentage(),
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'process_memory_usage_percent',
                  type: 'Gauge',
                  dataPoints: [
                    {
                      value: this.getMemoryUsagePercentage(),
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'pizzas_sold_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.purchaseMetrics.pizzasSold,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'pizza_creation_failures_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.purchaseMetrics.creationFailures,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'pizza_revenue_total',
                  type: 'Sum',
                  dataPoints: [
                    {
                      value: this.purchaseMetrics.totalRevenue,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
                {
                  name: 'pizza_creation_latency_seconds',
                  type: 'Gauge',
                  dataPoints: [
                    {
                      value:
                        this.purchaseMetrics.latencies.length > 0
                          ? this.purchaseMetrics.latencies.reduce((a, b) => a + b, 0) / this.purchaseMetrics.latencies.length / 1000
                          : 0,
                      timeUnixNano: timestamp,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    return payload;
  }

  async sendToGrafana() {
    if (!this.config.apiKey || !this.config.endpointUrl) {
      console.error('Metrics config missing apiKey or endpointUrl');
      return;
    }
    try {
      const payload = this.buildMetricsPayload();
      const response = await fetch(this.config.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-protobuf',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': 'jwt-pizza-service',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error(`Failed to send metrics to Grafana: ${response.status} ${response.statusText}`);
      } else {
        console.log('Metrics sent successfully to Grafana');
      }
    } catch (error) {
      console.error('Error sending metrics to Grafana:', error);
    }
  }

  startPeriodicReporting(interval = 60000) {
    console.log(`Starting periodic metrics reporting every ${interval}ms`);
    setInterval(async () => {
      try {
        await this.sendToGrafana();
        this.httpMetrics = {
          totalRequests: 0,
          getRequests: 0,
          postRequests: 0,
          putRequests: 0,
          deleteRequests: 0,
        };
        this.authMetrics = {
          successfulAttempts: 0,
          failedAttempts: 0,
        };
        this.purchaseMetrics = {
          pizzasSold: 0,
          creationFailures: 0,
          totalRevenue: 0,
          latencies: [],
        };
      } catch (error) {
        console.error('Error in periodic metrics reporting:', error);
      }
    }, interval);
  }
}

module.exports = Metrics;