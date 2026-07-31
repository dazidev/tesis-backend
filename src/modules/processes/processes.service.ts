import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessDeactivateDto, ProcessDto } from './dto';
import { Prisma } from 'src/generated/prisma/client';
import { ActionsLog } from 'src/common';

@Injectable()
export class ProcessesService {
  constructor(private prisma: PrismaService) {}

  async createProcess(userId: string, processDto: ProcessDto) {
    try {
      const { courtNumber, caseFileNumber, type, managedByID, defendant } =
        processDto;
      const { name, lastname, birthDate, deathDate } = defendant;

      const defendantId = await this.prisma.defendant.create({
        data: {
          name,
          lastname,
          birthDate: new Date(birthDate),
          deathDate: new Date(deathDate),
        },
        select: {
          id: true,
        },
      });

      const process = await this.prisma.process.create({
        data: {
          courtNumber,
          caseFileNumber,
          type,
          defendantId: defendantId.id,
          status: 'created',
          managedByID,
          createdById: userId,
        },
      });

      if (!process) return process;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async getProcess() {
    try {
      const processes = await this.prisma.process.findMany();

      return processes;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async deactivateProcess(
    id: string,
    processDeactivateDto: ProcessDeactivateDto,
    userId: string,
  ) {
    try {
      const { reason } = processDeactivateDto;

      const process = await this.prisma.process.findUnique({
        select: { status: true },
        where: { id },
      });

      if (!process) throw new Error('The process was not found');

      await this.prisma.$transaction(async (tx) => {
        if (process.status === 'created') {
          await tx.process.delete({ where: { id } });
        } else {
          await tx.process.update({
            data: { status: 'deleted' },
            where: { id },
          });
        }

        await tx.log.create({
          data: {
            userId,
            action:
              process.status === 'created'
                ? ActionsLog.common.deleteProcess
                : ActionsLog.common.deactivateProcess,
            description: reason,
          },
        });
      });

      return;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  private handleDBErrors(error): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      if (
        Array.isArray(error.meta?.target) &&
        error.meta?.target.includes('email')
      ) {
        throw new BadRequestException('Email already registered');
      }
      throw new BadRequestException('Insert fail');
    } else if (error instanceof Error) {
      throw new BadRequestException(error.message);
    }
    throw new InternalServerErrorException('Unknown error');
  }
}
