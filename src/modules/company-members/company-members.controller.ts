import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CompanyMembersService } from './company-members.service';
import { InviteMemberDto, UpdateMemberDto } from './dto';

/**
 * Usuários da empresa (V3 — seção 57).
 * companyId sempre vem de r.company.id (ActiveCompanyGuard), nunca do body.
 */
@ApiTags('company-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('company')
export class CompanyMembersController {
  constructor(private readonly members: CompanyMembersService) {}

  @Get('members')
  list(@Req() r: any) {
    return this.members.findAll(r.company.id);
  }

  @Post('members/invite')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('members.invite')
  invite(@Req() r: any, @Body() dto: InviteMemberDto) {
    return this.members.invite(r.company.id, dto);
  }

  @Patch('members/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('members.update')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.members.update(r.company.id, id, dto);
  }

  @Patch('members/:id/activate')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('members.update')
  activate(@Req() r: any, @Param('id') id: string) {
    return this.members.activate(r.company.id, id);
  }

  @Patch('members/:id/deactivate')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('members.disable')
  deactivate(@Req() r: any, @Param('id') id: string) {
    return this.members.deactivate(r.company.id, id);
  }

  @Delete('members/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('members.disable')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.members.remove(r.company.id, id);
  }

  @Get('permissions')
  permissions(@Req() r: any) {
    return this.members.permissions(r.company.id, r.user.id);
  }
}