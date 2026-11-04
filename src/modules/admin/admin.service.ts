import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserInivitationDto } from './dto/user-invitation.dto';
import {
  generateInvitationToken,
  hashToken,
  lockProcess,
  LogActions,
  LogEntities,
} from 'src/common';
import { Prisma } from 'src/generated/prisma/client';
import { BrevoService } from '../infrastructure/services/brevo.service';
import { ConfigService } from '@nestjs/config';
import { UserDeactivateDto } from './dto/user-deactivate.dto';
import { LogsService } from '../logs/logs.service';
import { CreateLog } from '../logs/interfaces';
import { type User, ValidRoles } from '../auth/interfaces';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private readonly brevoService: BrevoService,
    private configService: ConfigService,
    private logsService: LogsService,
  ) {}

  async sendUserInvitation(userInvitationDto: UserInivitationDto, user: User) {
    try {
      const { toEmail, role, processId } = userInvitationDto;

      const isAdmin = user.roles.includes(ValidRoles.admin);
      const isLawyer = user.roles.includes(ValidRoles.lawyer);

      if (!isAdmin && !isLawyer) {
        throw new ForbiddenException(
          'No tiene permisos para invitar usuarios.',
        );
      }

      if (!isAdmin && role !== ValidRoles.client) {
        throw new ForbiddenException(
          'Los abogados únicamente pueden invitar clientes.',
        );
      }

      if (!isAdmin && !processId) {
        throw new BadRequestException(
          'Debe seleccionar un proceso para invitar al cliente.',
        );
      }

      if (processId && role !== ValidRoles.client) {
        throw new BadRequestException(
          'Solo se pueden vincular clientes a los procesos.',
        );
      }

      const email = toEmail.trim().toLowerCase();
      const token = generateInvitationToken();

      const invitationId = await this.prisma.$transaction(async (tx) => {
        if (processId) {
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
            },
          });

          if (!process) {
            throw new NotFoundException('Proceso no encontrado.');
          }
        }

        await tx.$queryRaw<{ locked: number }[]>`
          SELECT 1 AS locked
          FROM pg_advisory_xact_lock(hashtext(${email}))
        `;

        const existingUser = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existingUser) {
          throw new ConflictException(
            'El correo ya pertenece a una cuenta registrada. ' +
              'Si es un cliente, utilice la opción Vincular cliente existente.',
          );
        }

        const pendingInvitation = await tx.userInvitation.findFirst({
          where: {
            toEmail: email,
            isUsed: false,
            canceledAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
          select: { id: true },
        });

        if (pendingInvitation) {
          throw new ConflictException(
            'Ya existe una invitación vigente para este correo.',
          );
        }

        const invitation = await tx.userInvitation.create({
          data: {
            token: hashToken(token),
            toEmail: email,
            role,
            processId: processId ?? null,
            createdById: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        const dataLog: CreateLog = {
          userId: user.id,
          action: LogActions.common.invitationUser,
          entity: LogEntities.user,
          affected: email,
          description: processId
            ? `Invitación de cliente al proceso ${processId}`
            : `Invitación de usuario con rol ${role}`,
        };

        await this.logsService.create(dataLog, tx);

        return invitation.id;
      });

      const invitationLink = `/auth/register?token=${token}`;

      const msj = `Para registrarse use el siguiente link: ${
        this.configService.getOrThrow<string>('API_LINK') + invitationLink
      }`;

      const emailSent = await this.brevoService.sendEmail(
        email,
        'Invitación de registro',
        msj,
      );

      await this.prisma.userInvitation.updateMany({
        where: {
          id: invitationId,
          token: hashToken(token),
        },
        data: emailSent
          ? {
              emailSentAt: new Date(),
              lastEmailErrorAt: null,
            }
          : {
              lastEmailErrorAt: new Date(),
            },
      });

      if (!emailSent) {
        throw new InternalServerErrorException(
          'La invitación fue registrada, pero no se pudo enviar el correo.',
        );
      }

      return {
        invitationLink,
      };
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async userDeactivate(
    affectedId: string,
    userDeactivateDto: UserDeactivateDto,
    userId: string,
  ) {
    try {
      const { type, reason } = userDeactivateDto;

      await this.prisma.$transaction(async (tx) => {
        const affectedUserExist = await tx.user.findUnique({
          where: { id: affectedId },
          select: { id: true, name: true, lastname: true, email: true },
        });

        if (!affectedUserExist) throw new Error('Usuario no encontrado');

        await tx.user.update({
          data: { status: type },
          where: { id: affectedId },
        });

        const dataLog: CreateLog = {
          userId,
          affected: affectedId,
          entity: LogEntities.user,
          action: LogActions.admin.deactivateUser,
          description: reason,
        };

        await this.logsService.create(dataLog, tx);
      });

      return;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async resendUserInvitation(invitationId: string, user: User) {
    try {
      const token = generateInvitationToken();

      const invitation = await this.prisma.$transaction(async (tx) => {
        const target = await this.getAccessibleProcessInvitation(
          tx,
          invitationId,
          user,
        );

        if (target.isUsed || target.canceledAt) {
          throw new ConflictException(
            'La invitación ya fue utilizada o cancelada.',
          );
        }

        const existingUser = await tx.user.findUnique({
          where: {
            email: target.toEmail.trim().toLowerCase(),
          },
          select: { id: true },
        });

        if (existingUser) {
          throw new ConflictException('El usuario ya está registrado.');
        }

        const otherInvitation = await tx.userInvitation.findFirst({
          where: {
            id: { not: target.id },
            toEmail: target.toEmail,
            isUsed: false,
            canceledAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });

        if (otherInvitation) {
          throw new ConflictException(
            'Existe otra invitación vigente para este correo.',
          );
        }

        const now = new Date();
        const resendLimit = new Date(now.getTime() - 60_000);

        if (target.updatedAt > resendLimit) {
          throw new BadRequestException(
            'Debe esperar al menos un minuto para reenviar.',
          );
        }

        const result = await tx.userInvitation.updateMany({
          where: {
            id: target.id,
            isUsed: false,
            canceledAt: null,
            updatedAt: { lte: resendLimit },
          },
          data: {
            token: hashToken(token),
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            updatedAt: now,
            emailSentAt: null,
            lastEmailErrorAt: null,
          },
        });

        if (result.count !== 1) {
          throw new ConflictException('La invitación ya no está disponible.');
        }

        const dataLog: CreateLog = {
          userId: user.id,
          entity: LogEntities.user,
          action: LogActions.common.resendInvitation,
          affected: target.id,
          description: `Proceso: ${target.processId}`,
        };

        await this.logsService.create(dataLog, tx);

        return {
          id: target.id,
          toEmail: target.toEmail,
        };
      });

      const invitationLink = `/auth/register?token=${token}`;

      const msj = `Para registrarse use el siguiente link: ${
        this.configService.getOrThrow<string>('API_LINK') + invitationLink
      }`;

      const sent = await this.brevoService.sendEmail(
        invitation.toEmail,
        'Invitación de registro',
        msj,
      );

      await this.prisma.userInvitation.updateMany({
        where: {
          id: invitation.id,
          token: hashToken(token),
        },
        data: sent
          ? {
              emailSentAt: new Date(),
              lastEmailErrorAt: null,
            }
          : {
              lastEmailErrorAt: new Date(),
            },
      });

      if (!sent) {
        throw new InternalServerErrorException(
          'Se renovó la invitación, pero no fue posible enviar el correo.',
        );
      }

      return {
        success: true,
      };
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async cancelUserInvitation(invitationId: string, user: User) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invitation = await this.getAccessibleProcessInvitation(
          tx,
          invitationId,
          user,
        );

        if (invitation.isUsed || invitation.canceledAt) {
          throw new ConflictException(
            'La invitación ya fue utilizada o cancelada.',
          );
        }

        const result = await tx.userInvitation.updateMany({
          where: {
            id: invitation.id,
            isUsed: false,
            canceledAt: null,
          },
          data: {
            canceledAt: new Date(),
          },
        });

        if (result.count !== 1) {
          throw new ConflictException('La invitación ya no está disponible.');
        }

        const dataLog: CreateLog = {
          userId: user.id,
          entity: LogEntities.user,
          action: LogActions.common.cancelInvitation,
          affected: invitation.id,
          description: `Proceso: ${invitation.processId}`,
        };

        await this.logsService.create(dataLog, tx);

        return { success: true };
      });
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  private async getAccessibleProcessInvitation(
    tx: Prisma.TransactionClient,
    invitationId: string,
    user: User,
  ) {
    const isAdmin = user.roles.includes(ValidRoles.admin);
    const isLawyer = user.roles.includes(ValidRoles.lawyer);

    if (!isAdmin && !isLawyer) {
      throw new ForbiddenException('No tiene permisos.');
    }

    const where: Prisma.UserInvitationWhereInput = {
      id: invitationId,
      role: 'client',
      processId: { not: null },
      process: {
        status: { not: 'deleted' },
        ...(!isAdmin && { managedByID: user.id }),
      },
    };

    const target = await tx.userInvitation.findFirst({
      where,
      select: { processId: true },
    });

    if (!target?.processId) {
      throw new NotFoundException('Invitación no encontrada.');
    }

    await lockProcess(tx, target.processId);

    const invitation = await tx.userInvitation.findFirst({
      where,
      select: {
        id: true,
        processId: true,
        toEmail: true,
        isUsed: true,
        canceledAt: true,
        updatedAt: true,
      },
    });

    if (!invitation?.processId) {
      throw new NotFoundException('Invitación no encontrada.');
    }

    return invitation;
  }

  private handleDBErrors(error: unknown): never {
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
