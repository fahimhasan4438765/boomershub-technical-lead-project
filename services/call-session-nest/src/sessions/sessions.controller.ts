import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionStatusDto } from './dto/update-session-status.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Body() dto: CreateSessionDto) {
    return this.sessionsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findOne(id);
  }

  @Get()
  findAll(@Query() query: ListSessionsQueryDto) {
    return this.sessionsService.findAll(query);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionStatusDto,
  ) {
    return this.sessionsService.updateStatus(id, dto);
  }

  @Post(':id/end')
  endSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndSessionDto,
  ) {
    return this.sessionsService.endSession(id, dto);
  }
}
