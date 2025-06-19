#!/bin/sh
set -e

export PGPASSWORD=test

psql -h localhost -p 5433 -U test -d bookservicetest -f book-service/init_events_table.sql
psql -h localhost -p 5433 -U test -d bookservicetest -f book-service/init_books_table.sql