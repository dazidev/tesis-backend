import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { ProcessDeactivateDto, ProcessDto } from './dto';

@Auth()
@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  @Post('')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createProcess(@GetUser('id') UserId: string, @Body() processDto: ProcessDto) {
    return this.processesService.createProcess(UserId, processDto);
  }

  @Get('')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getProcess() {
    return this.processesService.getProcess();
  }

  @Patch(':id/deactivate')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  deactivateProcess(
    @GetUser('id') UserId: string,
    @Body() processDeactivateDto: ProcessDeactivateDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processesService.deactivateProcess(
      id,
      processDeactivateDto,
      UserId,
    );
  }
}
