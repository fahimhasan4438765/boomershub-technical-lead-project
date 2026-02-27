## System Design – BoomersHub Voice AI Agent

**Author: Fahim Hasan**

This document is a concise, implementation-focused system design reference for the Voice AI Agent platform.

---

### 1. Core Domain Overview

- **Business goal**: Handle inbound/outbound calls for healthcare/retail/hospitality with AI agents, keeping latency \< 1.5s and scaling from ~50 to 500+ concurrent calls.
- **Primary flows**:
  - Phone call (PSTN/SIP) → Twilio → audio WebSocket → STT → LLM → TTS → audio back to caller.
  - Voice AI outcomes → leads/appointments/events → marketplace services.

Key services in this monorepo:
- `services/call-session-nest` – Call lifecycle, statuses, session data, events, WebSocket fan-out.
- `services/voice-pipeline-fastapi` – Real-time audio pipeline (STT, LLM, TTS).
- `apps/console-next` – Operational console (monitor calls, review transcripts, configure agents).

---

### 2. High-Level Architecture (For Reasoning & Diagrams)

**Logical layers**
- **Telephony Edge**: Twilio SIP / Voice, Webhook and WebSocket handlers, call routing.
- **Real-Time AI Pipeline**: FastAPI service managing:
  - Streaming STT (Deepgram or equivalent).
  - LLM orchestration (GPT/Claude) with token streaming and tools (functions).
  - Streaming TTS (ElevenLabs or equivalent).
- **Session & Business Logic**: NestJS microservices:
  - Call Session Service (`call-session-nest`).
  - Other marketplace services (User, Referral, Billing, Notifications, Analytics).
- **Data & Messaging**:
  - Database-per-service (PostgreSQL).
  - Redis for active session state, pub/sub, rate limiting.
  - Kafka/RabbitMQ for cross-service events.
- **Frontend & API Gateway**:
  - Next.js console.
  - API Gateway for routing, auth, rate limiting, and versioning.

When drawing diagrams, always show:
- Telephony ↔ Pipeline ↔ Sessions ↔ Marketplace.
- Separate arrows for synchronous APIs (REST/gRPC) vs asynchronous events.

---

### 3. Microservices Migration Strategy (From Monolith)

Use these boundaries from the Node.js monolith:
- **User Management Service**
- **Referral Matching Service**
- **Billing Service**
- **Notifications Service**
- **Analytics Service**
- **Call Session Service** (new; aligns with Part C of assignment)

**Key decisions**
- **Database-per-service**:
  - Each service gets its own PostgreSQL schema or instance.
  - Use events to propagate changes, not cross-service joins.
  - For read-heavy cross-service views, use a reporting/analytics service over denormalized projections.
- **Communication**:
  - REST/gRPC for synchronous, user-facing flows.
  - Kafka/RabbitMQ for domain events (`user.created`, `lead.created`, `call.completed`).
- **Migration pattern**:
  - Apply Strangler Fig:
    1. Introduce API gateway in front of monolith.
    2. Route specific functionality (e.g. notifications) to new service.
    3. Gradually move features and data ownership.
    4. Keep monolith DB read-only for migrated domains; new writes go to service DB.

---

### 4. Voice AI Pipeline Design (FastAPI)

**Responsibilities**
- Terminate Twilio WebSocket/audio stream.
- Fan out to:
  - Streaming STT client.
  - LLM orchestrator with conversation state.
  - Streaming TTS client.
- Maintain per-call pipeline state in Redis (session info, partial transcripts, current speaker).

**Latency budget (target \< 1.5 seconds total per turn)**
- STT partial recognition: ~300–400 ms.
- LLM first token: ~400–500 ms.
- TTS first audio chunk: ~300–400 ms.
- Network + overhead: ~200 ms.

**Optimizations**
- Use **streaming STT** and partial hypotheses, not full-sentence blocking STT.
- Start LLM generation as soon as STT confidence passes a threshold; do not wait for end-of-utterance.
- Start TTS as soon as first LLM tokens arrive; stream audio chunks.
- Use persistent HTTP/2 connections and connection pooling for STT/LLM/TTS providers.
- Co-locate pipeline service and Redis in same region/AZ; keep Twilio media host region aligned.

**Barge-in handling (duplex audio)**
- Maintain `is_ai_speaking` flag for each session in Redis.
- When barge-in is detected (new user speech energy while AI talking):
  - Immediately stop TTS stream to Twilio (send stop event).
  - Cancel current LLM generation.
  - Record partial AI response in transcript (marked as interrupted).
  - Resume STT and feed user speech back into the pipeline.

---

### 5. Call Session Service Design (NestJS)

**Core responsibilities**
- Create and manage call sessions and their lifecycle.
- Persist call metadata:
  - Caller phone, business ID.
  - AI agent config (script, persona, allowed tools).
  - Start/end timestamps, status, outcome, summary.
- Emit events (e.g. `call.completed`) for downstream services.
- Provide WebSocket updates to clients (console, dashboards).

**REST endpoints (per assignment)**
- `POST /sessions`
- `PATCH /sessions/:id/status`
- `GET /sessions/:id`
- `GET /sessions` (with business + status filters and cursor-based pagination)
- `POST /sessions/:id/end`

**NestJS layering**
- `Controller` → `Service` → `Repository`.
- DTOs use `class-validator` and `class-transformer`.
- Custom exception filter for consistent JSON errors `{ correlationId, statusCode, message, errors }`.
- WebSocket gateway broadcasts status changes: `session.updated`, `session.ended`, etc.

**Suggested event schema (`call.completed`)**
```json
{
  "event": "call.completed",
  "version": 1,
  "sessionId": "uuid",
  "businessId": "uuid",
  "callerPhone": "+1...",
  "durationSeconds": 320,
  "outcome": "appointment_booked",
  "summary": "Short natural language summary",
  "tags": ["high_intent", "follow_up_required"],
  "createdAt": "2024-01-01T00:00:00Z",
  "traceId": "uuid-for-observability"
}
```

---

### 6. Integration with Marketplace

**Patterns**
- Voice AI platform and marketplace communicate via:
  - REST APIs (read + command endpoints).
  - Event bus (domain events).
- Avoid direct DB access between systems.

**Example flows**
- Call results in new lead:
  - `call-session-nest` emits `lead.created` event after `POST /sessions/:id/end`.
  - Marketplace `Lead Service` consumes event and writes to its own DB.
- Voice AI reads marketplace data:
  - `voice-pipeline-fastapi`/`call-session-nest` call marketplace APIs like:
    - `GET /businesses/:id`
    - `GET /users/:id`
    - `GET /businesses/:id/preferences`

---

### 7. DevOps & Infrastructure Roadmap (90 Days)

**Month 1 – Foundation**
- **Containerization**
  - Add Dockerfiles for:
    - `call-session-nest` (Node 20, multi-stage build, non-root user).
    - `voice-pipeline-fastapi` (Python 3.11-slim, uvicorn/gunicorn, multi-stage).
  - Add `docker-compose.yml` with:
    - Postgres, Redis.
    - Both services and Next.js app.
- **CI/CD**
  - Use GitHub Actions (or GitLab CI).
  - Stages: lint → test → build → docker image → deploy to staging.
- **Orchestration**
  - Start with ECS Fargate for 8–12 services and a small team.
  - Use one shared ECS cluster with service-per-microservice and task autoscaling.

**Month 2 – Automation**
- **IaC**
  - Adopt Terraform or CDK.
  - Codify: VPC, ECS clusters, RDS instances, S3 buckets, IAM roles, secrets, CloudWatch metrics.
- **Environments**
  - Create `dev`, `staging`, `prod`.
  - For Voice AI load simulation:
    - Add a load generator service that simulates Twilio calls (audio files or synthetic speech).
- **Secrets management**
  - Use AWS Secrets Manager or SSM Parameter Store for:
    - Twilio, Deepgram, OpenAI, ElevenLabs, JWT secrets, DB creds.

**Month 3 – Observability & Production Readiness**
- **Monitoring stack**
  - Metrics: Prometheus-compatible (or CloudWatch) exporters from all services.
  - Key Voice AI metrics:
    - Call latency p50/p95/p99.
    - WebSocket connection counts and drop rate.
    - STT/TTS/LLM response times.
    - Concurrent call count.
    - Error rates per pipeline stage.
- **Logging**
  - Structured JSON logging, including `traceId` / `correlationId`.
  - Centralized via OpenSearch/ELK or vendor (Datadog/New Relic).
- **Alerting (examples)**
  - `Voice AI error rate > 5% over 5 minutes`.
  - `p95 call latency > 2.0s over 10 minutes`.
  - `WebSocket disconnects > X per minute`.
  - `RDS CPU or connections > 80% for 10 minutes`.
  - `No call.completed events for Y minutes during business hours`.
- **Deployments**
  - Prefer rolling or canary for services.
  - For telephony and pipeline, use gradual traffic shifting to new versions and automated rollback on error spikes.

---

### 8. Disaster Recovery & Incident Response

- **On-call**
  - Rotate 5–7 engineers.
  - Clear runbooks per major failure mode (STT down, LLM degraded, database issues, Twilio issues).
- **Example runbook – "Voice AI calls failing at >5% error rate"**
  - Check dashboards: error types by stage (STT, LLM, TTS, Twilio, internal exceptions).
  - Verify external provider status pages.
  - If a provider is degraded:
    - Route to backup provider.
    - Temporarily degrade features (no sentiment analysis, shorter responses).
  - Communicate status to stakeholders and update status page.
- **Post-mortem**
  - Blameless.
  - Include: timeline, root cause, contributing factors, fixed and follow-up actions with owners and deadlines.

---

### 9. Monorepo Conventions

- **Structure**
  - `apps/*` – User-facing applications (Next.js, future apps).
  - `services/*` – Backend services (NestJS, FastAPI, gateway, shared auth, etc.).
- **Languages & versions**
  - Node.js 20+, TypeScript strict mode for NestJS & Next.js.
  - Python 3.11+ with type hints and Pydantic models for FastAPI.
- **Shared practices**
  - One `.editorconfig`, shared ESLint/Prettier configs for TS.
  - `lint` and `test` scripts for each project.
  - Always include health checks (`/health` or `/live` + `/ready`).

---

This document is the single source of truth for architecture and technical decisions. Update it whenever the system evolves so new team members can quickly understand and extend the platform.

