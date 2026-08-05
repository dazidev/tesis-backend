import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserRole } from 'src/generated/prisma/client';
import { FindUserQuerysDto } from './dto/querys/find-user-querys.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  async findAll() {
    try {
      const users = await this.prisma.user.findMany();

      if (!users) throw new Error('Users not found.');

      return users;
    } catch (error: unknown) {
      this.handleDBErrors(error);
    }
  }

  async findUserByRole(role: UserRole) {
    try {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          lastname: true,
          email: true,
          roles: true,
        },
        where: { roles: { has: role } },
      });

      if (!users) throw new Error('Users not found.');

      return users;
    } catch (error: unknown) {
      this.handleDBErrors(error);
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
