const express = require('express');
const bcrypt = require('bcryptjs');
const Database = require('../utils/database');
const authTokens = require('../utils/authTokens');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }

  let db;
  try {
    db = new Database();
    const user = await db.get(
      'SELECT id, password_hash FROM users WHERE username = ?',
      [username.trim()]
    );

    if (!user) {
      await db.close();
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      await db.close();
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    await db.close();

    const token = authTokens.createToken(user.id);
    res.json({
      success: true,
      data: {
        token
      }
    });
  } catch (error) {
    console.error('Error during login:', error);

    if (db) {
      try {
        await db.close();
      } catch (closeErr) {
        console.error('Failed to close database after login error:', closeErr);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
});

router.post('/logout', (req, res) => {
  const token =
    (req.headers.authorization && req.headers.authorization.replace('Bearer ', '').trim()) ||
    (req.headers['x-auth-token'] && String(req.headers['x-auth-token']).trim());

  if (token) {
    authTokens.revokeToken(token);
  }

  res.json({
    success: true,
    message: 'Logged out'
  });
});

module.exports = router;


