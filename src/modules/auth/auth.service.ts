import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { CreateUserDto, LoginUserDto, SendInvitationDto } from './dto';
import { PrismaService } from 'src/modules/prisma/prisma.service';

import { Prisma } from 'src/generated/prisma/client';
import {
  JwtAccessPayload,
  JwtRefreshPayload,
} from './interfaces/jwt-payload.interface';
import { User } from './interfaces';
import { hashToken, lockProcess } from 'src/common';
import { RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { name, lastname, email, password } = createUserDto;
    try {
      const user = await this.prisma.user.create({
        data: {
          name: name.trim(),
          lastname: lastname.trim(),
          email: email.trim().toLowerCase(),
          password: bcrypt.hashSync(password, 10),
          roles: ['client'], //todo: change respect the creation.
        },
        select: {
          id: true,
          name: true,
          lastname: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        ...user,
        token: this.generateJwtAccessToken({ id: user.id }),
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async loginWeb(loginUserDto: LoginUserDto, ip: string) {
    try {
      const { email, password: pass, deviceId, deviceInfo } = loginUserDto;

      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) throw new Error('Credentials are not valid');

      if (!bcrypt.compareSync(pass, user.password))
        throw new Error('Credentials are not valid');

      if (user.status !== 'active') {
        throw new UnauthorizedException('User not active');
      }

      const accessTokenExpiresIn =
        parseInt(this.configService.get('TIME_ACCESS_TOKEN') ?? '20m') * 60; // SECONDS

      const refreshTokenExpiresIn =
        parseInt(this.configService.get('TIME_REFRESH_TOKEN') ?? '7d') *
        60 *
        60 *
        24; // SECONDS

      const expiresAt = new Date(Date.now() + 1000 * refreshTokenExpiresIn);

      const initialSession = await this.prisma.userSession.create({
        data: {
          deviceId,
          deviceInfo,
          ipAddress: ip,
          userId: user.id,
          refreshToken: '',
          expiresAt,
        },
      });
      if (!initialSession) throw new Error('session not created');

      const payload: JwtRefreshPayload = {
        userId: user.id,
        sessionId: initialSession.id,
      };

      const refreshToken = this.generateJwtRefreshToken(payload);

      const session = await this.prisma.userSession.update({
        data: { refreshToken: bcrypt.hashSync(refreshToken, 10) },
        where: { id: initialSession.id },
      });

      if (!session) throw new Error('session not updated');

      const { password, createdAt, updatedAt, ...result } = user;

      return {
        user: { ...result },
        accessToken: this.generateJwtAccessToken({ id: user.id }),
        refreshToken,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
        sessionId: session.id,
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async logout(user: User, sessionId: string) {
    try {
      const session = await this.prisma.userSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) throw new Error('session not found');
      if (session.userId !== user.id) throw new Error('unauthorized session');
      if (session.isRevoked) return;

      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'logout',
        },
      });

      return;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async getRefreshTokenWeb(user: User, sessionId: string) {
    try {
      const accessTokenExpiresIn =
        parseInt(this.configService.get('TIME_ACCESS_TOKEN') ?? '20m') * 60; // SECONDS

      const refreshTokenExpiresIn =
        parseInt(this.configService.get('TIME_REFRESH_TOKEN') ?? '7d') *
        60 *
        60 *
        24; // SECONDS

      const expiresAt = new Date(Date.now() + 1000 * refreshTokenExpiresIn);

      const refreshToken = this.generateJwtRefreshToken({
        userId: user.id,
        sessionId: sessionId,
      });

      const session = await this.prisma.userSession.update({
        data: { refreshToken: bcrypt.hashSync(refreshToken, 10), expiresAt },
        where: { id: sessionId },
      });

      if (!session) throw new Error('session not updated');

      const accessToken = this.generateJwtAccessToken({
        id: user.id,
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          lastname: user.lastname,
          email: user.email,
          roles: user.roles,
          status: user.status,
        },
        accessToken,
        refreshToken,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async getUserInvitation(token: string) {
    try {
      const tokenHash = hashToken(token);

      const invitation = await this.prisma.userInvitation.findUnique({
        select: {
          id: true,
          toEmail: true,
          role: true,
          expiresAt: true,
          isUsed: true,
        },
        where: {
          token: tokenHash,
          canceledAt: null,
        },
      });

      if (!invitation) {
        throw new BadRequestException('La invitación no existe.');
      }

      if (invitation.isUsed) {
        throw new BadRequestException('La invitación ya fue utilizada.');
      }

      if (invitation.expiresAt <= new Date()) {
        throw new BadRequestException('La invitación ha expirado.');
      }

      return {
        ...invitation,
      };
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async registerUser(registerUserDto: RegisterUserDto) {
    try {
      const { name, lastname, password, invitationId } = registerUserDto;

      const hashedPassword = await bcrypt.hash(password, 10);

      return await this.prisma.$transaction(
        async (tx) => {
          const invitation = await tx.userInvitation.findUnique({
            where: {
              id: invitationId,
            },
            select: {
              id: true,
              toEmail: true,
              role: true,
              processId: true,
              isUsed: true,
              expiresAt: true,
              canceledAt: true,
            },
          });

          if (!invitation) {
            throw new BadRequestException('La invitación no existe.');
          }

          if (invitation.canceledAt) {
            throw new BadRequestException('La invitación ha sido cancelada.');
          }

          if (invitation.isUsed) {
            throw new BadRequestException('La invitación ya fue utilizada.');
          }

          if (invitation.expiresAt <= new Date()) {
            throw new BadRequestException('La invitación ha expirado.');
          }

          if (invitation.processId) {
            if (invitation.role !== 'client') {
              throw new BadRequestException(
                'La invitación del proceso debe ser para un cliente.',
              );
            }

            const process = await tx.process.findFirst({
              where: {
                id: invitation.processId,
                status: {
                  not: 'deleted',
                },
              },
              select: {
                id: true,
              },
            });

            if (!process) {
              throw new NotFoundException(
                'El proceso vinculado no está disponible.',
              );
            }

            await lockProcess(tx, invitation.processId);

            const currentProcess = await tx.process.findFirst({
              where: {
                id: invitation.processId,
                status: {
                  not: 'deleted',
                },
              },
              select: {
                id: true,
              },
            });

            if (!currentProcess) {
              throw new NotFoundException(
                'El proceso vinculado no está disponible.',
              );
            }
          }

          const now = new Date();

          const claimedInvitation = await tx.userInvitation.updateMany({
            where: {
              id: invitation.id,
              isUsed: false,
              canceledAt: null,
              expiresAt: {
                gt: now,
              },
            },
            data: {
              isUsed: true,
              usedAt: now,
            },
          });

          if (claimedInvitation.count !== 1) {
            throw new BadRequestException(
              'La invitación ya no está disponible.',
            );
          }

          const user = await tx.user.create({
            data: {
              name: name.trim(),
              lastname: lastname.trim(),
              email: invitation.toEmail.trim().toLowerCase(),
              password: hashedPassword,
              roles: [invitation.role],
            },
            select: {
              id: true,
              name: true,
              lastname: true,
              email: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (invitation.processId) {
            await tx.processClient.create({
              data: {
                processId: invitation.processId,
                clientId: user.id,
              },
            });
          }

          return user;
        },
        {
          timeout: 15000,
        },
      );
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  private generateJwtAccessToken(payload: JwtAccessPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private generateJwtRefreshToken(payload: JwtRefreshPayload) {
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });
    return token;
  }

  private handleDBErrors(error): never {
    if (error instanceof HttpException) {
      throw error;
    }
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
