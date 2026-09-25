import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators';
import { type User, ValidRoles } from '../auth/interfaces';
import {
  CreateTaskDto,
  DeactivateTaskDto,
  UpdateTaskCompletionDto,
  UpdateTaskDto,
} from './dto';

@Auth()
@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post(':stageId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createTask(
    @GetUser()
    user: User,

    @Param('stageId', ParseUUIDPipe)
    stageId: string,

    @Body()
    createTaskDto: CreateTaskDto,
  ) {
    return this.taskService.createTask(user, stageId, createTaskDto);
  }

  @Patch(':taskId/completion')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  updateTaskCompletion(
    @GetUser()
    user: User,

    @Param('taskId', ParseUUIDPipe)
    taskId: string,

    @Body()
    updateTaskCompletionDto: UpdateTaskCompletionDto,
  ) {
    return this.taskService.updateTaskCompletion(
      user,
      taskId,
      updateTaskCompletionDto,
    );
  }

  @Patch(':taskId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  updateTask(
    @GetUser()
    user: User,

    @Param('taskId', ParseUUIDPipe)
    taskId: string,

    @Body()
    updateTaskDto: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(user, taskId, updateTaskDto);
  }

  @Patch(':taskId/deactivate')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  deactivateTask(
    @GetUser()
    user: User,

    @Param('taskId', ParseUUIDPipe)
    taskId: string,

    @Body()
    deactivateTaskDto: DeactivateTaskDto,
  ) {
    return this.taskService.deactivateTask(user, taskId, deactivateTaskDto);
  }
}
