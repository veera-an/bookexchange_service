# Book Exchange Microservices

A distributed microservices platform for exchanging books between users. Built with Node.js, PostgreSQL, RabbitMQ, and Nginx, following Domain-Driven Design (DDD) principles.

> See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technology choices, communication patterns, and system design.

## Quick Start

```bash
# Start the full stack
docker-compose up --build

# Run integration tests (in a separate terminal)
cd tests && npm install && npm test
```

## Access Points

| Service | URL |
|---|---|
| Application (via Gateway) | http://localhost |
| User Service (direct) | http://localhost:5001 |
| Book Service (direct) | http://localhost:5002 |
| Exchange Service (direct) | http://localhost:5003 |
| RabbitMQ Dashboard | http://localhost:15672 (guest/guest) |
| React UI (direct) | http://localhost:3000 |

## API Endpoints

### User Service (`/users`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/users` | Create a user (`userId`, `username`, `email`, `city`, `preferences`) |
| `GET` | `/users` | List all users |
| `GET` | `/users/:userId` | Get user by ID |
| `PUT` | `/users/:userId` | Update user profile |
| `GET` | `/health` | Health check |

### Book Service (`/books`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/books` | Add a book (`name`, `author`, `isbn`, `genre`) — publishes `BOOK_CREATED` event |
| `GET` | `/books` | List all books (reconstructed from events) |
| `GET` | `/books/:bookId` | Get book by ID |
| `PUT` | `/books/:bookId` | Update book details |
| `POST` | `/books/:bookId/reserve` | Reserve a book (`userId`) |
| `POST` | `/books/:bookId/return` | Return a reserved book |
| `GET` | `/health` | Health check |

### Exchange Service (`/trades`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/trades` | Initiate a trade (`bookId`, `requesterId`) — orchestrates via REST calls to Book + User services |
| `GET` | `/trades` | List all trades |
| `GET` | `/trades/:tradeId` | Get trade status |
| `POST` | `/trades/:tradeId/accept` | Accept a trade — publishes `EXCHANGE_COMPLETED` event |
| `POST` | `/trades/:tradeId/reject` | Reject a trade (`reason`) |
| `GET` | `/health` | Health check |

## Example: Full Trade Workflow

```bash
# 1. Create a user
curl -X POST http://localhost/users \
  -H "Content-Type: application/json" \
  -d '{"userId":"550e8400-e29b-41d4-a716-446655440000","username":"veera","email":"veera@example.com","city":"Helsinki","preferences":"{}"}'

# 2. Add a book
curl -X POST http://localhost/books \
  -H "Content-Type: application/json" \
  -d '{"name":"Clean Architecture","author":"Robert C. Martin","isbn":"978-0134494166","genre":"Software"}'

# 3. Initiate a trade (Exchange Service verifies book + user via REST)
curl -X POST http://localhost/trades \
  -H "Content-Type: application/json" \
  -d '{"bookId":1,"requesterId":"550e8400-e29b-41d4-a716-446655440000"}'

# 4. Accept the trade (publishes EXCHANGE_COMPLETED → book becomes EXCHANGED)
curl -X POST http://localhost/trades/<tradeId>/accept

# 5. Verify the book status changed via choreography
curl http://localhost/books/1
# → {"status":"EXCHANGED",...}
```

## Architecture Highlights

- **Database-per-Service**: 3 isolated PostgreSQL instances (`user-db`, `book-db`, `exchange-db`)
- **Request-Reply (Orchestration)**: Exchange Service calls Book + User services via REST before creating trades
- **Event-Driven (Choreography)**: RabbitMQ fanout exchanges (`book_events`, `exchange_events`) for async updates
- **API Gateway**: Nginx routes all traffic through port 80
- **Structured Logging**: Winston JSON logs with service names and timestamps across all services
- **Health Monitoring**: `GET /health` on every service with database connectivity checks
- **Event Sourcing**: All state changes stored as immutable events in JSONB columns
- **Integration Tests**: 22 automated tests verifying the full workflow

## Running Integration Tests

The tests run against the live Docker stack via the Nginx gateway. Make sure all services are up first.

```bash
# 1. Start the stack (if not already running)
docker-compose up --build -d

# 2. Wait ~15 seconds for all services and migrations to finish

# 3. Install test dependencies (first time only)
cd tests && npm install

# 4. Run the tests
npm test
```

Expected output:
```
 PASS  ./integration.test.js
  Health Checks
    ✓ User Service is UP with database connected
    ✓ Book Service is UP with database connected
    ✓ Exchange Service is UP with database connected
  User Service
    ✓ POST /users — creates a new user
    ✓ GET /users/:userId — returns the created user
    ✓ GET /users/:userId — returns 404 for non-existent user
  Book Service
    ✓ POST /books — creates a new book
    ...
  Full Trade Workflow — Choreography (RabbitMQ)
    ✓ Book starts as AVAILABLE
    ✓ Initiate trade — status is PENDING
    ✓ Accept trade — status becomes COMPLETED
    ✓ Book status updated to EXCHANGED via choreography
    ...

Tests:       22 passed, 22 total
```

## Stopping

```bash
# Stop and remove containers
docker-compose down

# Stop and remove containers + database volumes (clean slate)
docker-compose down -v
```