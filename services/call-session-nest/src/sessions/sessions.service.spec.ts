import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionsService } from './sessions.service';
import { SessionsRepository, PaginatedSessions } from './sessions.repository';
import { SessionsGateway } from './sessions.gateway';
import { Session, SessionStatus, SessionOutcome } from './session.entity';

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date();
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    callerPhone: '+15551234567',
    businessId: '11111111-2222-3333-4444-555555555555',
    aiAgentConfig: null,
    status: SessionStatus.ACTIVE,
    startedAt: new Date(now.getTime() - 60_000),
    endedAt: null,
    durationSeconds: null,
    outcome: null,
    summary: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SessionsService', () => {
  let service: SessionsService;
  let repo: jest.Mocked<SessionsRepository>;
  let gateway: jest.Mocked<SessionsGateway>;
  let emitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockRepo: Partial<jest.Mocked<SessionsRepository>> = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    };

    const mockGateway: Partial<jest.Mocked<SessionsGateway>> = {
      broadcastSessionUpdate: jest.fn(),
    };

    const mockEmitter: Partial<jest.Mocked<EventEmitter2>> = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: SessionsRepository, useValue: mockRepo },
        { provide: SessionsGateway, useValue: mockGateway },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get(SessionsService);
    repo = module.get(SessionsRepository);
    gateway = module.get(SessionsGateway);
    emitter = module.get(EventEmitter2);
  });

  describe('create', () => {
    it('should create a session and broadcast session.created', async () => {
      const session = makeSession();
      repo.create.mockResolvedValue(session);

      const result = await service.create({
        callerPhone: '+15551234567',
        businessId: '11111111-2222-3333-4444-555555555555',
      });

      expect(result).toBe(session);
      expect(result.status).toBe(SessionStatus.ACTIVE);
      expect(gateway.broadcastSessionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'session.created', sessionId: session.id }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a session when found', async () => {
      const session = makeSession();
      repo.findById.mockResolvedValue(session);

      const result = await service.findOne(session.id);
      expect(result).toBe(session);
    });

    it('should throw NotFoundException when session does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update the session status and broadcast session.updated', async () => {
      const session = makeSession();
      repo.findById.mockResolvedValue(session);
      repo.save.mockResolvedValue({ ...session, status: SessionStatus.ON_HOLD });

      const result = await service.updateStatus(session.id, {
        status: SessionStatus.ON_HOLD,
      });

      expect(result.status).toBe(SessionStatus.ON_HOLD);
      expect(gateway.broadcastSessionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'session.updated' }),
      );
    });

    it('should throw NotFoundException for unknown session', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('bad-id', { status: SessionStatus.ON_HOLD }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('endSession', () => {
    it('should compute duration, set outcome, and emit call.completed', async () => {
      const startedAt = new Date(Date.now() - 120_000);
      const session = makeSession({ startedAt });
      repo.findById.mockResolvedValue(session);
      repo.save.mockImplementation(async (s: Session) => s);

      const result = await service.endSession(session.id, {
        outcome: SessionOutcome.APPOINTMENT_BOOKED,
        summary: 'Booked a dental appointment for March 5',
      });

      expect(result.status).toBe(SessionStatus.COMPLETED);
      expect(result.endedAt).toBeInstanceOf(Date);
      expect(result.durationSeconds).toBeGreaterThanOrEqual(119);
      expect(result.outcome).toBe(SessionOutcome.APPOINTMENT_BOOKED);
      expect(result.summary).toBe('Booked a dental appointment for March 5');

      expect(emitter.emit).toHaveBeenCalledWith(
        'call.completed',
        expect.objectContaining({
          event: 'call.completed',
          version: 1,
          sessionId: session.id,
          outcome: SessionOutcome.APPOINTMENT_BOOKED,
        }),
      );

      expect(gateway.broadcastSessionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'session.ended' }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated sessions with filters', async () => {
      const sessions: PaginatedSessions = {
        data: [makeSession()],
        nextCursor: null,
      };
      repo.findAll.mockResolvedValue(sessions);

      const result = await service.findAll({
        businessId: '11111111-2222-3333-4444-555555555555',
        status: SessionStatus.ACTIVE,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: '11111111-2222-3333-4444-555555555555',
          status: SessionStatus.ACTIVE,
        }),
      );
    });
  });
});
