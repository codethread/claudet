#!/usr/bin/env bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Generating self-signed certificates for HTTPS testing${NC}\n"

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo -e "${RED}❌ mkcert is not installed${NC}"
    echo -e "${YELLOW}Please install mkcert first:${NC}"
    echo "  macOS:   brew install mkcert"
    echo "  Linux:   See https://github.com/FiloSottile/mkcert#installation"
    echo "  Windows: choco install mkcert"
    exit 1
fi

# Get the project root directory (parent of scripts/)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTS_DIR="$PROJECT_ROOT/certs"

echo "📁 Certificate directory: $CERTS_DIR"

# Create certs directory if it doesn't exist
mkdir -p "$CERTS_DIR"

# Change to certs directory
cd "$CERTS_DIR"

# Install local CA if not already done
echo -e "\n${YELLOW}📋 Installing local CA (may require sudo password)${NC}"
# Filter out Java keytool warning (not needed for web development)
mkcert -install 2>&1 | grep -v "keytool"

# Generate certificates for localhost and local network access
echo -e "\n${GREEN}🔨 Generating certificates...${NC}"
mkcert localhost 127.0.0.1 ::1 0.0.0.0

echo -e "\n${GREEN}✅ Certificates generated successfully!${NC}"
echo -e "\nGenerated files:"
ls -lh "$CERTS_DIR"

echo -e "\n${GREEN}🎉 Done! Your HTTPS development server is ready to use.${NC}"
