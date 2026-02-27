import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SessionStatus {
  ACTIVE = 'active',
  ON_HOLD = 'on-hold',
  TRANSFERRING = 'transferring',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SessionOutcome {
  APPOINTMENT_BOOKED = 'appointment_booked',
  LEAD_CAPTURED = 'lead_captured',
  INFORMATION_PROVIDED = 'information_provided',
  TRANSFERRED_TO_HUMAN = 'transferred_to_human',
  CALLER_HUNG_UP = 'caller_hung_up',
  ERROR = 'error',
  NO_OUTCOME = 'no_outcome',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  callerPhone!: string;

  @Index()
  @Column({ type: 'uuid' })
  businessId!: string;

  @Column({ type: 'jsonb', nullable: true })
  aiAgentConfig!: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.ACTIVE })
  status!: SessionStatus;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ type: 'enum', enum: SessionOutcome, nullable: true })
  outcome!: SessionOutcome | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
