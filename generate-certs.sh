#!/bin/bash
set -e

# Get current script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CERTS_DIR="$DIR/certs"

# Create certs directory if not exists
if [ ! -d "$CERTS_DIR" ]; then
    mkdir -p "$CERTS_DIR"
    echo "Created $CERTS_DIR directory."
fi

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "Error: openssl could not be found. Please install openssl and try again."
    exit 1
fi

echo "Generating self-signed SSL certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/C=US/ST=State/L=City/O=TracePlus/OU=Development/CN=tag.traceplus.co"

echo "Successfully generated certificate and key in $CERTS_DIR!"
echo "Key: $CERTS_DIR/server.key"
echo "Cert: $CERTS_DIR/server.crt"
