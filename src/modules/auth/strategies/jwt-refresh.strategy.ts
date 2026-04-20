import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';

import { AuthStrategy, JwtRefreshPayload, User } from '../interfaces';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  AuthStrategy.REFRESH,
) {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.get('JWT_REFRESH_SECRET')!,
      ignoreExpiration: true,
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.refresh_token,
      ]),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtRefreshPayload): Promise<User> {
    //! TODO: wrap in a try cath
    const { userId, sessionId } = payload;
    const token = req.cookies?.refresh_token;
    // console.log('cookies:', req.cookies);

    // console.log('cookie: ' + token);
    // console.log('userid: ' + userId);
    // console.log('headers:', req.headers);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new UnauthorizedException('Token not valid');
    if (user.status !== 'active')
      throw new UnauthorizedException('User not active');

    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId, userId },
    });

    if (!session || session.isRevoked)
      throw new UnauthorizedException('Token not valid (1)');

    if (session.expiresAt < new Date())
      throw new UnauthorizedException('Token not valid (2)');

    if (!bcrypt.compareSync(token, session.refreshToken))
      throw new UnauthorizedException('Token not valid (3)');

    const { password, ...result } = user;

    return {
      ...result,
      sessionId,
    };
  }
}
