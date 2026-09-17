import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogsService } from '../logs/logs.service';
import { Prisma } from 'src/generated/prisma/client';
import { CreateFolderDto } from './dto';
import { CreateLog } from '../logs/interfaces';
import { LogActions, LogEntities } from 'src/common';

@Injectable()
export class FolderService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async createFolder(
    userId: string,
    createFolderDto: CreateFolderDto,
    stageId: string,
  ) {
    try {
      const { name, description, substageId } = createFolderDto;
      //! todo: verified stageId and substageId
      return await this.prisma.$transaction(async (tx) => {
        const folder = await tx.digitalFolder.create({
          data: {
            name,
            description,
            stageId,
            substageId,
            createdById: userId,
          },
        });

        const dataLog: CreateLog = {
          userId,
          action: LogActions.folder.create,
          entity: LogEntities.folder,
          affected: folder.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);
        return folder;
      });
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async getFolder(id: string) {
    try {
      const folder = await this.prisma.digitalFolder.findFirst({
        select: {
          id: true,
          name: true,
          description: true,
          substageId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          createdById: true,
          stageId: true,
          digitalFiles: true,
        },
        where: {
          id,
          deletedAt: null,
        },
      });

      return folder;
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
