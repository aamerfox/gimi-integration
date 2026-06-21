#!/bin/bash
# init-letsencrypt.sh: Bootstraps Let's Encrypt certificates for traceplus

domains=("tag.traceplus.co")
rsa_key_size=4096
data_path="./certbot"
email="admin@traceplus.co" # Adding a valid address is strongly recommended
staging=0 # Set to 1 if you're testing to avoid hitting request limits, set to 0 for production

if [ -d "$data_path" ]; then
  read -p "Existing data found for ${domains[0]}. Continue and replace existing certificates? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

# Ensure options-ssl-nginx.conf and ssl-dhparams.pem are downloaded (if they don't exist)
if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
fi

echo "### Creating dummy certificate for ${domains[0]}..."
path="/etc/letsencrypt/live/${domains[0]}"
mkdir -p "$data_path/conf/live/${domains[0]}"
docker-compose run --rm --entrypoint \
  "openssl req -x509 -nodes -newkey rsa:2048 -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot

# Create a temporary self-signed cert in ./certs so Nginx can start
echo "### Creating temporary self-signed cert in ./certs..."
mkdir -p ./certs
cp "$data_path/conf/live/${domains[0]}/fullchain.pem" "./certs/server.crt"
cp "$data_path/conf/live/${domains[0]}/privkey.pem" "./certs/server.key"

echo "### Starting nginx..."
docker-compose up --build -d tracking-app consumer-app

echo "### Deleting dummy certificate for ${domains[0]}..."
docker-compose run --rm --entrypoint \
  "rm -Rf /etc/letsencrypt/live/${domains[0]} && \
   rm -Rf /etc/letsencrypt/archive/${domains[0]} && \
   rm -Rf /etc/letsencrypt/renewal/${domains[0]}.conf" certbot

echo "### Requesting Let's Encrypt certificate for ${domains[0]}..."
# Join domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
email_arg="--register-unsafely-without-email"
if [ -n "$email" ]; then
  email_arg="--email $email --no-eff-email"
fi

# Enable staging mode if needed
if [ $staging -ne 0 ]; then staging_arg="--staging"; fi

docker-compose run --rm --entrypoint \
  "certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $domain_args \
    $email_arg \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot

echo "### Copying Let's Encrypt certificates to ./certs/..."
cp "$data_path/conf/live/${domains[0]}/fullchain.pem" "./certs/server.crt"
cp "$data_path/conf/live/${domains[0]}/privkey.pem" "./certs/server.key"

echo "### Reloading nginx..."
docker-compose exec tracking-app nginx -s reload
docker-compose exec consumer-app nginx -s reload

echo "### Let's Encrypt SSL Setup completed successfully!"
