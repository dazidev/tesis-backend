import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rename, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { LogsService } from '../logs/logs.service';
import { Prisma } from 'src/generated/prisma/client';
import { CreateDigitalFileDto, CreateFolderDto } from './dto';

import { CreateLog } from '../logs/interfaces';
import { LogActions, LogEntities } from 'src/common';

@Injectable()
export class FolderService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
    private configService: ConfigService,
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

  async uploadFile(
    userId: string,
    folderId: string,
    createDigitalFileDto: CreateDigitalFileDto,
    file: Express.Multer.File,
  ) {
    let savedAbsolutePath: string | undefined;

    try {
      const folder = await this.prisma.digitalFolder.findFirst({
        where: {
          id: folderId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!folder) {
        throw new NotFoundException('Folder not found');
      }

      const fileId = randomUUID();

      const { storagePath, absolutePath } = await this.savePdf(
        folderId,
        fileId,
        file.buffer,
      );

      savedAbsolutePath = absolutePath;

      return await this.prisma.$transaction(async (tx) => {
        const digitalFile = await tx.digitalFile.create({
          data: {
            id: fileId,

            name: createDigitalFileDto.name,
            description: createDigitalFileDto.description,

            originalName: file.originalname,
            storagePath,
            mimeType: 'application/pdf',
            size: file.size,

            createdById: userId,
            digitalFolderId: folderId,
          },
        });

        const dataLog: CreateLog = {
          userId,
          action: LogActions.file.create,
          entity: LogEntities.file,
          affected: digitalFile.id,
          description: '',
        };

        await this.logsService.create(dataLog, tx);

        return digitalFile;
      });
    } catch (error: unknown) {
      if (savedAbsolutePath) {
        await unlink(savedAbsolutePath).catch(() => undefined);
      }

      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.handleDBErrors(error);
      }

      throw new InternalServerErrorException('Error uploading digital file');
    }
  }

  private async savePdf(
    folderId: string,
    fileId: string,
    buffer: Buffer,
  ): Promise<{
    storagePath: string;
    absolutePath: string;
  }> {
    const filesRoot =
      this.configService.get<string>('FILES_DIR') ??
      path.join(process.cwd(), 'uploads');

    const storageName = `${fileId}.pdf`;

    const directory = path.join(filesRoot, 'digital-files', folderId);

    const storagePath = path.posix.join('digital-files', folderId, storageName);

    const absolutePath = path.join(directory, storageName);

    const tempPath = path.join(directory, `${fileId}.${randomUUID()}.tmp`);

    await mkdir(directory, {
      recursive: true,
    });

    try {
      await writeFile(tempPath, buffer, {
        flag: 'wx',
      });

      await rename(tempPath, absolutePath);

      return {
        storagePath,
        absolutePath,
      };
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);

      throw error;
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
