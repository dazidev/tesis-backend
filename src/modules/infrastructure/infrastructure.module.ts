import { Module } from '@nestjs/common';
import { BrevoService } from './services/brevo.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, InfrastructureModule],
  providers: [BrevoService],
  exports: [BrevoService],
})
export class InfrastructureModule {}
