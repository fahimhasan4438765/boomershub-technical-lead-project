import { IsEnum } from 'class-validator';
import { SessionStatus } from '../session.entity';

export class UpdateSessionStatusDto {
  @IsEnum(SessionStatus)
  status!: SessionStatus;
}
