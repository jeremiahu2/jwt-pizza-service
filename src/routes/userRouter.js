const express = require('express');
const { asyncHandler } = require('../endpointHelper.js');
const { DB } = require('../database/database.js');
const { authRouter, setAuth } = require('./authRouter.js');
const userRouter = express.Router();

function isAdmin(user) {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.some(r => r?.role?.toLowerCase() === 'admin');
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
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: 'forbidden' });
    }
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const nameFilter = req.query.name || '*';
    const users = await DB.listUsers(page + 1, limit, nameFilter);
    res.status(200).json({ users });
  })
);

userRouter.put(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const { name, email, password, roles } = req.body;
    const userId = Number(req.params.userId);
    if (Number(req.user.id) !== userId && !isAdmin(req.user))
      return res.status(403).json({ message: 'unauthorized' });
    const updatedUser = await DB.updateUser(userId, name, email, password, roles || []);
    const auth = await setAuth(updatedUser);
    res.status(200).json({ user: updatedUser, token: auth });
  })
);

userRouter.delete(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      console.log("DELETE hit");
      console.log("Params:", req.params);
      console.log("User:", req.user);
      if (!isAdmin(req.user)) {
        return res.status(403).json({ message: 'forbidden' });
      }
      await DB.deleteUser(Number(req.params.userId));
      res.status(200).json({ message: 'user deleted' });
    } catch (err) {
      console.error("DELETE ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  })
);

userRouter.docs = [
  {
    method: 'GET',
    path: '/api/user?page=1&limit=10&name=*',
    requiresAuth: true,
    description: 'Gets a list of users',
    response: {
      users: [
        {
          id: 1,
          name: '常用名字',
          email: 'a@jwt.com',
          roles: [{ role: 'admin' }],
        },
      ],
    },
  },
];

module.exports = userRouter;