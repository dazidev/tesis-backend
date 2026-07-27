import { Body, Controller, Post } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { ProcessDto } from './dto';

@Auth()
@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  @Post('')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createProcess(@GetUser('id') UserId: string, @Body() processDto: ProcessDto) {
    return this.processesService.createProcess(UserId, processDto);
  }
}
