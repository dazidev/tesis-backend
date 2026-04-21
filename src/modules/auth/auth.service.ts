import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
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

  async login(loginUserDto: LoginUserDto) {
    try {
      const {
        email,
        password: pass,
        deviceId,
        deviceInfo,
        ipAddress,
      } = loginUserDto;

      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) throw new Error('Credentials are not valid');

      if (!bcrypt.compareSync(pass, user.password))
        throw new Error('Credentials are not valid');

      const timeExpires = parseInt(
        this.configService.get('TIME_REFRESH_TOKEN') ?? '7d',
      );
      const expiresAt = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * timeExpires,
      );

      const initialSession = await this.prisma.userSession.create({
        data: {
          deviceId,
          deviceInfo,
          ipAddress,
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
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async getRefreshToken(user: User, sessionId: string) {
    try {
      const timeExpires = parseInt(
        this.configService.get('TIME_REFRESH_TOKEN') ?? '7d',
      );
      const expiresAt = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * timeExpires,
      );

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
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async sendInvitation(user: User, sendInvitationDto: SendInvitationDto) {
    try {
      const { toEmail, role } = sendInvitationDto;

      const isLawyer = user.roles.includes('lawyer');

      if (isLawyer && (role == 'admin' || role == 'lawyer'))
        throw new UnauthorizedException(
          'The role is not valid to perform this action',
        );

      const tokenId = uuidv4();

      const now = new Date();
      const expiresAt = new Date(now.setDate(now.getDate() + 7));

      const invitation = await this.prisma.userInvitation.create({
        data: {
          toEmail,
          role,
          token: bcrypt.hashSync(tokenId, 10),
          expiresAt,
          createdById: user.id,
        },
      });

      if (!invitation) throw new Error('The invitation insert failed');

      const { token, ...result } = invitation;

      return {
        ...result,
      };
    } catch (error) {
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
