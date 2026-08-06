import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLog } from './interfaces';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  async createLog(
    data: CreateLog,
    tx: Prisma.TransactionClient | PrismaService,
  ) {
    return tx.log.create({
      data,
    });
  }
}
