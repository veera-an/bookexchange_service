# Book Exchange Microservices Prototype

## Overview
This project is a prototype implementation of a containerized microservices architecture for a Book Exchange platform. It demonstrates both synchronous (REST/HTTP) and asynchronous (Pub/Sub) communication patterns, event sourcing, and the use of Docker Compose for orchestration and isolated networking.

## Services
- **user-service**: Manages user registration and profile updates (CRUD + event sourcing).
- **book-service**: Manages books (CRUD + event sourcing) and publishes BookAdded events to Redis Pub/Sub.
- **exchange-service**: Intended to coordinate book exchanges between users (orchestration logic placeholder).
- **notification-service**: Subscribes to BookAdded events from Redis and can be extended to send notifications.
- **user-interface**: React frontend for interacting with the Book Service and other APIs.
- **database-service**: PostgreSQL database for persistent storage.
- **redis**: Redis instance for Pub/Sub messaging.

## Communication Patterns
- **Request-Reply (REST/HTTP)**: Used for CRUD operations between frontend and backend services.
- **Publish-Subscribe (Redis Pub/Sub)**: Used for asynchronous event-driven communication (e.g., BookAdded events).

## Database
- **Event Sourcing**: All changes are stored as events in the `events` table.
- **Read Models**: `books` and `users` tables are maintained for efficient queries.
- **Migration scripts**: See `book-service/init_books_table.sql`, `book-service/init_events_table.sql`, and `user-service/init_users_table.sql`.

## Running the Project

1. **Build and start all services:**
   ```sh
   docker-compose up --build
   ```
   Or run in detached mode:
   ```sh
   docker-compose up -d --build
   ```

2. **Access the services:**
   - Book Service: http://localhost:5002/
   - User Service: http://localhost:5001/
   - User Interface: http://localhost:3000/

3. **Apply database migrations:**
   - Copy the migration SQL files into the database container and run them using psql, e.g.:
     ```sh
     docker cp book-service/init_books_table.sql bookexchange_service-database-service-1:/init_books_table.sql
     docker exec -it bookexchange_service-database-service-1 bash
     psql -U bookexchange -d bookexchange -f /init_books_table.sql
     # Repeat for other migration files as needed
     ```

