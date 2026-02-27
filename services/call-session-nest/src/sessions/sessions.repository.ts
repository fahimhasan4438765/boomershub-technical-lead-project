import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThan } from 'typeorm';
import { Session, SessionStatus } from './session.entity';
import { CreateSessionDto } from './dto/create-session.dto';

export interface PaginatedSessions {
  data: Session[];
  nextCursor: string | null;
}

@Injectable()
export class SessionsRepository {
  constructor(
    @InjectRepository(Session)
    private readonly repo: Repository<Session>,
  ) {}

  async create(dto: CreateSessionDto): Promise<Session> {
    const session = this.repo.create({
      callerPhone: dto.callerPhone,
      businessId: dto.businessId,
      aiAgentConfig: dto.aiAgentConfig ?? null,
      status: SessionStatus.ACTIVE,
      startedAt: new Date(),
      endedAt: null,
      durationSeconds: null,
      outcome: null,
      summary: null,
    });
    return this.repo.save(session);
  }

  async findById(id: string): Promise<Session | null> {
    return this.repo.findOneBy({ id });
  }

  async findAll(filters: {
    businessId?: string;
    status?: SessionStatus;
    cursor?: string;
    limit: number;
  }): Promise<PaginatedSessions> {
    const where: FindOptionsWhere<Session> = {};

    if (filters.businessId) {
      where.businessId = filters.businessId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.cursor) {
      where.createdAt = LessThan(new Date(filters.cursor));
    }

    const limit = Math.min(filters.limit, 100);

    const data = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop();
    }

    const nextCursor = hasMore && data.length > 0
      ? data[data.length - 1].createdAt.toISOString()
      : null;

    return { data, nextCursor };
  }

  async save(session: Session): Promise<Session> {
    return this.repo.save(session);
  }
}
