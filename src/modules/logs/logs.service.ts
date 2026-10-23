import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLog } from './interfaces';
import { Prisma } from 'src/generated/prisma/client';
import { FindLogsQueryDto } from './dto';
import { LogActions, LogEntities } from 'src/common';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateLog, tx: Prisma.TransactionClient | PrismaService) {
    return tx.log.create({
      data,
    });
  }

  async findAll(findLogsQueryDto: FindLogsQueryDto) {
    const { entity, action, userId, userSearch, from, to } = findLogsQueryDto;

    const page = Number(findLogsQueryDto.page ?? 1);
    const limit = Number(findLogsQueryDto.limit ?? 20);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Los parámetros de paginación no son válidos.',
      );
    }

    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'La página solicitada excede el rango permitido.',
      );
    }

    if (from && to && new Date(from) > new Date(to)) {
      throw new BadRequestException(
        'La fecha inicial no puede ser mayor que la fecha final.',
      );
    }

    if (action) {
      const categories = this.getFilters().categories;

      const validActions = entity
        ? (categories.find((category) => category.entity === entity)?.actions ??
          [])
        : categories.flatMap((category) => category.actions);

      if (!validActions.includes(action)) {
        throw new BadRequestException(
          'La acción seleccionada no corresponde a una categoría válida.',
        );
      }
    }

    const where: Prisma.LogWhereInput = {};

    if (entity) {
      where.entity = entity;
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (userSearch?.trim()) {
      const terms = userSearch.trim().split(/\s+/);

      where.user = {
        is: {
          AND: terms.map((term) => ({
            OR: [
              {
                name: {
                  contains: term,
                  mode: 'insensitive',
                },
              },
              {
                lastname: {
                  contains: term,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: term,
                  mode: 'insensitive',
                },
              },
            ],
          })),
        },
      };
    }

    if (from || to) {
      where.createdAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    const [logs, totalCount] = await this.prisma.$transaction([
      this.prisma.log.findMany({
        where,
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              lastname: true,
              email: true,
            },
          },
          affected: true,
          entity: true,
          action: true,
          description: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.log.count({ where }),
    ]);

    return {
      data: logs,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  getFilters() {
    return {
      categories: [
        {
          entity: LogEntities.user,
          actions: [
            LogActions.admin.deactivateUser,
            LogActions.common.invitationUser,
          ],
        },
        {
          entity: LogEntities.process,
          actions: [
            LogActions.process.create,
            LogActions.process.deactivate,
            LogActions.process.delete,
            LogActions.process.init,
          ],
        },
        {
          entity: LogEntities.stage,
          actions: Object.values(LogActions.process.stage),
        },
        {
          entity: LogEntities.substage,
          actions: Object.values(LogActions.process.substage),
        },
        {
          entity: LogEntities.folder,
          actions: Object.values(LogActions.folder),
        },
        {
          entity: LogEntities.file,
          actions: Object.values(LogActions.file),
        },
        {
          entity: LogEntities.task,
          actions: Object.values(LogActions.task),
        },
      ],
    };
  }
}
