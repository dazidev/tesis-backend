import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  SetMetadata,
  Res,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto } from './dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { GetUser, RawHeaders } from './decorators';
import type { User } from './interfaces/user';
import { UserRoleGuard } from './guards/user-role.guard';
import { RoleProtected } from './decorators/role-protected.decorator';
import { AuthStrategy, ValidRoles } from './interfaces';
import { Auth } from './decorators/auth.decorator';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('login')
  async loginUser(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.login(loginUserDto);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, //! true in production
      sameSite: 'lax', //! strict in production
      path: '/api/auth/refresh',
    });

    return {
      ...user,
      accessToken,
    };
  }

  @Get('test')
  test(@Req() req: Request) {
    console.log(req.cookies);
    return 'ok';
  }

  @Get('refresh')
  @UseGuards(AuthGuard(AuthStrategy.REFRESH))
  async getRefreshToken(
    @GetUser() user: User,
    @GetUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.getRefreshToken(user, sessionId);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, //! true in production
      sameSite: 'lax', //! strict in production
      path: '/api/auth/refresh',
    });

    return {
      accessToken,
    };
  }

  @Get('private')
  @UseGuards(AuthGuard())
  testingPrivateRoute(
    // @Req() request: Express.Request,
    @GetUser() user: User,
    @GetUser('email') userEmail: string,
    @RawHeaders() rawHeaders: string[],
  ) {
    return {
      ok: true,
      message: 'Hola Mundo Private',
      user,
      userEmail,
      rawHeaders,
    };
  }

  // @SetMetadata('role', 'USER')

  @Get('private2')
  @RoleProtected(ValidRoles.client)
  @UseGuards(AuthGuard(), UserRoleGuard)
  privateRoute2(@GetUser() user: User) {
    return {
      ok: true,
      user,
    };
  }

  @Get('private3')
  @Auth(ValidRoles.client)
  privateRoute3(@GetUser() user: User) {
    return {
      ok: true,
      user,
    };
  }

  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAuthDto: UpdateAuthDto) {
    return this.authService.update(+id, updateAuthDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(+id);
  }
}
