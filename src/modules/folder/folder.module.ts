import { Module } from '@nestjs/common';
import { FolderService } from './folder.service';
import { FolderController } from './folder.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  controllers: [FolderController],
  providers: [FolderService],
  imports: [PrismaModule, AuthModule, LogsModule],
})
export class FolderModule {}
