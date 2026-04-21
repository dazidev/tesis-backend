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
import { CreateUserDto, LoginUserDto, SendInvitationDto } from './dto';
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
      path: '/api/auth',
    });

    return {
      ...user,
      accessToken,
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard(AuthStrategy.REFRESH))
  async logoutUser(
    @GetUser() user: User,
    @GetUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user, sessionId);
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/auth',
    });
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

  @Post('send-invitation')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  sendInvitation(
    @GetUser() user: User,
    @Body() sendInvitationDto: SendInvitationDto,
  ) {
    return this.authService.sendInvitation(user, sendInvitationDto);
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
}
