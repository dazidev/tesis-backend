import { Module } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { ProcessesController } from './processes.controller';
import { MobileProcessesController } from './mobile-processes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  controllers: [ProcessesController, MobileProcessesController],
  providers: [ProcessesService],
  imports: [PrismaModule, AuthModule, LogsModule],
})
export class ProcessesModule {}
