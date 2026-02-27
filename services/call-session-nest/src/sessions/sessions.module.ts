import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { SessionsGateway } from './sessions.gateway';
import { CallCompletedListener } from './listeners/call-completed.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionsRepository,
    SessionsGateway,
    CallCompletedListener,
  ],
})
export class SessionsModule {}
