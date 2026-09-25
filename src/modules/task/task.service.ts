import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { Prisma } from 'src/generated/prisma/client';

import { LogsService } from '../logs/logs.service';

import { CreateLog } from '../logs/interfaces';

import { LogActions, LogEntities } from 'src/common';

import { type User, ValidRoles } from '../auth/interfaces';

import { CreateTaskDto } from './dto';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async createTask(user: User, stageId: string, createTaskDto: CreateTaskDto) {
    try {
      const { description, dueDate, substageId } = createTaskDto;

      const stage = await this.prisma.processStage.findFirst({
        where: {
          id: stageId,

          status: {
            not: 'deleted',
          },
        },
        select: {
          id: true,

          process: {
            select: {
              managedByID: true,
            },
          },
        },
      });

      if (!stage) {
        throw new NotFoundException('Etapa no encontrada');
      }

      //! todo: review that validation

      const isAdmin = user.roles.includes(ValidRoles.admin);

      const isLawyer = user.roles.includes(ValidRoles.lawyer);

      const lawyerHasAccess = isLawyer && stage.process.managedByID === user.id;

      if (!isAdmin && !lawyerHasAccess) {
        throw new NotFoundException('Etapa no encontrada');
      }

      if (substageId) {
        const substage = await this.prisma.processSubstage.findFirst({
          where: {
            id: substageId,

            stageId,

            status: {
              not: 'deleted',
            },
          },

          select: {
            id: true,
          },
        });

        if (!substage) {
          throw new BadRequestException(
            'La subetapa no pertenece a la etapa indicada o no está disponible',
          );
        }
      }

      return await this.prisma.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            description,

            dueDate: new Date(dueDate),

            createdById: user.id,

            stageId,

            substageId: substageId ?? null,
          },
        });

        const dataLog: CreateLog = {
          userId: user.id,

          action: LogActions.task.create,

          entity: LogEntities.task,

          affected: task.id,

          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return task;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  private handleDBErrors(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new BadRequestException('Error en la operación de base de datos');
    }

    if (error instanceof Error) {
      throw new BadRequestException(error.message);
    }

    throw new InternalServerErrorException('Error desconocido');
  }
}
