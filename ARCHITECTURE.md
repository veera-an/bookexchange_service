# Architecture Document: Distributed Book Exchange System

## 1. Project Overview
This application is a microservice-based platform where users can list books and exchange them with others. The system is designed to be resilient, scalable, and loosely coupled, following **Domain-Driven Design (DDD)** principles and the **Database-per-Service** pattern.

## 2. Domain-Driven Design (Bounded Contexts)
The system is divided into three primary Bounded Contexts, each represented by a microservice:

*   **User Context (User Service):** Manages user identity, profiles, and reputation scores.
*   **Inventory Context (Book Service):** Manages the collection of books available for trade.
*   **Exchange Context (Exchange Service):** The core business logic that orchestrates the workflow of a book swap between two users.

## 3. System Architecture & Components
The application follows a cloud-native architecture deployed via Docker containers:

*   **Frontend (UI):** A React-based single-page application.
*   **API Gateway (Nginx):** Acts as a reverse proxy and entry point, routing requests to the appropriate backend services.
*   **Microservices:** Node.js/Express services.
*   **Databases:** Independent MongoDB instances for each service to ensure data isolation.
*   **Message Broker (RabbitMQ):** Facilitates asynchronous event-driven communication (Choreography).

## 4. Data Communication Patterns

### A. Request-Reply (Orchestration)
The **Exchange Service** acts as an **Orchestrator**. When a trade is requested, it synchronously queries the User and Book services via REST/HTTP to verify that:
1. The users exist and are in good standing.
2. The book is currently available.

### B. Event-Driven (Choreography)
The system uses **Choreography** for non-blocking updates via RabbitMQ:
*   **Event:** `BOOK_LISTED` -> Published by Book Service when a new book is added.
*   **Event:** `EXCHANGE_COMPLETED` -> Published by Exchange Service; the Book Service listens to this to update the book's status to "Exchanged."

### C. Data Schemas (Event Examples)
**BookCreated Event (JSON):**
```json
{
  "eventId": "uuid-v4",
  "type": "BOOK_CREATED",
  "timestamp": "2023-10-27T10:00:00Z",
  "payload": {
    "bookId": "book_123",
    "ownerId": "user_456",
    "title": "Clean Architecture"
  }
}
```

## 5. Migration Strategy: Strangler Fig
To migrate from a hypothetical monolith to this architecture, we follow the **Strangler Fig Pattern**:
1.  **Phase 1:** Extract the **User Service** first, as it contains sensitive data and is a core dependency for other contexts.
2.  **Phase 2:** Use a parallel run where the monolith and the new service operate simultaneously to ensure data integrity.
3.  **Phase 3:** Gradually move the Book and Exchange logic until the monolith is "strangled" and can be decommissioned.

## 6. Grade 5 "Extra Features" Implementation
To meet the requirements for a high grade, the following features are implemented:

1.  **Database per Service:** Each microservice has its own dedicated MongoDB container.
2.  **API Gateway:** Nginx handles routing and fragmenting the UI communication.
3.  **Structured Logging:** All services use a unified logging format (Winston) for traceability.
4.  **Health Monitoring:** A dedicated health-check endpoint for each service to report its status.
5.  **Integration Testing:** Automated tests to verify the workflow between the Exchange and Book services.

## 7. Deployment Instructions
The entire stack is containerized.
1. Ensure Docker and Docker Compose are installed.
2. Run `docker-compose up --build`.
3. The UI is accessible at `http://localhost`.
4. API Gateway routes traffic internally to:
    *   User Service: `3001`
    *   Book Service: `3002`
    *   Exchange Service: `3003`