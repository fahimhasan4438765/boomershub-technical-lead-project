import { IsString, IsUUID, IsOptional, IsObject } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  callerPhone!: string;

  @IsUUID()
  businessId!: string;

  @IsOptional()
  @IsObject()
  aiAgentConfig?: Record<string, unknown>;
}
