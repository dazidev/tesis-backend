import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { TaskService } from './task.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators';
import { type User, ValidRoles } from '../auth/interfaces';
import { CreateTaskDto } from './dto';

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
}
