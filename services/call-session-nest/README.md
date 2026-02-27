# Call Session Microservice

NestJS/TypeScript microservice managing Voice AI call session lifecycle.

## Quick Start

### With Docker (recommended)

From the **monorepo root**:

```bash
docker compose up
```

This starts PostgreSQL, Redis, and the Call Session service. The API is available at `http://localhost:3001`.

### Local Development

```bash
# Start a local PostgreSQL (port 5432, db: call_sessions, user/pass: postgres/postgres)
npm install
npm run start:dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create a call session |
| `GET` | `/sessions/:id` | Get full session details |
| `GET` | `/sessions?businessId=&status=&cursor=&limit=` | List sessions (cursor-based pagination) |
| `PATCH` | `/sessions/:id/status` | Update session status |
| `POST` | `/sessions/:id/end` | End session — computes duration, records outcome |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe (checks DB) |

### WebSocket

Connect to `ws://localhost:3001/ws/sessions` to receive real-time events:

- `session.created` — new session started
- `session.updated` — status changed
- `session.ended` — session completed

### Example Requests

**Create a session:**
```bash
curl -X POST http://localhost:3001/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "callerPhone": "+15551234567",
    "businessId": "11111111-2222-3333-4444-555555555555",
    "aiAgentConfig": { "persona": "dental_receptionist" }
  }'
```

**End a session:**
```bash
curl -X POST http://localhost:3001/sessions/<id>/end \
  -H "Content-Type: application/json" \
  -d '{
    "outcome": "appointment_booked",
    "summary": "Booked a dental cleaning for March 5 at 2pm"
  }'
```

**List sessions with filters:**
```bash
curl "http://localhost:3001/sessions?businessId=11111111-2222-3333-4444-555555555555&status=active&limit=10"
```

## Architecture Decisions

1. **Controller → Service → Repository pattern**: Clean separation of concerns. The controller handles HTTP, the service contains business logic and event orchestration, the repository encapsulates data access.

2. **TypeORM with PostgreSQL**: Production-grade persistence with entity mapping. `synchronize: true` only in development; production would use migrations (`typeorm migration:generate`).

3. **Cursor-based pagination**: Uses `createdAt` timestamp as cursor instead of offset pagination. Cursor-based pagination is stable under concurrent writes and performs well with indexed columns.

4. **Event-driven architecture**: `call.completed` events are emitted via `@nestjs/event-emitter`. In production, this would publish to Kafka/RabbitMQ for downstream consumers (Lead Service, Analytics, Notifications).

5. **WebSocket gateway**: Broadcasts session lifecycle events to connected clients in real-time using the native `ws` library via `@nestjs/platform-ws`. Supports the operations console dashboard.

6. **Correlation ID middleware**: Every request gets a correlation ID (from `x-correlation-id` header or auto-generated UUID). Propagated to error responses and logs for distributed tracing.

7. **Structured error responses**: Custom global exception filter returns consistent JSON: `{ correlationId, statusCode, message, errors, timestamp, path }`.

## Testing

```bash
npm test
```

7 unit tests covering:
- Session creation with WebSocket broadcast
- Session lookup (found and not-found cases)
- Status updates with broadcast
- Session end with duration computation, outcome recording, and `call.completed` event emission
- Paginated listing with filters

## What I Would Add for Production

- **Database migrations** instead of `synchronize: true`
- **JWT/API key authentication** via NestJS Guards
- **Rate limiting** with `@nestjs/throttler`
- **Kafka/RabbitMQ** publisher replacing the in-process event emitter
- **Redis** for session state caching and WebSocket fan-out across multiple instances
- **OpenTelemetry** tracing with correlation ID propagation
- **Request logging** interceptor with structured JSON output
- **Swagger/OpenAPI** docs via `@nestjs/swagger`
- **E2E tests** with a test database and supertest
- **Graceful shutdown** handling for in-flight requests and WebSocket connections
