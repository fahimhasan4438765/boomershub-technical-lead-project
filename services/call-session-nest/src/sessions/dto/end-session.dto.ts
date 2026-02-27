import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SessionOutcome } from '../session.entity';

export class EndSessionDto {
  @IsEnum(SessionOutcome)
  outcome!: SessionOutcome;

  @IsOptional()
  @IsString()
  summary?: string;
}
