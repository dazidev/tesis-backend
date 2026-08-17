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
import { CreateSubstageDto, ProcessDeactivateDto, ProcessDto } from './dto';

@Auth()
@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  //* CREATE PROCESS
  @Post('')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createProcess(@GetUser('id') UserId: string, @Body() processDto: ProcessDto) {
    return this.processesService.createProcess(UserId, processDto);
  }

  //* GET MANY PROCESS
  @Get('')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getProcess() {
    return this.processesService.getProcesses();
  }

  //* GET PROCESS BY ID
  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getProcessById(@Param('id', ParseUUIDPipe) processId: string) {
    return this.processesService.getProcessById(processId);
  }

  //* DEACTIVATE PROCESS
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

  //* INITIATE PROCESS
  @Post(':id/init')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  initProcess(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) processId: string,
  ) {
    return this.processesService.initProcess(processId, userId);
  }

  //* CREATE SUBSTAGE
  @Post('stage/:stageId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createSubstage(
    @GetUser('id') userId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() createSubstageDto: CreateSubstageDto,
  ) {
    return this.processesService.createSubstage(stageId, createSubstageDto);
  }
}
