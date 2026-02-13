#!/bin/bash
# EPA Compliance Dashboard - Production Environment Setup Script
# Run this script to generate required production secrets and create .env file
# Usage: bash setup-prod-env.sh

set -e

echo "=============================================="
echo "EPA Compliance Dashboard - Production Setup"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Generate JWT Secret
echo "🔐 Generating JWT Secret (256-bit hex)..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo -e "${GREEN}JWT_SECRET: $JWT_SECRET${NC}"
echo ""

# Generate secure admin password
echo "🔐 Generating secure admin password..."
echo "⚠️  You should replace this with your own secure password"
echo "Password Requirements:"
echo "  - At least 12 characters"
echo "  - Uppercase letters: A-Z"
echo "  - Lowercase letters: a-z"
echo "  - Numbers: 0-9"
echo "  - Special characters: !@#\$%^&*()"
echo ""
read -p "Enter secure admin password (or press Enter for suggested): " ADMIN_PASSWORD
if [ -z "$ADMIN_PASSWORD" ]; then
    # Generate a reasonable password
    ADMIN_PASSWORD="Prod$(date +%s | tail -c 6)!Admin"
    echo -e "${GREEN}Generated password: $ADMIN_PASSWORD${NC}"
else
    echo -e "${GREEN}Using provided password${NC}"
fi
echo ""

# Get domain
echo "🌐 Enter your production domain (e.g., yourdomain.com):"
read -p "Domain: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Domain is required${NC}"
    exit 1
fi

CORS_ORIGIN="https://$DOMAIN,https://app.$DOMAIN"
APP_BASE_URL="https://app.$DOMAIN"
PUBLIC_BASE_URL="https://api.$DOMAIN"

echo ""
echo "📧 Email Configuration (Optional - leave blank to disable)"
read -p "SMTP Host (e.g., smtp.gmail.com): " SMTP_HOST
read -p "SMTP Port (default: 587): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}
read -p "SMTP Username/Email: " SMTP_USER
read -sp "SMTP Password: " SMTP_PASS
echo ""
read -p "Sender Email (e.g., noreply@$DOMAIN): " SMTP_FROM
SMTP_FROM=${SMTP_FROM:-"noreply@$DOMAIN"}
read -p "SMTP Secure (true/false, default: true): " SMTP_SECURE
SMTP_SECURE=${SMTP_SECURE:-true}

echo ""
echo "📦 MongoDB Configuration"
echo "For MongoDB Atlas, use format: mongodb+srv://user:password@cluster.mongodb.net/database?retryWrites=true&w=majority"
read -p "MongoDB URI: " MONGO_URI

if [ -z "$MONGO_URI" ]; then
    MONGO_URI="mongodb://localhost:27017/punjab_compliance"
    echo -e "${YELLOW}Using default localhost MongoDB${NC}"
fi

echo ""
echo "📝 Admin User Configuration"
read -p "Admin Email: " ADMIN_EMAIL
read -p "Admin Name: " ADMIN_NAME
read -p "Admin CNIC: " ADMIN_CNIC

# Create .env file
ENV_FILE="apps/api/.env"
echo ""
echo "📄 Creating $ENV_FILE..."

cat > "$ENV_FILE" << EOF
# EPA Compliance Dashboard - Production Configuration
# Generated: $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# Environment
NODE_ENV=production

# Server
PORT=4000

# Database
MONGO_URI=$MONGO_URI

# Security - JWT
JWT_SECRET=$JWT_SECRET

# Security - Admin User
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_NAME=$ADMIN_NAME
ADMIN_CNIC=$ADMIN_CNIC

# CORS - Strict whitelist
CORS_ORIGIN=$CORS_ORIGIN

# Public URLs
PUBLIC_BASE_URL=$PUBLIC_BASE_URL
APP_BASE_URL=$APP_BASE_URL

# File Upload
UPLOAD_DIR=./uploads
SECURE_UPLOADS_DIR=../secure-uploads

# Email Configuration
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=$SMTP_SECURE
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
EOF

echo -e "${GREEN}✓ .env file created${NC}"
echo ""

# Set file permissions
chmod 600 "$ENV_FILE"
echo -e "${GREEN}✓ Set secure permissions (600) on .env file${NC}"
echo ""

# Create summary file
SUMMARY_FILE=".env.production.summary"
cat > "$SUMMARY_FILE" << EOF
# EPA Compliance Dashboard - Production Setup Summary
# Generated: $(date)

## Critical Configuration Values

JWT_SECRET: $JWT_SECRET
ADMIN_PASSWORD: $ADMIN_PASSWORD
DOMAIN: $DOMAIN
CORS_ORIGIN: $CORS_ORIGIN

## Next Steps

### 1. Backup Configuration
NEVER commit the .env file to version control!
Backup this file securely:
  - Store in a secrets manager (AWS Secrets Manager, Vault, etc.)
  - Or encrypt and store in secure location
  - Or provide via environment variables to deployment system

### 2. HTTPS Setup
Configure HTTPS on your reverse proxy (Nginx/Apache):
  - Obtain SSL certificate from Let's Encrypt (free)
  - Configure to proxy to http://localhost:4000
  - Add HSTS header configuration

### 3. Database Setup
If using MongoDB Atlas:
  - Enable network access for your server IP
  - Enable encrypted connections (TLS)
  - Enable automatic backups
  - Use strong username/password

### 4. File System Setup
Create secure uploads directory:
  sudo mkdir -p /var/epa-compliance/secure-uploads
  sudo chmod 700 /var/epa-compliance/secure-uploads

### 5. Start Application
npm install
npm run build
NODE_ENV=production node apps/api/src/main.js

### 6. Verify Setup
Test login with admin credentials:
  Email: $ADMIN_EMAIL
  Password: $ADMIN_PASSWORD

### 7. Monitor Logs
Monitor audit logs and security events
Check for any startup errors or warnings

## Security Checklist

☐ JWT_SECRET is unique and at least 32 characters
☐ ADMIN_PASSWORD is secure and changed after first login
☐ CORS_ORIGIN contains ONLY your production domains
☐ MONGO_URI uses TLS connection
☐ Email credentials are secure
☐ .env file is NOT committed to version control
☐ HTTPS/TLS certificates installed
☐ Firewall configured (only ports 80, 443, 22)
☐ Database backups configured
☐ Monitoring and alerts configured
☐ File uploads directory outside web root
☐ All dependencies updated

## Security Notes

- Change ADMIN_PASSWORD immediately after first login
- Never share JWT_SECRET or ADMIN_PASSWORD
- Rotate JWT_SECRET and passwords regularly
- Keep dependencies updated: npm audit fix
- Review audit logs weekly
- Test backups monthly
- Consider 2FA for admin accounts
- Monitor failed login attempts
- Block suspicious IPs at firewall level

## Support

For issues or questions, see:
- SECURITY_SETUP.md - Detailed deployment guide
- SECURITY_ANALYSIS_REPORT.md - Security findings
- SECURITY_FIXES_SUMMARY.md - Fix implementation details
EOF

echo -e "${GREEN}✓ Configuration summary saved to $SUMMARY_FILE${NC}"
echo ""
echo "=============================================="
echo -e "${GREEN}✓ Production environment setup complete!${NC}"
echo "=============================================="
echo ""
echo "IMPORTANT: Save these credentials securely:"
echo ""
echo "Domain: $DOMAIN"
echo "Admin Email: $ADMIN_EMAIL"
echo "JWT Secret: $JWT_SECRET"
echo "Admin Password: $ADMIN_PASSWORD"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Change admin password after first login${NC}"
echo -e "${YELLOW}⚠️  IMPORTANT: Never commit .env to version control${NC}"
echo -e "${YELLOW}⚠️  IMPORTANT: Store secrets in secure location${NC}"
echo ""
echo "See $SUMMARY_FILE for next steps"
