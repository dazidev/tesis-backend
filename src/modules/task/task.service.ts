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
import {
  CreateTaskDto,
  DeactivateTaskDto,
  UpdateTaskCompletionDto,
  UpdateTaskDto,
} from './dto';

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
          status: 'opened',
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
            status: 'opened',
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

      const parsedDueDate = new Date(dueDate);

      if (parsedDueDate.getTime() <= Date.now()) {
        throw new BadRequestException(
          'La fecha límite debe ser posterior a la fecha actual',
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            description,

            dueDate: parsedDueDate,

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

  async updateTaskCompletion(
    user: User,
    taskId: string,
    updateTaskCompletionDto: UpdateTaskCompletionDto,
  ) {
    try {
      const task = await this.getAccessibleTask(user, taskId);

      this.validateTaskContainerIsOpened(task);

      const { completed } = updateTaskCompletionDto;

      if (completed && task.completedAt) {
        return task;
      }

      if (!completed && !task.completedAt) {
        return task;
      }

      return await this.prisma.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: {
            id: task.id,
          },

          data: {
            completedAt: completed ? new Date() : null,
          },
        });

        const dataLog: CreateLog = {
          userId: user.id,

          action: completed ? LogActions.task.complete : LogActions.task.reopen,

          entity: LogEntities.task,

          affected: task.id,

          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return updatedTask;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  async updateTask(user: User, taskId: string, updateTaskDto: UpdateTaskDto) {
    try {
      const task = await this.getAccessibleTask(user, taskId);
      this.validateTaskContainerIsOpened(task);
      const { description, dueDate } = updateTaskDto;
      const parsedDueDate = new Date(dueDate);

      if (
        parsedDueDate.getTime() <= Date.now() &&
        parsedDueDate.getTime() !== task.dueDate.getTime()
      ) {
        throw new BadRequestException(
          'La nueva fecha límite debe ser posterior a la fecha actual',
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: {
            id: task.id,
          },
          data: {
            description,
            dueDate: parsedDueDate,
          },
        });

        const dataLog: CreateLog = {
          userId: user.id,
          action: LogActions.task.update,
          entity: LogEntities.task,
          affected: task.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return updatedTask;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  async deactivateTask(
    user: User,
    taskId: string,
    deactivateTaskDto: DeactivateTaskDto,
  ) {
    try {
      const task = await this.getAccessibleTask(user, taskId);
      this.validateTaskContainerIsOpened(task);
      const { reason } = deactivateTaskDto;

      return await this.prisma.$transaction(async (tx) => {
        const deletedTask = await tx.task.update({
          where: {
            id: task.id,
          },

          data: {
            deletedAt: new Date(),
          },
        });

        const dataLog: CreateLog = {
          userId: user.id,
          action: LogActions.task.deactivate,
          entity: LogEntities.task,
          affected: task.id,
          description: reason,
        };

        await this.logsService.create(dataLog, tx);

        return deletedTask;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  private async getAccessibleTask(user: User, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
      },
      select: {
        id: true,
        description: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        createdById: true,
        stageId: true,
        substageId: true,
        stage: {
          select: {
            status: true,
            process: {
              select: {
                managedByID: true,
              },
            },
          },
        },
        substage: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    const isAdmin = user.roles.includes(ValidRoles.admin);

    const isLawyer = user.roles.includes(ValidRoles.lawyer);

    const lawyerHasAccess =
      isLawyer && task.stage.process.managedByID === user.id;

    if (!isAdmin && !lawyerHasAccess) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return task;
  }

  private validateTaskContainerIsOpened(task: {
    stage: {
      status: string;
    };

    substage: {
      status: string;
    } | null;
  }) {
    if (task.stage.status !== 'opened') {
      throw new BadRequestException(
        'La etapa está cerrada y sus tareas no pueden modificarse.',
      );
    }

    if (task.substage && task.substage.status !== 'opened') {
      throw new BadRequestException(
        'La subetapa está cerrada y sus tareas no pueden modificarse.',
      );
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
