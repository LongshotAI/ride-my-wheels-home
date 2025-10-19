#!/bin/sh
set -e

# Create runtime config file with environment variables
cat <<EOF > /usr/share/nginx/html/runtime-config.js
window.ENV = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_PUBLISHABLE_KEY: "${VITE_SUPABASE_PUBLISHABLE_KEY}",
  VITE_SUPABASE_PROJECT_ID: "${VITE_SUPABASE_PROJECT_ID}",
  VITE_GOOGLE_MAPS_API_KEY: "${VITE_GOOGLE_MAPS_API_KEY}"
};
EOF

echo "Runtime configuration generated successfully"

# Execute the CMD
exec "$@"
