# Security Configuration Guide

This document provides essential security configurations for deploying the EPA Compliance Dashboard.

## Pre-Deployment Checklist

### 1. Environment Variables (CRITICAL)

Before deploying, ensure the following variables are configured:

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output example: a3f8b9c2d4e1f6g7h8i9j0k1l2m3n4o5...

# Export the secret
export JWT_SECRET="a3f8b9c2d4e1f6g7h8i9j0k1l2m3n4o5"

# Generate a secure admin password
# Use a password manager or generate with:
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
# Then manually add uppercase, numbers, and special characters
# Example: X7nP@k9mL4vQr2sT

export ADMIN_PASSWORD="X7nP@k9mL4vQr2sT"
export NODE_ENV="production"
export CORS_ORIGIN="https://yourdomain.com,https://app.yourdomain.com"
```

### 2. HTTPS/TLS Configuration

**Required for Production:**

```nginx
# Nginx example
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Certificates - use Let's Encrypt (free)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 3. Database Security

**MongoDB Production Setup:**

```bash
# Use MongoDB Atlas with:
# - Network Access: IP whitelist
# - Encryption: Enable TLS
# - Authentication: Strong username/password
# - Backup: Enable automated backups

# Connection string format (from MongoDB Atlas):
MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority&ssl=true"
```

### 4. File Upload Security

The application now stores uploads in a secure directory outside the web root:

```bash
# Directory structure
/app/
  ├── api/
  │   └── ...
  └── ..
├── secure-uploads/  # Files stored here (NOT publicly accessible)
└── ...
```

All file access is authenticated and authorized through the API.

### 5. Rate Limiting

The application implements intelligent rate limiting:

- **Failed Logins:** 3 attempts per 15 minutes per IP
- **Registration:** 5 attempts per hour per IP
- **General API:** 100 requests per minute per IP
- **Exponential Backoff:** Repeated violations trigger longer lockouts

### 6. Password Policy

All user passwords must meet requirements:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)
- No common patterns (password, 12345, qwerty, etc.)

### 7. Account Lockout

Accounts temporarily lock after 5 failed login attempts for 30 minutes.

To unlock an account manually:

```javascript
// In Node.js shell or script
const User = require('./path/to/User');
await User.updateOne(
  { email: 'user@example.com' },
  { 
    lockedUntil: null,
    failedLoginAttempts: 0,
    failedLoginAttemptsResetAt: null
  }
);
```

### 8. Security Headers

The application automatically sets comprehensive security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
```

### 9. CORS Policy

Only explicitly whitelisted domains can access the API:

```javascript
// Set CORS_ORIGIN in production to:
CORS_ORIGIN="https://yourdomain.com,https://app.yourdomain.com"
```

Never include:
- localhost or 127.0.0.1 (development only)
- `*` (wildcard)
- Public tunneling services (pinggy, ngrok, etc.)

### 10. Audit Logging

All security events are logged:
- Failed login attempts
- Account lockouts
- Unauthorized access attempts
- File downloads
- Password changes
- Data exports

View logs:
```bash
# In MongoDB
db.auditlogs.find({ severity: 'critical' })
```

## Deployment Steps

### 1. Setup Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB (or use MongoDB Atlas)
sudo apt install -y mongodb

# Create application user
sudo useradd -m -s /bin/bash epacompliance

# Create directories
sudo mkdir -p /var/www/epa-compliance
sudo mkdir -p /var/epa-compliance/secure-uploads
sudo chown -R epacompliance:epacompliance /var/www/epa-compliance
sudo chown -R epacompliance:epacompliance /var/epa-compliance
```

### 2. Deploy Application

```bash
cd /var/www/epa-compliance

# Clone repository
git clone <your-repo-url> .

# Install dependencies
npm install

# Setup environment file
cp .env.example .env
# Edit .env with production values
nano .env

# Build the application
npm run build

# Create systemd service
sudo tee /etc/systemd/system/epa-compliance.service > /dev/null <<EOF
[Unit]
Description=EPA Compliance Dashboard
After=network.target

[Service]
Type=simple
User=epacompliance
WorkingDirectory=/var/www/epa-compliance
ExecStart=/usr/bin/node apps/api/src/main.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"
EnvironmentFile=/var/www/epa-compliance/.env

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable epa-compliance
sudo systemctl start epa-compliance

# View logs
sudo journalctl -u epa-compliance -f
```

### 3. Setup SSL Certificate

```bash
# Install Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --nginx -d yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 4. Configure Firewall

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
```

### 5. Backup Strategy

```bash
# Backup MongoDB
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/db"

# Backup uploaded files
sudo tar -czf /backups/epa-compliance-uploads.tar.gz /var/epa-compliance/secure-uploads/

# Schedule with cron (daily at 2 AM)
0 2 * * * /path/to/backup-script.sh
```

## Security Monitoring

### Key Metrics to Monitor

1. **Failed Login Attempts:** Alert if > 10 in 1 hour per IP
2. **Account Lockouts:** Alert if user account locked
3. **API Errors:** Monitor 500 errors
4. **Rate Limit Violations:** Track 429 responses
5. **Unauthorized Access:** Log all 403 responses

### Example Monitoring Query

```javascript
// MongoDB - Check for suspicious activity
db.auditlogs.find({
  severity: 'critical',
  timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
}).sort({ timestamp: -1 })
```

## Incident Response

### Account Compromise

```bash
# Reset compromised user password
1. Use admin account
2. Go to Users management
3. Click "Reset Password"
4. Send temporary password to verified email
5. Audit login history of compromised account
```

### Unauthorized Access

```bash
# Review audit logs
1. Check failed login attempts patterns
2. Identify unauthorized IP addresses
3. Block suspicious IPs at firewall level
4. Reset affected user passwords
5. Review data access logs
```

### Suspected Data Breach

```bash
# Immediate actions:
1. Backup all data
2. Review audit logs for data exports
3. Check for unauthorized API access
4. Audit file downloads
5. Audit user permission changes
6. Notify affected users if necessary
```

## Regular Maintenance

- [ ] Monthly: Review security audit logs
- [ ] Monthly: Update dependencies (`npm audit fix`)
- [ ] Quarterly: Security penetration test
- [ ] Quarterly: Backup testing and recovery drill
- [ ] Quarterly: Review and update CORS allowed origins
- [ ] Bi-annually: External security audit
- [ ] Annually: Security training for administrators

## Additional Resources

- OWASP Top 10: https://owasp.org/Top10/
- Node.js Security Best Practices: https://nodejs.org/en/docs/guides/security/
- Express.js Security: https://expressjs.com/en/advanced/best-practice-security.html
- MongoDB Security: https://docs.mongodb.com/manual/security/

## Support

For security issues, contact: security@yourdomain.com
