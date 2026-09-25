import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  controllers: [TaskController],
  providers: [TaskService],
  imports: [PrismaModule, AuthModule, LogsModule],
})
export class TaskModule {}
