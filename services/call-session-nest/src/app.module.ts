import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SessionsModule } from './sessions/sessions.module';
import { HealthModule } from './health/health.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { Session } from './sessions/session.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env['DB_HOST'] ?? 'localhost',
      port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
      username: process.env['DB_USERNAME'] ?? 'postgres',
      password: process.env['DB_PASSWORD'] ?? 'postgres',
      database: process.env['DB_NAME'] ?? 'call_sessions',
      entities: [Session],
      synchronize: process.env['NODE_ENV'] !== 'production',
      logging: process.env['NODE_ENV'] !== 'production',
    }),
    EventEmitterModule.forRoot(),
    SessionsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
