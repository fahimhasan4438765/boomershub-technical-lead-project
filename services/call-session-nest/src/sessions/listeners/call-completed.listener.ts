import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

interface CallCompletedPayload {
  event: string;
  version: number;
  sessionId: string;
  businessId: string;
  callerPhone: string;
  durationSeconds: number;
  outcome: string;
  summary: string | null;
  createdAt: string;
}

@Injectable()
export class CallCompletedListener {
  private readonly logger = new Logger(CallCompletedListener.name);

  @OnEvent('call.completed')
  handleCallCompleted(payload: CallCompletedPayload): void {
    this.logger.log(
      `call.completed — session=${payload.sessionId} ` +
      `business=${payload.businessId} ` +
      `outcome=${payload.outcome} ` +
      `duration=${payload.durationSeconds}s`,
    );
  }
}
