import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { type User, ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import {
  CreateStageDto,
  CreateSubstageDto,
  DeactivateStageDto,
  DeactivateSubstageDto,
  ProcessDeactivateDto,
  ProcessDto,
} from './dto';

@Auth()
@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  //* CREATE PROCESS
  @Post('')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createProcess(@GetUser() user: User, @Body() processDto: ProcessDto) {
    return this.processesService.createProcess(user, processDto);
  }

  //* GET MANY PROCESSES
  @Get('')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getProcess(@GetUser() user: User) {
    return this.processesService.getProcesses(user);
  }

  //* GET PROCESS BY ID
  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getProcessById(
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) processId: string,
  ) {
    return this.processesService.getProcessById(processId, user);
  }

  //* DEACTIVATE PROCESS
  @Patch(':id/deactivate')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  deactivateProcess(
    @GetUser() user: User,
    @Body() processDeactivateDto: ProcessDeactivateDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processesService.deactivateProcess(
      id,
      processDeactivateDto,
      user,
    );
  }

  //* INITIATE PROCESS
  @Post(':id/init')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  initProcess(
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) processId: string,
  ) {
    return this.processesService.initProcess(processId, user);
  }

  /*//* CREATE STAGE
  @Post(':processId/stage')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createStage(
    @GetUser('id') userId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
    @Body() createStageDto: CreateStageDto,
  ) {
    return this.processesService.createStage(processId, createStageDto, userId);
  }*/

  //* CREATE INTERMEDIATE STAGE
  @Post('stage/:stageId/intermediate')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createStage(
    @GetUser() user: User,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() createStageDto: CreateStageDto,
  ) {
    return this.processesService.createStage(stageId, createStageDto, user);
  }

  //* GET STAGE BY ID
  @Get('stage/:stageId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getStageById(
    @GetUser() user: User,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.processesService.getStageById(stageId, user);
  }

  //* DELETE/DEACTIVATE STAGE
  @Patch('stage/:stageId/deactivate')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  deactivateStage(
    @GetUser() user: User,
    @Body() deactivateStageDto: DeactivateStageDto,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.processesService.deactivateStage(
      stageId,
      deactivateStageDto,
      user,
    );
  }

  //* CREATE SUBSTAGE
  @Post('stage/:stageId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createSubstage(
    @GetUser() user: User,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() createSubstageDto: CreateSubstageDto,
  ) {
    return this.processesService.createSubstage(
      stageId,
      createSubstageDto,
      user,
    );
  }

  //* GET SUBSTAGE BY ID
  @Get('substage/:subStageId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getSubStageById(
    @GetUser() user: User,
    @Param('subStageId', ParseUUIDPipe) subStageId: string,
  ) {
    return this.processesService.getSubStageById(subStageId, user);
  }

  //* DELETE/DEACTIVATE SUBSTAGE
  @Patch('substage/:substageId/deactivate')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  deactivateSubstage(
    @GetUser() user: User,
    @Body() deactivateSubstageDto: DeactivateSubstageDto,
    @Param('substageId', ParseUUIDPipe) substageId: string,
  ) {
    return this.processesService.deactivateSubstage(
      substageId,
      deactivateSubstageDto,
      user,
    );
  }

  //* CLOSE SUBSTAGE
  @Patch('substage/:substageId/close')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  closeSubstage(
    @GetUser() user: User,
    @Param('substageId', ParseUUIDPipe) substageId: string,
  ) {
    return this.processesService.closeSubstage(substageId, user);
  }

  //* CLOSE STAGE
  @Patch('stage/:stageId/close')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  closeStage(
    @GetUser() user: User,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.processesService.closeStage(stageId, user);
  }

  //* ADVANCE STAGE
  @Patch('stage/:stageId/advance')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  advanceStage(
    @GetUser() user: User,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.processesService.advanceStage(stageId, user);
  }

  //* FINALIZE PROCESS
  @Patch('stage/:stageId/finalize-process')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  finalizeProcess(
    @GetUser() user: User,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.processesService.finalizeProcess(stageId, user);
  }
}
