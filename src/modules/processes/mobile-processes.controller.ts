import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { ProcessesService } from './processes.service';

import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators';
import { type User, ValidRoles } from '../auth/interfaces';

@Controller('mobile/processes')
@Auth(ValidRoles.client)
export class MobileProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  //* GET MY PROCESSES
  @Get()
  getMyProcesses(@GetUser() user: User) {
    return this.processesService.getMyProcesses(user);
  }

  //* GET MY PROCESS DETAIL
  @Get(':id')
  getMyProcessById(
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) processId: string,
  ) {
    return this.processesService.getMyProcessById(processId, user);
  }

  //* GET MY PROCESS DOCUMENTS
  @Get(':id/documents')
  getMyProcessDocuments(
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) processId: string,
  ) {
    return this.processesService.getMyProcessDocuments(processId, user);
  }
}
