import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStageDto,
  CreateSubstageDto,
  ProcessDeactivateDto,
  ProcessDto,
} from './dto';
import { Prisma } from 'src/generated/prisma/client';
import {
  buildTree,
  LogActions,
  LogEntities,
  lockStage,
  lockProcess,
} from 'src/common';
import { LogsService } from '../logs/logs.service';
import { CreateLog } from '../logs/interfaces';
import { DeactivateSubstageDto } from './dto/deactivate-substage.dto';
import { type User } from '../auth/interfaces/user';

@Injectable()
export class ProcessesService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async createProcess(user: User, processDto: ProcessDto) {
    try {
      const { courtNumber, caseFileNumber, type, managedByID, defendant } =
        processDto;

      const userId = user.id;
      const isAdmin = user.roles.includes('admin');

      if (!isAdmin && managedByID && managedByID !== userId) {
        throw new ForbiddenException(
          'Un abogado no puede asignar procesos a otros usuarios.',
        );
      }

      const managerId = isAdmin ? managedByID || userId : userId;

      if (isAdmin && managedByID) {
        const manager = await this.prisma.user.findFirst({
          where: {
            id: managedByID,
            status: 'active',
            roles: {
              has: 'lawyer',
            },
          },
          select: {
            id: true,
          },
        });

        if (!manager) {
          throw new BadRequestException(
            'El responsable seleccionado debe ser un abogado activo.',
          );
        }
      }

      const { name, lastname, birthDate, deathDate } = defendant;

      let process;

      await this.prisma.$transaction(async (tx) => {
        const defendantId = await tx.defendant.create({
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

        const processResponse = await tx.process.create({
          data: {
            courtNumber,
            caseFileNumber,
            type,
            defendantId: defendantId.id,
            status: 'created',
            managedByID: managerId,
            createdById: userId,
          },
        });

        const dataLog: CreateLog = {
          userId,
          action: LogActions.process.create,
          entity: LogEntities.process,
          affected: processResponse.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);

        process = processResponse;
      });

      return process;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async getProcesses(user: User) {
    try {
      const isAdmin = user.roles.includes('admin');

      const processes = await this.prisma.process.findMany({
        where: isAdmin
          ? {}
          : {
              managedByID: user.id,
              status: {
                not: 'deleted',
              },
            },
      });

      return processes;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async getProcessById(processId: string, user: User) {
    try {
      const isAdmin = user.roles.includes('admin');
      const stageProcess = await this.prisma.process.findFirst({
        select: {
          id: true,
          caseFileNumber: true,
          courtNumber: true,
          type: true,
          status: true,
          defendant: true,
          defendantId: true,
          stages: {
            select: {
              id: true,
              name: true,
              description: true,
              order: true,
              status: true,
              main: true,
              processId: true,
            },
            where: {
              status: {
                not: 'deleted',
              },
            },
            orderBy: { order: 'asc' },
          },
        },
        where: {
          id: processId,
          status: {
            not: 'deleted',
          },
          ...(!isAdmin && {
            managedByID: user.id,
          }),
        },
      });

      if (!stageProcess) {
        throw new NotFoundException('Proceso no encontrado.');
      }

      const stagesIds = stageProcess.stages.map((stage) => stage.id);

      const substages = await this.prisma.processSubstage.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          order: true,
          stageId: true,
          parentSubstageId: true,
        },
        where: {
          stageId: { in: stagesIds },
          status: {
            not: 'deleted',
          },
        },
        orderBy: { order: 'asc' },
      });

      const substagesByStage = buildTree(substages);

      const stagesWithSubstages = stageProcess.stages.map((stage) => ({
        ...stage,
        childrenSubstages: substagesByStage[stage.id] ?? [],
      }));

      const process = {
        ...stageProcess,
        stages: stagesWithSubstages,
      };

      return process;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async deactivateProcess(
    id: string,
    processDeactivateDto: ProcessDeactivateDto,
    user: User,
  ) {
    try {
      const { reason } = processDeactivateDto;

      return await this.prisma.$transaction(async (tx) => {
        const process = await this.lockAndValidateProcess(tx, id, user);

        if (process.status === 'created') {
          await tx.process.delete({
            where: { id },
          });
        } else {
          await tx.process.update({
            where: { id },
            data: {
              status: 'deleted',
            },
          });
        }

        const dataLog: CreateLog = {
          userId: user.id,
          action:
            process.status === 'created'
              ? LogActions.process.delete
              : LogActions.process.deactivate,
          entity: LogEntities.process,
          affected: id,
          description: reason,
        };

        await this.logsService.create(dataLog, tx);

        return;
      });
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async initProcess(processId: string, user: User) {
    const userId = user.id;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const process = await this.lockAndValidateProcess(tx, processId, user);

        if (process.status !== 'created') {
          throw new BadRequestException('El proceso ya fue iniciado.');
        }

        await tx.processStage.createMany({
          data: [
            {
              name: 'Denuncia del juicio sucesorio',
              description:
                'Etapa inicial en la que se presenta la solicitud para iniciar el procedimiento sucesorio ante la autoridad competente.',
              status: 'opened',
              order: 1,
              processId,
              main: true,
            },
            {
              name: 'Nombramiento de herederos y albacea',
              description:
                'Se determina quiénes son los herederos con derecho a la sucesión y se designa al albacea encargado de administrar la herencia.',
              status: 'created',
              order: 2,
              processId,
              main: true,
            },
            {
              name: 'Inventario y avalúo',
              description:
                'Se identifican, registran y valoran los bienes, derechos y obligaciones que integran el patrimonio del autor de la sucesión.',
              status: 'created',
              order: 3,
              processId,
              main: true,
            },
            {
              name: 'Partición y adjudicación',
              description:
                'Se distribuyen los bienes de la herencia entre los herederos conforme a la ley o al testamento.',
              status: 'created',
              order: 4,
              processId,
              main: true,
            },
            {
              name: 'Sentencia',
              description:
                'Se emite la resolución judicial que concluye el procedimiento sucesorio y formaliza la adjudicación de los bienes.',
              status: 'created',
              order: 5,
              processId,
              main: true,
            },
          ],
        });

        await tx.process.update({
          where: {
            id: processId,
          },

          data: {
            status: 'opened',
          },
        });

        const dataLog: CreateLog = {
          userId,

          affected: processId,

          entity: LogEntities.process,

          action: LogActions.process.init,

          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  async createSubstage(
    stageId: string,
    createSubstageDto: CreateSubstageDto,
    user: User,
  ) {
    const userId = user.id;
    const { name, description, parentSubstageId } = createSubstageDto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const target = await tx.processStage.findUnique({
          where: {
            id: stageId,
          },
          select: {
            processId: true,
          },
        });

        if (!target) {
          throw new NotFoundException('La etapa no fue encontrada.');
        }

        await this.lockAndValidateProcess(tx, target.processId, user);

        await lockStage(tx, stageId);

        const stage = await tx.processStage.findUnique({
          where: {
            id: stageId,
          },
        });

        if (!stage) {
          throw new Error('The stage was not found');
        }

        if (stage.status !== 'opened') {
          throw new Error('The stage must be opened to create a substage');
        }

        if (parentSubstageId) {
          const parent = await tx.processSubstage.findFirst({
            where: {
              id: parentSubstageId,
              stageId,
              status: 'opened',
            },

            select: {
              id: true,
            },
          });

          if (!parent) {
            throw new Error(
              'The parent substage was not found or is not opened',
            );
          }
        }

        const count = await tx.processSubstage.count({
          where: {
            stageId,
            status: {
              not: 'deleted',
            },
          },
        });

        const newSubStage = await tx.processSubstage.create({
          data: {
            name,
            description,
            stageId,
            status: 'opened',
            order: count + 1,
            parentSubstageId: parentSubstageId ?? null,
          },
        });

        await this.syncOpenSubstages(tx, stageId);

        const dataLog: CreateLog = {
          userId,
          action: LogActions.process.substage.create,
          entity: LogEntities.substage,
          affected: newSubStage.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return newSubStage;
      });
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async getSubStageById(subStageId: string, user: User) {
    try {
      const substage = await this.prisma.processSubstage.findFirst({
        include: {
          digitalFolders: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              name: true,
              description: true,
              _count: {
                select: {
                  digitalFiles: {
                    where: {
                      deletedAt: null,
                    },
                  },
                },
              },
            },
          },
          tasks: {
            where: {
              deletedAt: null,
            },

            orderBy: {
              dueDate: 'asc',
            },
          },
        },
        where: {
          id: subStageId,
          status: {
            not: 'deleted',
          },
          stage: {
            status: {
              not: 'deleted',
            },
            process: {
              status: {
                not: 'deleted',
              },
              ...(!user.roles.includes('admin') && {
                managedByID: user.id,
              }),
            },
          },
        },
      });

      if (!substage) {
        throw new NotFoundException('La subetapa no fue encontrada.');
      }

      return substage;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async deactivateSubstage(
    substageId: string,
    deactivateSubstageDto: DeactivateSubstageDto,
    user: User,
  ) {
    const userId = user.id;
    try {
      const { reason } = deactivateSubstageDto;

      return await this.prisma.$transaction(async (tx) => {
        const target = await tx.processSubstage.findUnique({
          where: {
            id: substageId,
          },
          select: {
            stageId: true,
            stage: {
              select: {
                processId: true,
              },
            },
          },
        });

        if (!target) {
          throw new NotFoundException('La subetapa no fue encontrada.');
        }

        await this.lockAndValidateProcess(tx, target.stage.processId, user);
        await lockStage(tx, target.stageId);

        const subStage = await tx.processSubstage.findFirst({
          where: {
            id: substageId,
            status: {
              not: 'deleted',
            },
          },
          select: {
            id: true,
            stageId: true,
            status: true,
          },
        });

        if (!subStage) {
          throw new Error('The substage was not found!');
        }

        if (subStage.status !== 'opened') {
          throw new BadRequestException(
            'Una subetapa cerrada no puede eliminarse.',
          );
        }

        const substages = await tx.processSubstage.findMany({
          where: {
            stageId: subStage.stageId,
            status: {
              not: 'deleted',
            },
          },
          select: {
            id: true,
            parentSubstageId: true,
            status: true,
          },
        });

        const subtreeIds = this.getSubstageTreeIds(substageId, substages);

        const subtreeIdSet = new Set(subtreeIds);

        const closedSubstage = substages.find(
          (substage) =>
            subtreeIdSet.has(substage.id) && substage.status === 'closed',
        );

        if (closedSubstage) {
          throw new BadRequestException(
            'No puede eliminarse esta subetapa porque contiene una subetapa cerrada.',
          );
        }

        await tx.processSubstage.updateMany({
          where: {
            id: {
              in: subtreeIds,
            },
          },
          data: {
            status: 'deleted',
          },
        });

        await this.syncOpenSubstages(tx, subStage.stageId);

        const dataLog: CreateLog = {
          userId,
          action: LogActions.process.substage.delete,
          entity: LogEntities.substage,
          affected: subStage.id,
          description: reason,
        };

        await this.logsService.create(dataLog, tx);
        return;
      });
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async createStage(
    stageId: string,
    createStageDto: CreateStageDto,
    user: User,
  ) {
    const userId = user.id;
    const { name, description } = createStageDto;

    try {
      const target = await this.prisma.processStage.findFirst({
        where: {
          id: stageId,

          status: {
            not: 'deleted',
          },
        },

        select: {
          processId: true,
        },
      });

      if (!target) {
        throw new NotFoundException('La etapa no fue encontrada.');
      }

      return await this.prisma.$transaction(async (tx) => {
        await this.lockAndValidateProcess(tx, target.processId, user);

        await lockStage(tx, stageId);

        const currentStage = await tx.processStage.findFirst({
          where: {
            id: stageId,

            status: {
              not: 'deleted',
            },
          },

          select: {
            id: true,
            processId: true,
            order: true,
            status: true,

            process: {
              select: {
                status: true,
              },
            },
          },
        });

        if (!currentStage) {
          throw new NotFoundException('La etapa no fue encontrada.');
        }

        if (currentStage.process.status !== 'opened') {
          throw new BadRequestException('El proceso no se encuentra abierto.');
        }

        if (currentStage.status !== 'closed') {
          throw new BadRequestException(
            'La etapa anterior debe estar cerrada para crear una etapa intermedia.',
          );
        }

        const openedStage = await tx.processStage.findFirst({
          where: {
            processId: currentStage.processId,
            status: 'opened',
          },
          select: {
            id: true,
          },
        });

        if (openedStage) {
          throw new BadRequestException(
            'El proceso ya tiene una etapa abierta.',
          );
        }

        const nextStage = await tx.processStage.findFirst({
          where: {
            processId: currentStage.processId,
            status: {
              not: 'deleted',
            },
            order: {
              gt: currentStage.order,
            },
          },
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            order: true,
            status: true,
          },
        });

        if (nextStage && nextStage.status !== 'created') {
          throw new BadRequestException(
            'No es posible crear una etapa intermedia desde esta posición.',
          );
        }

        const newOrder = currentStage.order + 1;

        await tx.processStage.updateMany({
          where: {
            processId: currentStage.processId,

            status: {
              not: 'deleted',
            },

            order: {
              gte: newOrder,
            },
          },

          data: {
            order: {
              increment: 1,
            },
          },
        });

        const newStage = await tx.processStage.create({
          data: {
            name,
            description,

            order: newOrder,

            status: 'opened',

            main: false,

            processId: currentStage.processId,
          },
        });

        const dataLog: CreateLog = {
          userId,

          action: LogActions.process.stage.create,

          entity: LogEntities.stage,

          affected: newStage.id,

          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return newStage;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  async getStageById(stageId: string, user: User) {
    try {
      const stage = await this.prisma.processStage.findFirst({
        include: {
          digitalFolders: {
            where: {
              deletedAt: null,
              substageId: null,
            },
            select: {
              id: true,
              name: true,
              description: true,
              _count: {
                select: {
                  digitalFiles: {
                    where: {
                      deletedAt: null,
                    },
                  },
                },
              },
            },
          },
          tasks: {
            where: {
              id: stageId,
              status: {
                not: 'deleted',
              },
              process: {
                status: {
                  not: 'deleted',
                },
                ...(!user.roles.includes('admin') && {
                  managedByID: user.id,
                }),
              },
            },

            orderBy: {
              dueDate: 'asc',
            },
          },
        },

        where: {
          id: stageId,
          status: {
            not: 'deleted',
          },
        },
      });

      if (!stage) {
        throw new NotFoundException('La etapa no fue encontrada.');
      }

      return stage;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async deactivateStage(
    stageId: string,
    deactivateSubstageDto: DeactivateSubstageDto,
    user: User,
  ) {
    const userId = user.id;
    try {
      const { reason } = deactivateSubstageDto;

      const target = await this.prisma.processStage.findUnique({
        where: {
          id: stageId,
        },
        select: {
          processId: true,
        },
      });

      if (!target) {
        throw new NotFoundException('La etapa no fue encontrada.');
      }

      return await this.prisma.$transaction(async (tx) => {
        await this.lockAndValidateProcess(tx, target.processId, user);
        await lockStage(tx, stageId);

        const stage = await tx.processStage.findFirst({
          where: {
            id: stageId,
            status: {
              not: 'deleted',
            },
          },
          select: {
            id: true,
            processId: true,
            order: true,
            main: true,
            status: true,
          },
        });

        if (!stage) {
          throw new NotFoundException('La etapa no fue encontrada.');
        }

        if (stage.main) {
          throw new BadRequestException(
            'Una etapa principal no puede eliminarse.',
          );
        }

        if (stage.status === 'closed') {
          throw new BadRequestException(
            'Una etapa cerrada no puede eliminarse.',
          );
        }

        if (stage.status !== 'opened') {
          throw new BadRequestException(
            'La etapa debe estar abierta para poder eliminarse.',
          );
        }

        await tx.processStage.update({
          where: {
            id: stageId,
          },
          data: {
            status: 'deleted',
          },
        });

        await tx.processStage.updateMany({
          where: {
            processId: stage.processId,
            status: {
              not: 'deleted',
            },
            order: {
              gt: stage.order,
            },
          },
          data: {
            order: {
              decrement: 1,
            },
          },
        });

        const dataLog: CreateLog = {
          userId,
          action: LogActions.process.stage.delete,
          entity: LogEntities.stage,
          affected: stage.id,
          description: reason,
        };

        await this.logsService.create(dataLog, tx);

        return;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  async closeSubstage(substageId: string, user: User) {
    const userId = user.id;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const target = await tx.processSubstage.findUnique({
          where: {
            id: substageId,
          },
          select: {
            stageId: true,
            stage: {
              select: {
                processId: true,
              },
            },
          },
        });

        if (!target) {
          throw new NotFoundException('La subetapa no fue encontrada.');
        }

        await this.lockAndValidateProcess(tx, target.stage.processId, user);

        await lockStage(tx, target.stageId);

        const substage = await tx.processSubstage.findFirst({
          where: {
            id: substageId,
            status: {
              not: 'deleted',
            },
          },
          select: {
            id: true,
            status: true,
            stageId: true,
            digitalFolders: {
              where: {
                deletedAt: null,
              },
              select: {
                id: true,
                name: true,
                _count: {
                  select: {
                    digitalFiles: {
                      where: {
                        deletedAt: null,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!substage) {
          throw new NotFoundException('La subetapa no fue encontrada.');
        }

        if (substage.status === 'closed') {
          return {
            id: substage.id,

            status: substage.status,
          };
        }

        if (substage.status !== 'opened') {
          throw new BadRequestException(
            'La subetapa debe estar abierta para poder cerrarse.',
          );
        }

        const emptyFolder = substage.digitalFolders.find(
          (folder) => folder._count.digitalFiles === 0,
        );

        if (emptyFolder) {
          throw new BadRequestException(
            `La carpeta "${emptyFolder.name}" no contiene documentos.`,
          );
        }

        const updatedSubstage = await tx.processSubstage.update({
          where: {
            id: substage.id,
          },
          data: {
            status: 'closed',
          },
        });

        await this.syncOpenSubstages(tx, substage.stageId);

        const dataLog: CreateLog = {
          userId,
          action: LogActions.process.substage.close,
          entity: LogEntities.substage,
          affected: substage.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return updatedSubstage;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  async closeStage(stageId: string, user: User) {
    const userId = user.id;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const target = await tx.processStage.findUnique({
          where: {
            id: stageId,
          },
          select: {
            processId: true,
          },
        });

        if (!target) {
          throw new NotFoundException('La etapa no fue encontrada.');
        }

        await this.lockAndValidateProcess(tx, target.processId, user);

        await lockStage(tx, stageId);

        const stage = await tx.processStage.findFirst({
          where: {
            id: stageId,
            status: {
              not: 'deleted',
            },
          },

          select: {
            id: true,
            status: true,
            openSubstages: true,

            digitalFolders: {
              where: {
                deletedAt: null,
                substageId: null,
              },

              select: {
                id: true,
                name: true,

                _count: {
                  select: {
                    digitalFiles: {
                      where: {
                        deletedAt: null,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!stage) {
          throw new NotFoundException('La etapa no fue encontrada.');
        }

        if (stage.status === 'closed') {
          return {
            canClose: true as const,

            data: {
              id: stage.id,
              status: stage.status,
              openSubstages: stage.openSubstages,
            },
          };
        }

        if (stage.status !== 'opened') {
          throw new BadRequestException(
            'La etapa debe estar abierta para poder cerrarse.',
          );
        }

        const realOpenSubstages = await tx.processSubstage.count({
          where: {
            stageId,
            status: 'opened',
          },
        });

        if (stage.openSubstages !== realOpenSubstages) {
          await tx.processStage.update({
            where: {
              id: stageId,
            },

            data: {
              openSubstages: realOpenSubstages,
            },
          });
        }

        if (realOpenSubstages > 0) {
          return {
            canClose: false as const,

            reason: `La etapa tiene ${realOpenSubstages} subetapa${
              realOpenSubstages === 1 ? '' : 's'
            } abierta${realOpenSubstages === 1 ? '' : 's'}.`,
          };
        }

        const emptyFolder = stage.digitalFolders.find(
          (folder) => folder._count.digitalFiles === 0,
        );

        if (emptyFolder) {
          return {
            canClose: false as const,

            reason: `La carpeta "${emptyFolder.name}" no contiene documentos.`,
          };
        }

        const updatedStage = await tx.processStage.update({
          where: {
            id: stageId,
          },

          data: {
            status: 'closed',
            openSubstages: 0,
          },

          select: {
            id: true,
            status: true,
            openSubstages: true,
          },
        });

        const dataLog: CreateLog = {
          userId,

          action: LogActions.process.stage.close,

          entity: LogEntities.stage,

          affected: stage.id,

          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return {
          canClose: true as const,
          data: updatedStage,
        };
      });

      if (!result.canClose) {
        throw new BadRequestException(result.reason);
      }
      return result.data;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  async advanceStage(stageId: string, user: User) {
    const userId = user.id;
    try {
      const target = await this.prisma.processStage.findFirst({
        where: {
          id: stageId,
          status: {
            not: 'deleted',
          },
        },
        select: {
          processId: true,
        },
      });

      if (!target) {
        throw new NotFoundException('La etapa no fue encontrada.');
      }

      return await this.prisma.$transaction(async (tx) => {
        await this.lockAndValidateProcess(tx, target.processId, user);

        const currentStage = await tx.processStage.findFirst({
          where: {
            id: stageId,
            status: {
              not: 'deleted',
            },
          },
          select: {
            id: true,
            order: true,
            status: true,
            processId: true,
            process: {
              select: {
                status: true,
              },
            },
          },
        });

        if (!currentStage) {
          throw new NotFoundException('La etapa no fue encontrada.');
        }

        if (currentStage.process.status !== 'opened') {
          throw new BadRequestException('El proceso no se encuentra abierto.');
        }

        if (currentStage.status !== 'closed') {
          throw new BadRequestException(
            'La etapa actual debe estar cerrada antes de avanzar.',
          );
        }

        const nextStage = await tx.processStage.findFirst({
          where: {
            processId: currentStage.processId,
            status: {
              not: 'deleted',
            },
            order: {
              gt: currentStage.order,
            },
          },
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            name: true,
            order: true,
            status: true,
          },
        });

        if (!nextStage) {
          throw new BadRequestException(
            'No existe una etapa siguiente para avanzar.',
          );
        }

        if (nextStage.status !== 'created') {
          throw new BadRequestException(
            'La siguiente etapa no está disponible para ser abierta.',
          );
        }

        const openedStage = await tx.processStage.findFirst({
          where: {
            processId: currentStage.processId,

            status: 'opened',
          },
          select: {
            id: true,
          },
        });

        if (openedStage) {
          throw new BadRequestException(
            'El proceso ya tiene una etapa abierta.',
          );
        }

        const updatedStage = await tx.processStage.update({
          where: {
            id: nextStage.id,
          },
          data: {
            status: 'opened',
          },
          select: {
            id: true,
            name: true,
            order: true,
            status: true,
          },
        });

        const dataLog: CreateLog = {
          userId,
          action: LogActions.process.stage.advance,
          entity: LogEntities.stage,
          affected: updatedStage.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return {
          previousStageId: currentStage.id,

          stage: updatedStage,
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  async finalizeProcess(stageId: string, user: User) {
    const userId = user.id;
    try {
      const target = await this.prisma.processStage.findFirst({
        where: {
          id: stageId,
          status: {
            not: 'deleted',
          },
        },
        select: {
          processId: true,
        },
      });

      if (!target) {
        throw new NotFoundException('La etapa no fue encontrada.');
      }

      return await this.prisma.$transaction(async (tx) => {
        await this.lockAndValidateProcess(tx, target.processId, user);
        await lockStage(tx, stageId);

        const process = await tx.process.findUnique({
          where: {
            id: target.processId,
          },

          select: {
            id: true,
            status: true,
          },
        });

        if (!process) {
          throw new NotFoundException('El proceso no fue encontrado.');
        }

        if (process.status === 'closed') {
          return {
            id: process.id,
            status: process.status,
          };
        }

        if (process.status !== 'opened') {
          throw new BadRequestException(
            'El proceso debe estar abierto para poder finalizarse.',
          );
        }

        const currentStage = await tx.processStage.findFirst({
          where: {
            id: stageId,
            processId: process.id,
            status: {
              not: 'deleted',
            },
          },
          select: {
            id: true,
            order: true,
            status: true,
          },
        });

        if (!currentStage) {
          throw new NotFoundException('La etapa no fue encontrada.');
        }

        if (currentStage.status !== 'closed') {
          throw new BadRequestException(
            'La última etapa debe estar cerrada antes de finalizar el proceso.',
          );
        }

        const laterStage = await tx.processStage.findFirst({
          where: {
            processId: process.id,
            status: {
              not: 'deleted',
            },
            order: {
              gt: currentStage.order,
            },
          },

          select: {
            id: true,
          },
        });

        if (laterStage) {
          throw new BadRequestException(
            'No es posible finalizar el proceso porque existen etapas posteriores.',
          );
        }

        const pendingStage = await tx.processStage.findFirst({
          where: {
            processId: process.id,
            status: {
              in: ['opened', 'created'],
            },
          },
          select: {
            id: true,
          },
        });

        if (pendingStage) {
          throw new BadRequestException(
            'No es posible finalizar el proceso porque existen etapas pendientes.',
          );
        }

        const updatedProcess = await tx.process.update({
          where: {
            id: process.id,
          },
          data: {
            status: 'closed',
          },
          select: {
            id: true,
            status: true,
          },
        });

        const dataLog: CreateLog = {
          userId,
          action: LogActions.process.close,
          entity: LogEntities.process,
          affected: process.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return updatedProcess;
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
    }
  }

  private async syncOpenSubstages(
    tx: Prisma.TransactionClient,
    stageId: string,
  ): Promise<number> {
    const openSubstages = await tx.processSubstage.count({
      where: {
        stageId,
        status: 'opened',
      },
    });

    await tx.processStage.update({
      where: {
        id: stageId,
      },
      data: {
        openSubstages,
      },
    });

    return openSubstages;
  }

  private getSubstageTreeIds(
    rootId: string,
    substages: {
      id: string;
      parentSubstageId: string | null;
    }[],
  ): string[] {
    const ids: string[] = [];

    const pending = [rootId];

    while (pending.length > 0) {
      const currentId = pending.shift();

      if (!currentId) continue;

      ids.push(currentId);

      const children = substages.filter(
        (substage) => substage.parentSubstageId === currentId,
      );

      for (const child of children) {
        pending.push(child.id);
      }
    }

    return ids;
  }

  private async lockAndValidateProcess(
    tx: Prisma.TransactionClient,
    processId: string,
    user: User,
  ) {
    const isAdmin = user.roles.includes('admin');

    const where: Prisma.ProcessWhereInput = {
      id: processId,
      status: {
        not: 'deleted',
      },
      ...(!isAdmin && {
        managedByID: user.id,
      }),
    };

    const existingProcess = await tx.process.findFirst({
      where,
      select: {
        id: true,
      },
    });

    if (!existingProcess) {
      throw new NotFoundException('Proceso no encontrado.');
    }

    await lockProcess(tx, processId);

    const process = await tx.process.findFirst({
      where,
      select: {
        id: true,
        status: true,
      },
    });

    if (!process) {
      throw new NotFoundException('Proceso no encontrado.');
    }

    return process;
  }

  private handleDBErrors(error): never {
    if (error instanceof HttpException) {
      throw error;
    } else if (
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
