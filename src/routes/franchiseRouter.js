const express = require('express');
const { DB } = require('../database/database.js');
const { authRouter } = require('./authRouter.js');
const { StatusCodeError, asyncHandler } = require('../endpointHelper.js');

const franchiseRouter = express.Router();

function isAdmin(user) {
  const roles = user.roles || [];
  return roles.map(r => r.toLowerCase()).includes('admin');
}

franchiseRouter.get(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const [franchises, more] = await DB.getFranchises(req.user, req.query.page, req.query.limit, req.query.name);
    res.status(200).json({ franchises, more });
  })
);

franchiseRouter.get(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    let result = [];
    if (req.user.id === userId || isAdmin(req.user)) {
      result = await DB.getUserFranchises(userId);
    }
    res.status(200).json(result);
  })
);

franchiseRouter.post(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!isAdmin(req.user)) throw new StatusCodeError('unable to create a franchise', 403);
    const franchise = { ...req.body };
    if (franchise.admins && Array.isArray(franchise.admins)) {
      franchise.admins = franchise.admins.map(a => (typeof a === 'number' ? { id: a } : a));
    } else {
      franchise.admins = [{ id: req.user.id }];
    }

    const created = await DB.createFranchise(franchise);
    res.status(200).json({ franchise: created });
  })
);

franchiseRouter.delete(
  '/:franchiseId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!isAdmin(req.user)) throw new StatusCodeError('unable to delete franchise', 403);
    const franchiseId = Number(req.params.franchiseId);
    await DB.deleteFranchise(franchiseId);
    res.status(200).json({ message: 'franchise deleted' });
  })
);

franchiseRouter.post(
  '/:franchiseId/store',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const franchiseId = Number(req.params.franchiseId);
    const franchise = await DB.getFranchise({ id: franchiseId });
    if (!franchise) throw new StatusCodeError('franchise not found', 404);
    if (!isAdmin(req.user) && !franchise.admins.some(a => a.id === req.user.id)) {
      throw new StatusCodeError('unable to create a store', 403);
    }
    const store = await DB.createStore(franchise.id, req.body);
    res.status(200).json(store);
  })
);

franchiseRouter.delete(
  '/:franchiseId/store/:storeId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const franchiseId = Number(req.params.franchiseId);
    const franchise = await DB.getFranchise({ id: franchiseId });
    if (!franchise) throw new StatusCodeError('franchise not found', 404);
    if (!isAdmin(req.user) && !franchise.admins.some(a => a.id === req.user.id)) {
      throw new StatusCodeError('unable to delete a store', 403);
    }
    const storeId = Number(req.params.storeId);
    await DB.deleteStore(franchiseId, storeId);
    res.status(200).json({ message: 'store deleted' });
  })
);

module.exports = franchiseRouter;