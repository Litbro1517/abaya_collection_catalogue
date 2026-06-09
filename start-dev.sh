#!/bin/bash
export DATABASE_URL="postgresql://postgres.ldvbfsnqgulynwxqwzau:3sHLmkVWQsvbJPTY@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
export DIRECT_URL="postgresql://postgres.ldvbfsnqgulynwxqwzau:3sHLmkVWQsvbJPTY@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
cd /home/z/my-project
exec bun run dev
