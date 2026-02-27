## BoomersHub Voice AI Agent Monorepo

**Author: Fahim Hasan**

### Overview

This monorepo contains the core components of a Voice AI Agent platform for handling inbound and outbound calls across healthcare, retail, and hospitality. It is structured to align with the BoomersHub Technical Lead assignment and is designed for scalability, low latency, and clear service boundaries.

The repository is organized as a polyglot monorepo with:
- **NestJS** microservices for operational backend workloads (e.g. call session management).
- **FastAPI** services for the real-time AI audio pipeline (STT → LLM → TTS).
- **Next.js** frontend for operations, monitoring, and configuration.

### Quick Start

```bash
# Start the full stack (PostgreSQL + Redis + Call Session service)
docker compose up

# The API is available at http://localhost:3001
# WebSocket at ws://localhost:3001/ws/sessions
```

**Run services individually:**

```bash
# NestJS Call Session (requires PostgreSQL on localhost:5432)
cd services/call-session-nest && npm install && npm run start:dev

# FastAPI Voice Pipeline
cd services/voice-pipeline-fastapi && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Next.js Console
cd apps/console-next && npm install && npm run dev
```

### High-Level Architecture

- **Telephony Layer (Twilio)**: Handles PSTN/SIP connectivity and streams audio via WebSocket into the AI pipeline.
- **AI Pipeline (FastAPI)**: Orchestrates streaming STT (e.g. Deepgram), LLM (GPT/Claude), and TTS (e.g. ElevenLabs) with token-level streaming and barge-in support.
- **Call Session Service (NestJS)**: Manages call lifecycle, status, metadata, outcomes, and emits events such as `call.completed`.
- **Marketplace / Business Services (NestJS / existing Node)**: User management, referrals, billing, notifications, analytics. These are decoupled behind APIs and events.
- **Frontend Console (Next.js)**: Web UI to monitor live calls, review transcripts, configure AI agents, and manage businesses.
- **Shared Infrastructure**: API gateway, auth, observability, messaging (Kafka/RabbitMQ), and database-per-service (PostgreSQL).

### Repository Structure

```
/
├── architecture.md                         # Architecture document (Part A + B deliverable)
├── docker-compose.yml                      # Full stack: Postgres + Redis + services
├── package.json                            # npm workspaces root
├── system-design.md                        # Internal design reference
│
├── apps/
│   └── console-next/                       # Next.js operations console
│       └── src/app/
│           ├── page.tsx                     # Real-time dashboard with session table
│           ├── hooks/use-sessions-socket.ts # WebSocket hook for live updates
│           └── components/                  # StatusBadge, SessionDetail
│
└── services/
    ├── call-session-nest/                   # NestJS Call Session microservice (Part C)
    │   ├── Dockerfile                       # Multi-stage, Node 20 Alpine, non-root
    │   ├── src/
    │   │   ├── main.ts                      # Bootstrap: validation, exception filter, WS adapter
    │   │   ├── app.module.ts                # TypeORM, EventEmitter, middleware
    │   │   ├── common/
    │   │   │   ├── filters/                 # Global exception filter (structured JSON)
    │   │   │   └── middleware/              # Correlation ID middleware
    │   │   ├── health/                      # Liveness & readiness probes
    │   │   └── sessions/
    │   │       ├── session.entity.ts        # TypeORM entity (PostgreSQL)
    │   │       ├── sessions.controller.ts   # 5 REST endpoints
    │   │       ├── sessions.service.ts      # Business logic + event orchestration
    │   │       ├── sessions.repository.ts   # TypeORM data access + cursor pagination
    │   │       ├── sessions.gateway.ts      # WebSocket broadcasts
    │   │       ├── sessions.service.spec.ts # 7 unit tests
    │   │       ├── dto/                     # class-validator DTOs (4 files)
    │   │       └── listeners/               # call.completed event handler
    │   └── README.md                        # Service docs + architectural decisions
    │
    └── voice-pipeline-fastapi/              # FastAPI STT → LLM → TTS pipeline
        ├── requirements.txt
        └── app/
            ├── main.py                      # App entrypoint + /health
            ├── core/
            │   ├── config.py                # Pydantic settings (providers, latency budgets)
            │   └── state.py                 # Per-call pipeline state (Redis interface)
            ├── routers/
            │   └── pipeline.py              # WebSocket: Twilio audio stream handler
            └── services/
                ├── stt_client.py            # STT interface (Deepgram)
                ├── llm_client.py            # LLM interface (OpenAI)
                └── tts_client.py            # TTS interface (ElevenLabs)
```

### Deliverables

| Part | Deliverable | Location |
|------|-------------|----------|
| **A** — System Architecture & Design | Architecture Document (6 sections, 5 Mermaid diagrams) | [`architecture.md`](architecture.md) |
| **B** — DevOps & Infrastructure Plan | 90-day roadmap + DR/incident response | [`architecture.md`](architecture.md) |
| **C** — Hands-On Code (NestJS) | Call Session Microservice (fully implemented) | [`services/call-session-nest/`](services/call-session-nest/) |
| **Beyond scope** | Voice Pipeline (STT/LLM/TTS) | [`services/voice-pipeline-fastapi/`](services/voice-pipeline-fastapi/) |
| **Beyond scope** | Real-time monitoring dashboard | [`apps/console-next/`](apps/console-next/) |

### What's Implemented vs. Designed

| Component | Status | Notes |
|-----------|--------|-------|
| Call Session Service (NestJS) | **Fully implemented** | 5 endpoints, WebSocket, events, tests, Docker |
| Voice Pipeline (FastAPI) | **Implemented** | STT/LLM/TTS streaming with Deepgram, OpenAI, and ElevenLabs integrations |
| Console Dashboard (Next.js) | **Functional UI** | Connects to NestJS WebSocket, shows live session table, status filters, detail panel |
| Marketplace Services | **Designed only** | Architecture doc covers service boundaries, migration path, event schemas |

### Submission Checklist

- [x] Architecture Document (PDF/Markdown, max 6 pages) with diagrams for all sections
- [x] DevOps 90-day roadmap included in architecture document
- [x] NestJS Call Session microservice with Dockerfile + docker-compose.yml
- [x] README with setup instructions and architectural decisions
- [x] All tests passing (7 unit tests)
- [x] **Bonus**: Health check with liveness/readiness probes
- [x] **Bonus**: Structured JSON logging with correlation ID middleware

### Testing

```bash
cd services/call-session-nest
npm test    # 7 unit tests on service layer — all passing
```
