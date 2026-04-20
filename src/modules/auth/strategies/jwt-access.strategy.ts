import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../interfaces/user';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuthStrategy } from '../interfaces';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  AuthStrategy.ACCESS,
) {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.get('JWT_ACCESS_SECRET')!,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<User> {
    //! TODO: wrap in a try cath
    const { id } = payload;
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) throw new UnauthorizedException('Token not valid');
    if (user.status !== 'active')
      throw new UnauthorizedException('User not active');

    const { password, ...result } = user;

    return result;
  }
}
