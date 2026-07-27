import { Module } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { ProcessesController } from './processes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [ProcessesController],
  providers: [ProcessesService],
  imports: [PrismaModule, AuthModule],
})
export class ProcessesModule {}
