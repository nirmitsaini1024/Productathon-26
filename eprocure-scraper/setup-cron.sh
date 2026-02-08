#!/bin/bash

# Tender Scraper Cron Job Setup Script

set -e

echo "=================================="
echo "Tender Scraper Cron Setup"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file based on the template in the project."
    exit 1
fi

echo "✓ Found .env file"
echo ""

# Load environment variables
source .env 2>/dev/null || true

# Function to check if a variable is set
check_var() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ] || [[ "$var_value" == "your_"* ]] || [[ "$var_value" == "your-"* ]]; then
        echo -e "${RED}✗ $var_name is not configured${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $var_name is configured${NC}"
        return 0
    fi
}

echo "Checking required configuration..."
echo ""

# Track validation status
all_valid=true

# Check required variables
check_var "MONGO_URI" || all_valid=false
check_var "NOTIFICATION_EMAIL" || all_valid=false
check_var "NOTIFICATION_PHONE" || all_valid=false
check_var "RESEND_API_KEY" || all_valid=false
check_var "TWILIO_ACCOUNT_SID" || all_valid=false
check_var "TWILIO_AUTH_TOKEN" || all_valid=false

echo ""

# Check optional but important variables
echo "Checking optional configuration..."
echo ""

if [ -z "$CRON_SCHEDULE" ]; then
    echo -e "${YELLOW}⚠ CRON_SCHEDULE not set, using default: */30 * * * *${NC}"
fi

if [ -z "$TWILIO_WHATSAPP_CONTENT_SID" ]; then
    echo -e "${YELLOW}⚠ TWILIO_WHATSAPP_CONTENT_SID not set${NC}"
fi

echo ""

# Exit if any required variable is missing
if [ "$all_valid" = false ]; then
    echo -e "${RED}Configuration incomplete!${NC}"
    echo ""
    echo "Please update your .env file with the required values:"
    echo "  - NOTIFICATION_EMAIL: Your email address"
    echo "  - NOTIFICATION_PHONE: Your phone number (E.164 format, e.g., +919876543210)"
    echo "  - TWILIO_ACCOUNT_SID: Your Twilio Account SID"
    echo "  - TWILIO_AUTH_TOKEN: Your Twilio Auth Token"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ All required variables are configured!${NC}"
echo ""

# Test MongoDB connection
echo "Testing MongoDB connection..."
node -e "
import('mongoose').then(async mongoose => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ MongoDB connection successful');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  }
});
" || {
    echo -e "${RED}MongoDB connection test failed!${NC}"
    echo "Please check your MONGO_URI"
    exit 1
}

echo ""
echo -e "${GREEN}Setup validation complete!${NC}"
echo ""
echo "=================================="
echo "Next Steps:"
echo "=================================="
echo ""
echo "1. Start the cron job:"
echo "   npm run cron"
echo ""
echo "2. Or use PM2 (recommended for production):"
echo "   pm2 start ecosystem.config.cjs"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "3. Or install as systemd service:"
echo "   sudo cp tender-cron.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable tender-cron"
echo "   sudo systemctl start tender-cron"
echo ""
echo "For more information, see CRON_README.md"
echo ""
