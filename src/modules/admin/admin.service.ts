import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserInivitationDto } from './dto/user-invitation.dto';
import { ActionsLog, generateInvitationToken, hashToken } from 'src/common';
import { Prisma } from 'src/generated/prisma/client';
import { BrevoService } from '../infrastructure/services/brevo.service';
import { ConfigService } from '@nestjs/config';
import { UserDeactivateDto } from './dto/user-deactivate.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private readonly brevoService: BrevoService,
    private configService: ConfigService,
  ) {}

  async sendUserInvitation(userInivitationDto: UserInivitationDto) {
    try {
      const { toEmail, role, createdById } = userInivitationDto;
      const token = generateInvitationToken();
      const hashedToken = hashToken(token);

      const invitation = await this.prisma.userInvitation.create({
        data: {
          token: hashedToken,
          toEmail,
          role,
          createdById,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 dias
        },
      });

      if (!invitation)
        throw new Error('Hubo un problema al guardar la invitación.');

      const invitationLink = `/auth/register?token=${token}`;

      const msj = `Para registrarse use el siguiente link: ${this.configService.getOrThrow<string>('API_LINK') + invitationLink}`;

      await this.brevoService.sendEmail(toEmail, 'Invitación de registro', msj);
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
        const affectedUserExist = await this.prisma.user.findUnique({
          where: { id: affectedId },
          select: { id: true, name: true, lastname: true, email: true },
        });

        if (!affectedUserExist) throw new Error('Usuario no encontrado');

        await this.prisma.user.update({
          data: { status: type },
          where: { id: affectedId },
        });

        await this.prisma.log.create({
          data: {
            userId,
            affectedUserId: affectedId,
            action: ActionsLog.admin.deactivateUser,
            description: reason,
          },
        });
      });

      return;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  private handleDBErrors(error: unknown): never {
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
