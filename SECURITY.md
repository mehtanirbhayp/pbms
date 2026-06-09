# Security Guide - Pawn Broker System

⚠️ **This application contains confidential financial data. Follow these security guidelines strictly.**

## 🔐 Critical Security Steps

### 1. Change Default Admin Password (REQUIRED)

**Default credentials:**
- Username: `admin`
- Password: `admin123`

**⚠️ CHANGE THIS IMMEDIATELY after deployment!**

1. Log in with default credentials
2. Go to user management (if available) or update directly in database
3. Set a strong password (minimum 12 characters, mix of letters, numbers, symbols)

### 2. Repository Privacy

- ✅ **ALWAYS use PRIVATE GitHub repositories**
- ✅ Never make the repository public
- ✅ Limit access to trusted team members only
- ✅ Review all commits before pushing (ensure no sensitive data)

### 3. Environment Variables

Never commit sensitive data. Use environment variables for:

- Database paths (if different)
- Secret keys (if you add JWT or session secrets)
- API keys (if you integrate external services)
- Admin credentials (if you add them as env vars)

### 4. Database Security

- ✅ Database file is in `.gitignore` (already configured)
- ✅ Database is stored locally on the server
- ✅ Regular backups recommended
- ⚠️ Consider encrypting sensitive customer data in the database

### 5. Network Security

#### Option A: IP Whitelisting (Recommended)

Restrict access to specific IP addresses:

1. **Enable IP whitelist middleware:**
   ```javascript
   // In server.js, add before routes:
   const ipWhitelist = require('./middleware/ipWhitelist');
   app.use(ipWhitelist);
   ```

2. **Set allowed IPs in environment:**
   ```
   ALLOWED_IPS=192.168.1.100,203.0.113.50
   ```

3. **Find your IP address:**
   - Visit: https://whatismyipaddress.com
   - Add your IP to `ALLOWED_IPS`

**Note:** This only works if you have static IP addresses. For dynamic IPs, consider VPN.

#### Option B: VPN Access

- Deploy application on private network
- Use VPN (Tailscale, ZeroTier, or corporate VPN) for access
- Only VPN users can access the application

#### Option C: Local Network Only

- Deploy on office/local network
- Access via local IP (e.g., `http://192.168.1.100:3000`)
- No external internet access = maximum security

### 6. HTTPS/SSL

All recommended hosting platforms provide automatic HTTPS:
- ✅ Render - Automatic HTTPS
- ✅ Railway - Automatic HTTPS
- ✅ Fly.io - Automatic HTTPS

**Never use HTTP in production!**

### 7. Authentication

Your application already has:
- ✅ Login system with password hashing (bcrypt)
- ✅ Token-based authentication
- ✅ Protected API routes

**Best practices:**
- Use strong passwords
- Don't share login credentials
- Log out when done
- Consider session timeout (currently 24 hours)

### 8. Regular Updates

- Keep dependencies updated:
  ```bash
  npm audit
  npm update
  ```
- Monitor for security vulnerabilities
- Update Node.js regularly

### 9. Backups

**Regular database backups are essential:**

```bash
# Manual backup
cp database/pawn_broker.db backups/pawn_broker_$(date +%Y%m%d).db

# Or use a backup script
```

**Backup schedule:**
- Daily backups for active systems
- Weekly backups for less active systems
- Store backups securely (encrypted, off-site)

### 10. Monitoring & Logging

- Monitor access logs regularly
- Check for suspicious activity
- Review failed login attempts
- Set up alerts for unusual patterns

## 🚨 Security Checklist

Before going live:

- [ ] Default admin password changed
- [ ] Strong password set (12+ characters)
- [ ] Repository is PRIVATE
- [ ] `.env` file is in `.gitignore`
- [ ] Database files are in `.gitignore`
- [ ] No credentials committed to git
- [ ] HTTPS enabled
- [ ] IP whitelisting configured (if applicable)
- [ ] Backup strategy in place
- [ ] Access limited to authorized users only

## 🔒 Additional Security Measures (Optional)

### Rate Limiting

Prevent brute force attacks:

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 requests per windowMs
});

app.use('/api/auth/login', limiter);
```

### Two-Factor Authentication (2FA)

Consider adding 2FA for additional security:
- Use libraries like `speakeasy` or `node-2fa`
- Require 2FA for admin accounts

### Data Encryption

For highly sensitive data:
- Encrypt sensitive fields in database
- Use libraries like `crypto` for encryption
- Store encryption keys securely (environment variables)

## 📞 Security Incident Response

If you suspect a security breach:

1. **Immediately change all passwords**
2. **Review access logs**
3. **Check for unauthorized data access**
4. **Revoke all active sessions**
5. **Notify affected users (if applicable)**
6. **Consider taking system offline temporarily**

## 🛡️ Compliance Considerations

For financial data, consider:
- Data retention policies
- User consent for data storage
- Right to deletion
- Audit trails
- Regular security audits

## 📚 Resources

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Node.js Security Best Practices: https://nodejs.org/en/docs/guides/security/
- Express Security: https://expressjs.com/en/advanced/best-practice-security.html

---

**Remember: Security is an ongoing process, not a one-time setup. Regularly review and update your security measures.**

