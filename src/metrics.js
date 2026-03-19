const os = require('os');

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
    this.startTime = Date.now();
    this.lastReportTime = Date.now();
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
    return (cpuUsage * 100).toFixed(2);
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(2);
    return memoryUsage;
  }

  buildMetrics() {
    const now = Date.now();
    const timeSinceLastReport = now - this.lastReportTime;
    this.lastReportTime = now;

    const metrics = {
      timestamp: now,
      source: this.config.source,
      httpMetrics: {
        totalRequests: this.httpMetrics.totalRequests,
        getRequests: this.httpMetrics.getRequests,
        postRequests: this.httpMetrics.postRequests,
        putRequests: this.httpMetrics.putRequests,
        deleteRequests: this.httpMetrics.deleteRequests,
      },
      authMetrics: {
        successfulAttempts: this.authMetrics.successfulAttempts,
        failedAttempts: this.authMetrics.failedAttempts,
      },
      userMetrics: {
        activeUsers: this.userMetrics.activeUsers.size,
      },
      purchaseMetrics: {
        pizzasSold: this.purchaseMetrics.pizzasSold,
        creationFailures: this.purchaseMetrics.creationFailures,
        totalRevenue: this.purchaseMetrics.totalRevenue,
        avgLatency: this.purchaseMetrics.latencies.length > 0
          ? this.purchaseMetrics.latencies.reduce((a, b) => a + b, 0) / this.purchaseMetrics.latencies.length
          : 0,
      },
      systemMetrics: {
        cpuUsage: this.getCpuUsagePercentage(),
        memoryUsage: this.getMemoryUsagePercentage(),
      },
    };

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
    return metrics;
  }

  async sendToGrafana(metrics) {
    try {
      const response = await fetch(this.config.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(metrics),
      });

      if (!response.ok) {
        console.error('Failed to send metrics to Grafana:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending metrics to Grafana:', error);
    }
  }

  startPeriodicReporting(interval = 60000) {
    setInterval(async () => {
      try {
        const metrics = this.buildMetrics();
        await this.sendToGrafana(metrics);
      } catch (error) {
        console.error('Error in periodic metrics reporting:', error);
      }
    }, interval);
  }
}

module.exports = Metrics;