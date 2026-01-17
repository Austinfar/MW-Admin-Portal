#!/bin/bash
export SUPABASE_ACCESS_TOKEN=sbp_c7b71b70a6b64e8357cb64e51076475e5be76677
# Password 'Buddies97!' encoded: ! -> %21
DB_URL="postgresql://postgres:Buddies97%21@db.hkggposusaipksreyafk.supabase.co:5432/postgres"

# List of missing migrations to revert
MIGRATIONS=(
"20260115191555"
"20260115200550"
"20260115201142"
"20260115224602"
"20260116155932"
"20260116160548"
"20260116173558"
"20260116175202"
"20260116202524"
"20260117041032"
"20260117045612"
)

echo "Repairing migration history..."

for VERSION in "${MIGRATIONS[@]}"; do
  echo "Reverting $VERSION..."
  npx supabase migration repair --status reverted "$VERSION" --db-url "$DB_URL"
done

echo "Repair complete. Attempting db push..."
npx supabase db push --db-url "$DB_URL"
