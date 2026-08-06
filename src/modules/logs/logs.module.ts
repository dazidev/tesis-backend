import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
  imports: [PrismaModule],
})
export class LogsModule {}
