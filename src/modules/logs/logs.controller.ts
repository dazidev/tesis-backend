import { Controller, Get, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces';
import { FindLogsQueryDto } from './dto';

@Auth(ValidRoles.admin)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('filters')
  getFilters() {
    return this.logsService.getFilters();
  }

  @Get()
  findAll(@Query() findLogsQueryDto: FindLogsQueryDto) {
    return this.logsService.findAll(findLogsQueryDto);
  }
}
