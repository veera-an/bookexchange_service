#!/bin/bash
set -e
# Wait for database to be ready
until pg_isready -h database-service -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "Waiting for database..."
  sleep 2
done
export PGPASSWORD="$POSTGRES_PASSWORD"
psql -h database-service -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/01_init_books_table.sql
psql -h database-service -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/02_init_events_table.sql
psql -h database-service -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/03_init_users_table.sql
