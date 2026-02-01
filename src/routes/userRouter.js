const express = require('express');
const { asyncHandler } = require('../endpointHelper.js');
const { DB } = require('../database/database.js');
const { authRouter, setAuth } = require('./authRouter.js');
const userRouter = express.Router();

function isAdmin(user) {
  const roles = user.roles || [];
  return roles.map(r => r.toLowerCase()).includes('admin');
}

userRouter.get(
  '/me',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    res.status(200).json({ user: req.user });
  })
);

userRouter.get(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'forbidden' });
    const users = await DB.listUsers();
    res.status(200).json({ users });
  })
);

userRouter.put(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const { name, email, password, roles } = req.body;
    const userId = Number(req.params.userId);
    if (req.user.id !== userId && !isAdmin(req.user)) return res.status(403).json({ message: 'unauthorized' });
    const updatedUser = await DB.updateUser(userId, name, email, password, roles || []);
    const auth = await setAuth(updatedUser);
    res.status(200).json({ user: updatedUser, token: auth });
  })
);

userRouter.delete(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'forbidden' });
    await DB.deleteUser(Number(req.params.userId));
    res.status(200).json({ message: 'user deleted' });
  })
);

module.exports = userRouter;
