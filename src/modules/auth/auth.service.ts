import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto, LoginUserDto } from './dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { PrismaService } from 'src/modules/prisma/prisma.service';

import * as bcrypt from 'bcrypt';
import { Prisma } from 'src/generated/prisma/client';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
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
        token: this.generateJwtToken({ id: user.id }),
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    try {
      const { email, password: pass } = loginUserDto;

      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) throw new Error('Credentials are not valid');

      if (!bcrypt.compareSync(pass, user.password))
        throw new Error('Credentials are not valid');

      const { password, createdAt, updatedAt, ...result } = user;

      return {
        ...result,
        token: this.generateJwtToken({ id: user.id }),
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }

  private generateJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
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
