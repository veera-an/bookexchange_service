# Architecture Document: Distributed Book Exchange System

## 1. Project Overview
This application is a microservice-based platform where users can list books and exchange them with others. The system is designed to be resilient, scalable, and loosely coupled, following **Domain-Driven Design (DDD)** principles and the **Database-per-Service** pattern.

## 2. Technology Choices & Justifications

| Technology | Purpose | Why This Choice |
|---|---|---|
| **Node.js / Express** | Microservice runtime | Lightweight, non-blocking I/O ideal for microservices. Express provides minimal overhead and flexible routing. The same language across all services reduces cognitive load. |
| **PostgreSQL** | Database (per service) | ACID-compliant relational database. JSONB support enables event sourcing with structured event payloads. Mature tooling and strong consistency guarantees. |
| **RabbitMQ** | Message broker (Choreography) | Purpose-built for message queuing with durable exchanges, message acknowledgement, and dead-letter handling. More reliable than Redis pub/sub for event-driven architectures where message delivery guarantees matter. The management UI (port 15672) aids debugging. |
| **Nginx** | API Gateway | Industry-standard reverse proxy. Efficient at routing, load balancing, and serving as a single entry point. Configuration is declarative and well-documented. |
| **Docker / Docker Compose** | Containerization & orchestration | Enables reproducible deployments and network isolation between services. Each service runs in its own container with its own dependency tree. |
| **React** | Frontend UI | Component-based SPA framework. Allows dynamic interaction with multiple backend services through a single-page interface. |
| **Winston** | Structured logging | JSON-formatted logs with timestamps and service names enable cross-service traceability. Log levels (info, warn, error) allow filtering in production. |

## 3. Domain-Driven Design (Bounded Contexts)
The system is divided into three primary Bounded Contexts, each represented by a microservice:

*   **User Context (User Service):** Manages user identity and profiles. Owns the `users` and `events` tables in `user-db`.
*   **Inventory Context (Book Service):** Manages the collection of books available for trade. Owns the `books` and `events` tables in `book-db`.
*   **Exchange Context (Exchange Service):** The core business logic that orchestrates the workflow of a book swap between two users. Owns the `trades` and `events` tables in `exchange-db`.

Each bounded context has its own dedicated PostgreSQL database, ensuring **data isolation** — no service directly accesses another service's database.

## 4. System Architecture & Components

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway (Nginx)                      │
│                      localhost:80                             │
├──────────┬──────────┬──────────┬────────────────────────────┤
│ /users   │ /books   │ /trades  │ /                          │
│    │     │    │     │    │     │    │                        │
│    ▼     │    ▼     │    ▼     │    ▼                        │
│ User     │ Book     │Exchange  │ React UI                   │
│ Service  │ Service  │Service   │ :3000                      │
│ :5001    │ :5002    │ :5003    │                            │
│    │     │    │     │    │     │                            │
│    ▼     │    ▼     │    ▼     │                            │
│ user-db  │ book-db  │exchange- │                            │
│ :5433    │ :5434    │db :5435  │                            │
├──────────┴──────────┴──────────┴────────────────────────────┤
│                   RabbitMQ :5672 (AMQP)                      │
│                   Management UI :15672                        │
│  ┌─────────────┐              ┌──────────────────┐          │
│  │ book_events  │              │ exchange_events   │          │
│  │  (fanout)    │              │  (fanout)         │          │
│  └──────┬──────┘              └────────┬─────────┘          │
│         │                              │                     │
│         ▼                              ▼                     │
│  Notification Service          Book Service (subscriber)     │
│  (BOOK_CREATED listener)      (EXCHANGE_COMPLETED listener) │
└─────────────────────────────────────────────────────────────┘
```

*   **Frontend (UI):** A React-based single-page application (port 3000).
*   **API Gateway (Nginx):** Reverse proxy on port 80, routes to backend services by URL path.
*   **Microservices:** Three Node.js/Express services, each with its own database.
*   **Databases:** Three independent PostgreSQL 15 instances (`user-db`, `book-db`, `exchange-db`).
*   **Message Broker (RabbitMQ 3.12):** Fanout exchanges for asynchronous event-driven communication.
*   **Notification Service:** Background consumer that listens to RabbitMQ events.

## 5. Data Communication Patterns

### A. Request-Reply (Orchestration)
The **Exchange Service** acts as an **Orchestrator**. When a trade is requested via `POST /trades`, it synchronously queries the other services via REST/HTTP:

1. **Book Service** (`GET /books/:bookId`) — verifies the book exists and has status `AVAILABLE`.
2. **User Service** (`GET /users/:requesterId`) — verifies the requesting user exists.

If either check fails, the trade is rejected with an appropriate error (404, 409, or 502). This implements the **Request-Reply** pattern (synchronous orchestration) with 5-second timeouts.

```
Client ──POST /trades──▶ Exchange Service
                              │
                  ┌───────────┼───────────┐
                  ▼                       ▼
           GET /books/:id          GET /users/:id
           Book Service            User Service
                  │                       │
                  └───────────┬───────────┘
                              ▼
                    INSERT INTO trades
                    (status: PENDING)
```

### B. Event-Driven (Choreography)
The system uses **Choreography** for non-blocking updates via RabbitMQ fanout exchanges:

| Event | Publisher | Exchange | Subscriber(s) | Action |
|---|---|---|---|---|
| `BOOK_CREATED` | Book Service | `book_events` | Notification Service | Logs: "New book X is available for exchange!" |
| `EXCHANGE_COMPLETED` | Exchange Service | `exchange_events` | Book Service, Notification Service | Book Service updates book status to `EXCHANGED`; Notification Service logs the trade completion |

Events are published as JSON with acknowledgement (ack/nack). Failed messages are not requeued (dead-lettered) to prevent infinite loops.

### C. Event Schemas

**BOOK_CREATED Event:**
```json
{
  "eventId": "1-1713354560000",
  "type": "BOOK_CREATED",
  "timestamp": "2026-04-17T12:00:00.000Z",
  "payload": {
    "bookId": 1,
    "title": "Clean Architecture",
    "author": "Robert C. Martin",
    "status": "AVAILABLE"
  }
}
```

**EXCHANGE_COMPLETED Event:**
```json
{
  "eventId": "ff37d61c-...-1713354560000",
  "type": "EXCHANGE_COMPLETED",
  "timestamp": "2026-04-17T12:01:00.000Z",
  "payload": {
    "tradeId": "ff37d61c-89b7-44ac-a9b6-e65e2fe151c7",
    "bookId": 1,
    "requesterId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## 6. Event Sourcing
All three services implement event sourcing. Every state change (user registration, book creation, trade initiation) is stored as an immutable event in a PostgreSQL `events` table with JSONB payloads:

```sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,    -- e.g. 'BookAdded', 'TradeCompleted'
    version VARCHAR(8) NOT NULL,        -- schema version for future evolution
    timestamp TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL                 -- full event payload
);
```

The `GET /books` endpoint reconstructs current book state by replaying events in order, demonstrating event sourcing's ability to derive read models from the event log.

## 7. Advanced Features — Implementation Details

### 7.1 Database per Service
Three separate PostgreSQL containers ensure complete data isolation:
- `user-db` (port 5433) — `users`, `events` tables
- `book-db` (port 5434) — `books`, `events` tables
- `exchange-db` (port 5435) — `trades`, `events` tables

No service accesses another's database. Cross-context data is retrieved via REST (Request-Reply) or received via events (Choreography).

### 7.2 API Gateway (Nginx)
A single entry point at port 80 routes traffic by URL path:
- `/users/*` → User Service (port 5001)
- `/books/*` → Book Service (port 5002)
- `/trades/*` → Exchange Service (port 5003)
- `/health/*` → Per-service health checks
- `/` → React frontend

Configuration: `api-gateway/nginx.conf`

### 7.3 Structured Logging (Winston)
All services use a shared Winston logger (`shared/logger.js`) that outputs JSON to stdout:
```json
{"level":"info","message":"Trade created successfully","service":"exchange-service","timestamp":"2026-04-17T12:00:00.000Z","tradeId":"ff37d61c-...","status":"PENDING"}
```
- Log levels: `debug`, `info`, `warn`, `error`
- Every log entry includes: `service` name, `timestamp`, contextual metadata (IDs, error messages)
- Logs are aggregated via `docker-compose logs <service>`

### 7.4 Health Monitoring
Every service exposes `GET /health` returning:
```json
{"status":"UP","service":"book-service","timestamp":"...","uptime":42.5,"database":"UP"}
```
- Returns HTTP 200 when healthy, 503 when database is unreachable
- Verifies database connectivity via `SELECT 1` query
- Accessible through the gateway: `http://localhost/health/user-service`

### 7.5 Integration Testing
22 automated tests (`tests/integration.test.js`) verify the system end-to-end:
- Health checks for all 3 services
- CRUD operations for users and books
- Exchange Service orchestration (Request-Reply validation)
- Full trade workflow with choreography (EXCHANGE_COMPLETED updates book status)
- Error handling (404, 409, 400 responses)
- Trade rejection flow

Run with: `cd tests && npm test` (requires `docker-compose up`)

## 8. Deployment Instructions
The entire stack is containerized.
1. Ensure Docker and Docker Compose are installed.
2. Run `docker-compose up --build`.
3. The UI is accessible at `http://localhost`.
4. API Gateway routes traffic internally to:
    *   User Service: `localhost:5001`
    *   Book Service: `localhost:5002`
    *   Exchange Service: `localhost:5003`
5. RabbitMQ Management UI: `http://localhost:15672` (guest/guest)
6. Run integration tests: `cd tests && npm test`

## 9. Project Structure
```
├── api-gateway/            # Nginx reverse proxy configuration
│   ├── Dockerfile
│   └── nginx.conf
├── book-service/           # Inventory Context
│   ├── db.js               # PostgreSQL connection (book-db)
│   ├── index.js            # Express API + RabbitMQ publisher/subscriber
│   ├── init_books_table.sql
│   └── init_events_table.sql
├── exchange-service/       # Exchange Context (Orchestrator)
│   ├── db.js               # PostgreSQL connection (exchange-db)
│   ├── index.js            # Trade orchestration + RabbitMQ publisher
│   └── init_trades_table.sql
├── user-service/           # User Context
│   ├── db.js               # PostgreSQL connection (user-db)
│   ├── index.js            # Express API
│   ├── init_users_table.sql
│   └── init_events_table.sql
├── notification-service/   # RabbitMQ event consumer
│   └── index.js
├── user-interface/         # React frontend
│   └── src/App.js
├── shared/                 # Shared utilities (copied into containers)
│   ├── logger.js           # Winston structured logger
│   ├── healthCheck.js      # Health check Express middleware
│   └── messaging.js        # RabbitMQ connect/publish/subscribe
├── migration-service/      # Database schema migrations
│   └── migrate.sh
├── tests/                  # Integration tests
│   └── integration.test.js
└── docker-compose.yml      # Full stack orchestration
```