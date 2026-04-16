const express = require('express');
const config = require('../config.js');
const { DB } = require('../database/database.js');
const { authRouter } = require('./authRouter.js');
const { asyncHandler } = require('../endpointHelper.js');
const metrics = require('../metrics');
const logger = require('../logger');
const orderRouter = express.Router();

orderRouter.post(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const orderReq = req.body;
    logger.log("factory", "factory_request", orderReq);
    const start = Date.now();
    const order = await DB.addDinerOrder(req.user, orderReq);
    const r = await fetch(`${config.factory.url}/api/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${config.factory.apiKey}`,
      },
      body: JSON.stringify({
        diner: { id: req.user.id, name: req.user.name, email: req.user.email },
        order,
      }),
    });
    const j = await r.json();
    const latency = Date.now() - start;
    logger.log("factory", "factory_response", {
      status: r.status,
      body: j,
      latency,
    });
    if (r.ok) {
      const totalPrice = order.items.reduce((sum, item) => sum + item.price, 0);
      metrics.pizzaPurchase(true, latency, totalPrice);
      return res.send({
        order,
        followLinkToEndChaos: j.reportUrl,
        jwt: j.jwt,
      });
    } else {
      metrics.pizzaPurchase(false, latency, 0);
      return res.status(500).send({
        message: 'Failed to fulfill order at factory',
        followLinkToEndChaos: j.reportUrl,
      });
    }
  })
);

module.exports = orderRouter;