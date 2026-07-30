import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessDto } from './dto';
import { Prisma } from 'src/generated/prisma/client';

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
