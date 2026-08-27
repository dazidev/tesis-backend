import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStageDto,
  CreateSubstageDto,
  ProcessDeactivateDto,
  ProcessDto,
} from './dto';
import { Prisma } from 'src/generated/prisma/client';
import { buildTree, LogActions, LogEntities } from 'src/common';
import { LogsService } from '../logs/logs.service';
import { CreateLog } from '../logs/interfaces';

@Injectable()
export class ProcessesService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async createProcess(userId: string, processDto: ProcessDto) {
    try {
      const { courtNumber, caseFileNumber, type, managedByID, defendant } =
        processDto;
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
            managedByID: managedByID ?? userId,
            createdById: userId,
          },
        });

        const dataLog: CreateLog = {
          userId,
          action: LogActions.common.createProcess,
          entity: LogEntities.process,
          affected: processResponse.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);

        process = processResponse;
      });

      if (!process) return process;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async getProcesses() {
    try {
      const processes = await this.prisma.process.findMany();

      return processes;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async getProcessById(processId: string) {
    try {
      const stageProcess = await this.prisma.process.findUnique({
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
            },
            orderBy: { order: 'asc' },
          },
        },
        where: { id: processId },
      });

      if (!stageProcess) throw new Error('Process not found.');

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
        where: { stageId: { in: stagesIds } },
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

        const dataLog: CreateLog = {
          userId,
          action:
            process.status === 'created'
              ? LogActions.common.deleteProcess
              : LogActions.common.deactivateProcess,
          entity: LogEntities.process,
          description: reason,
        };

        await this.logsService.create(dataLog, tx);
      });

      return;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async initProcess(processId: string, userId: string) {
    try {
      const processStatus = await this.prisma.process.findUnique({
        select: { status: true },
        where: { id: processId },
      });

      if (!processStatus) throw new Error('Process not found.');

      if (processStatus.status !== 'created')
        throw new Error('Process already initialized.');

      await this.prisma.$transaction(async (tx) => {
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
          data: { status: 'opened' },
          where: { id: processId },
        });

        const dataLog: CreateLog = {
          userId,
          affected: processId,
          entity: LogEntities.process,
          action: LogActions.common.initProcess,
          description: '',
        };

        await this.logsService.create(dataLog, tx);
      });

      return;
    } catch (error: unknown) {
      console.log(error);
      this.handleDBErrors(error);
    }
  }

  async createSubstage(stageId: string, createSubstageDto: CreateSubstageDto) {
    const { name, description, parentSubstageId } = createSubstageDto;
    try {
      const stage = await this.prisma.processStage.findUnique({
        where: { id: stageId },
      });

      if (!stage) throw new Error('The stage was not found');

      const count = await this.prisma.processSubstage.count({
        where: {
          stageId,
        },
      });

      await this.prisma.processSubstage.create({
        data: {
          name,
          description,
          stageId,
          status: 'opened',
          order: count + 1,
          parentSubstageId: parentSubstageId ?? null,
        },
      });

      return;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async createStage(processId: string, createStageDto: CreateStageDto) {
    const { name, description, order } = createStageDto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const processExists = await tx.process.findUnique({
          select: { id: true, stages: { orderBy: { order: 'asc' } } },
          where: { id: processId },
        });
        if (!processExists) throw new Error('Process not found.');

        for (const stage of processExists.stages) {
          if (stage.order >= order) {
            const newOrder = stage.order + 1;
            await tx.processStage.update({
              data: { order: newOrder },
              where: { id: stage.id },
            });
          }
        }

        const newStage = await tx.processStage.create({
          data: {
            name,
            description,
            order,
            status: 'opened',
            processId,
          },
        });
        return newStage;
      });
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
