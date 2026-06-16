import { Body, Controller, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces';
import { UserInivitationDto } from './dto/user-invitation.dto';

@Auth(ValidRoles.admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('user-invitation')
  sendUserInvitation(@Body() userInivitationDto: UserInivitationDto) {
    return this.adminService.sendUserInvitation(userInivitationDto);
  }
}
