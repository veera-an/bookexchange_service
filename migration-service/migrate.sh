#!/bin/bash
set -e

echo "=== Migration Service: waiting for databases ==="

# Wait for user-db
until pg_isready -h user-db -U userservice -d userdb; do
  echo "Waiting for user-db..."
  sleep 2
done

# Wait for book-db
until pg_isready -h book-db -U bookservice -d bookdb; do
  echo "Waiting for book-db..."
  sleep 2
done

# Wait for exchange-db
until pg_isready -h exchange-db -U exchangeservice -d exchangedb; do
  echo "Waiting for exchange-db..."
  sleep 2
done

echo "All databases ready. Running migrations..."

# User DB migrations
PGPASSWORD=userservice psql -h user-db -U userservice -d userdb \
  -f /migrations/01_init_users_table.sql
PGPASSWORD=userservice psql -h user-db -U userservice -d userdb \
  -f /migrations/05_init_user_events_table.sql

# Book DB migrations
PGPASSWORD=bookservice psql -h book-db -U bookservice -d bookdb \
  -f /migrations/02_init_books_table.sql
PGPASSWORD=bookservice psql -h book-db -U bookservice -d bookdb \
  -f /migrations/03_init_events_table.sql

# Exchange DB migrations
PGPASSWORD=exchangeservice psql -h exchange-db -U exchangeservice -d exchangedb \
  -f /migrations/04_init_trades_table.sql

echo "=== All migrations completed successfully ==="
