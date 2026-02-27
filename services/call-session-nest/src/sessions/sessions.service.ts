import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionStatusDto } from './dto/update-session-status.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { SessionsRepository, PaginatedSessions } from './sessions.repository';
import { SessionsGateway } from './sessions.gateway';
import { Session, SessionStatus } from './session.entity';

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly sessionsGateway: SessionsGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateSessionDto): Promise<Session> {
    const session = await this.sessionsRepository.create(dto);
    this.sessionsGateway.broadcastSessionUpdate({
      event: 'session.created',
      sessionId: session.id,
      status: session.status,
      businessId: session.businessId,
      updatedAt: session.updatedAt.toISOString(),
    });
    return session;
  }

  async findOne(id: string): Promise<Session> {
    const session = await this.sessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return session;
  }

  async updateStatus(id: string, dto: UpdateSessionStatusDto): Promise<Session> {
    const session = await this.sessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    session.status = dto.status;
    const updated = await this.sessionsRepository.save(session);
    this.sessionsGateway.broadcastSessionUpdate({
      event: 'session.updated',
      sessionId: updated.id,
      status: updated.status,
      businessId: updated.businessId,
      updatedAt: updated.updatedAt.toISOString(),
    });
    return updated;
  }

  async findAll(query: ListSessionsQueryDto): Promise<PaginatedSessions> {
    return this.sessionsRepository.findAll({
      businessId: query.businessId,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit ?? 20,
    });
  }

  async endSession(id: string, dto: EndSessionDto): Promise<Session> {
    const session = await this.sessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }

    const now = new Date();
    session.status = SessionStatus.COMPLETED;
    session.endedAt = now;
    session.durationSeconds = Math.round(
      (now.getTime() - session.startedAt.getTime()) / 1000,
    );
    session.outcome = dto.outcome;
    session.summary = dto.summary ?? null;

    const ended = await this.sessionsRepository.save(session);

    this.sessionsGateway.broadcastSessionUpdate({
      event: 'session.ended',
      sessionId: ended.id,
      status: ended.status,
      businessId: ended.businessId,
      updatedAt: ended.updatedAt.toISOString(),
    });

    this.eventEmitter.emit('call.completed', {
      event: 'call.completed',
      version: 1,
      sessionId: ended.id,
      businessId: ended.businessId,
      callerPhone: ended.callerPhone,
      durationSeconds: ended.durationSeconds,
      outcome: ended.outcome,
      summary: ended.summary,
      createdAt: ended.createdAt.toISOString(),
    });

    return ended;
  }
}
