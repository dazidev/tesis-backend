import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  CreateUserDto,
  LoginUserDto,
  RegisterUserDto,
  SendInvitationDto,
} from './dto';
import { AuthGuard } from '@nestjs/passport';
import { GetUser, RawHeaders } from './decorators';
import type { User } from './interfaces/user';
import { UserRoleGuard } from './guards/user-role.guard';
import { RoleProtected } from './decorators/role-protected.decorator';
import { AuthStrategy, ValidRoles } from './interfaces';
import { Auth } from './decorators/auth.decorator';
import { GetRealIP } from './decorators/get-ip.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('register-user')
  registerUser(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.registerUser(registerUserDto);
  }

  @Post('login-web')
  async loginUser(@Body() loginUserDto: LoginUserDto, @GetRealIP() ip: string) {
    console.log('ping');
    return await this.authService.loginWeb(loginUserDto, ip);
  }

  @Post('logout-web')
  @UseGuards(AuthGuard(AuthStrategy.REFRESH))
  async logoutUser(
    @GetUser() user: User,
    @GetUser('sessionId') sessionId: string,
  ) {
    return await this.authService.logout(user, sessionId);
  }

  @Post('refresh-web')
  @UseGuards(AuthGuard(AuthStrategy.REFRESH))
  async getRefreshToken(
    @GetUser() user: User,
    @GetUser('sessionId') sessionId: string,
  ) {
    return await this.authService.getRefreshTokenWeb(user, sessionId);
  }

  @Post('send-invitation')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  sendInvitation(
    @GetUser() user: User,
    @Body() sendInvitationDto: SendInvitationDto,
  ) {
    return this.authService.sendInvitation(user, sendInvitationDto);
  }

  @Get('invitation/:token')
  getUserInvitation(@Param('token') token: string) {
    return this.authService.getUserInvitation(token);
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
