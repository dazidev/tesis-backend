import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rename, unlink, writeFile, stat } from 'fs/promises';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { LogsService } from '../logs/logs.service';
import { Prisma } from 'src/generated/prisma/client';
import { CreateDigitalFileDto, CreateFolderDto } from './dto';

import { CreateLog } from '../logs/interfaces';
import { LogActions, LogEntities } from 'src/common';
import { type User, ValidRoles } from '../auth/interfaces';
import { createReadStream, ReadStream } from 'fs';

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
          digitalFiles: {
            where: {
              deletedAt: null,
            },
          },
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
    const { name, description } = createDigitalFileDto;
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

            name,
            description,

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

  async viewFile(
    user: User,
    fileId: string,
  ): Promise<{
    id: string;
    name: string;
    size: number;
    stream: ReadStream;
  }> {
    const { digitalFile, absolutePath, fileStats } =
      await this.getAccessibleFile(user, fileId);

    const dataLog: CreateLog = {
      userId: user.id,
      action: LogActions.file.view,
      entity: LogEntities.file,
      affected: digitalFile.id,
      description: 'Visualización de archivo PDF',
    };

    await this.logsService.create(dataLog, this.prisma);

    return {
      id: digitalFile.id,
      name: digitalFile.name,
      size: fileStats.size,
      stream: createReadStream(absolutePath),
    };
  }

  /*async downloadFile(
    user: User,
    fileId: string,
  ): Promise<{
    id: string;
    originalName: string;
    size: number;
    stream: ReadStream;
  }> {
    const { digitalFile, absolutePath, fileStats } =
      await this.getAccessibleFile(user, fileId);

    const dataLog: CreateLog = {
      userId: user.id,
      action: LogActions.file.download,
      entity: LogEntities.file,
      affected: digitalFile.id,
      description: 'Descarga de archivo PDF',
    };

    await this.logsService.create(dataLog, this.prisma);

    return {
      id: digitalFile.id,
      originalName: digitalFile.originalName,
      size: fileStats.size,
      stream: createReadStream(absolutePath),
    };
  }*/

  async deleteFile(userId: string, fileId: string) {
    let originalAbsolutePath: string | undefined;
    let movedAbsolutePath: string | undefined;
    let databaseUpdated = false;

    try {
      const digitalFile = await this.prisma.digitalFile.findFirst({
        where: {
          id: fileId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          storagePath: true,
          digitalFolderId: true,
        },
      });

      if (!digitalFile) {
        throw new NotFoundException('Archivo no encontrado');
      }

      if (!digitalFile.storagePath) {
        throw new InternalServerErrorException(
          'El archivo no tiene una ubicación física registrada',
        );
      }

      const now = new Date();

      const twentyFourHours = 24 * 60 * 60 * 1000;

      const fileAge = now.getTime() - digitalFile.createdAt.getTime();

      const hardDelete = fileAge < twentyFourHours;

      const filesRoot = this.getFilesRoot();

      originalAbsolutePath = this.resolveStoragePath(
        filesRoot,
        digitalFile.storagePath,
      );

      if (hardDelete) {
        const deletingDirectory = path.join(
          filesRoot,
          'digital-files',
          '.deleting',
        );

        await mkdir(deletingDirectory, {
          recursive: true,
        });

        movedAbsolutePath = path.join(
          deletingDirectory,
          `${fileId}-${randomUUID()}.pdf`,
        );

        await rename(originalAbsolutePath, movedAbsolutePath);

        await this.prisma.$transaction(async (tx) => {
          await tx.digitalFile.update({
            where: {
              id: fileId,
            },
            data: {
              deletedAt: now,
              storagePath: null,
            },
          });

          const dataLog: CreateLog = {
            userId,
            action: LogActions.file.delete,
            entity: LogEntities.file,
            affected: fileId,
            description:
              'Archivo eliminado físicamente antes de cumplir 24 horas',
          };

          await this.logsService.create(dataLog, tx);
        });

        databaseUpdated = true;
        await unlink(movedAbsolutePath);

        return {
          id: fileId,
          deletedAt: now,
          physicallyDeleted: true,
        };
      }

      const deletedStoragePath = path.posix.join(
        'digital-files',
        'deleted',
        digitalFile.digitalFolderId,
        `${fileId}.pdf`,
      );

      const deletedDirectory = path.join(
        filesRoot,
        'digital-files',
        'deleted',
        digitalFile.digitalFolderId,
      );

      await mkdir(deletedDirectory, {
        recursive: true,
      });

      movedAbsolutePath = path.join(deletedDirectory, `${fileId}.pdf`);

      await rename(originalAbsolutePath, movedAbsolutePath);

      await this.prisma.$transaction(async (tx) => {
        await tx.digitalFile.update({
          where: {
            id: fileId,
          },
          data: {
            deletedAt: now,
            storagePath: deletedStoragePath,
          },
        });

        const dataLog: CreateLog = {
          userId,
          action: LogActions.file.deactivate,
          entity: LogEntities.file,
          affected: fileId,
          description: 'Archivo movido al almacenamiento de eliminados',
        };

        await this.logsService.create(dataLog, tx);
      });

      databaseUpdated = true;

      return {
        id: fileId,
        deletedAt: now,
        physicallyDeleted: false,
      };
    } catch (error: unknown) {
      if (!databaseUpdated && originalAbsolutePath && movedAbsolutePath) {
        await rename(movedAbsolutePath, originalAbsolutePath).catch(
          () => undefined,
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      this.handleDBErrors(error);
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

  private async getAccessibleFile(user: User, fileId: string) {
    const digitalFile = await this.prisma.digitalFile.findFirst({
      where: {
        id: fileId,
        deletedAt: null,

        digitalFolder: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        name: true,
        storagePath: true,
        mimeType: true,

        digitalFolder: {
          select: {
            stage: {
              select: {
                process: {
                  select: {
                    managedByID: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!digitalFile) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const isAdmin = user.roles.includes(ValidRoles.admin);

    const isLawyer = user.roles.includes(ValidRoles.lawyer);

    const processManagerId =
      digitalFile.digitalFolder?.stage.process.managedByID;

    //! todo: Validar esta validación del abogado.
    const lawyerHasAccess = isLawyer && processManagerId === user.id;

    if (!isAdmin && !lawyerHasAccess) {
      throw new NotFoundException('Archivo no encontrado');
    }

    if (!digitalFile.storagePath) {
      throw new NotFoundException('Archivo físico no disponible');
    }

    const filesRoot = this.getFilesRoot();

    const absolutePath = this.resolveStoragePath(
      filesRoot,
      digitalFile.storagePath,
    );

    let fileStats;

    try {
      fileStats = await stat(absolutePath);
    } catch {
      throw new NotFoundException('Archivo físico no encontrado');
    }

    if (!fileStats.isFile()) {
      throw new NotFoundException('Archivo físico no encontrado');
    }

    return {
      digitalFile,
      absolutePath,
      fileStats,
    };
  }

  private getFilesRoot(): string {
    return path.resolve(
      this.configService.get<string>('FILES_DIR') ??
        path.join(process.cwd(), 'uploads'),
    );
  }

  private resolveStoragePath(filesRoot: string, storagePath: string): string {
    const absolutePath = path.resolve(filesRoot, storagePath);

    const expectedRoot = `${filesRoot}${path.sep}`;

    if (!absolutePath.startsWith(expectedRoot)) {
      throw new BadRequestException('Ruta de archivo inválida');
    }

    return absolutePath;
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
