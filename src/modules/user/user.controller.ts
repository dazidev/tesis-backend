import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces';
import { FindUserQuerysDto } from './dto/querys/find-user-querys.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Auth(ValidRoles.admin)
  @Get()
  findAll(@Query() findUserQuerysDto: FindUserQuerysDto) {
    const { role } = findUserQuerysDto;
    if (role) return this.userService.findUserByRole(role);
    return this.userService.findAll();
  }
}
