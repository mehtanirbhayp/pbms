const { v4: uuidv4 } = require('uuid');

class AuthTokenStore {
  constructor() {
    this.tokens = new Map();
    this.ttlMs = 24 * 60 * 60 * 1000; // 24 hours
  }

  createToken(userId) {
    const token = uuidv4();
    const expiresAt = Date.now() + this.ttlMs;
    this.tokens.set(token, { userId, expiresAt });
    return token;
  }

  validateToken(token) {
    if (!token) {
      return null;
    }

    const record = this.tokens.get(token);
    if (!record) {
      return null;
    }

    if (record.expiresAt < Date.now()) {
      this.tokens.delete(token);
      return null;
    }

    return record.userId;
  }

  revokeToken(token) {
    this.tokens.delete(token);
  }
}

module.exports = new AuthTokenStore();

