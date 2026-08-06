import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [
    AuthModule,
    PrismaModule,
    ConfigModule,
    InfrastructureModule,
    LogsModule,
  ],
})
export class AdminModule {}
