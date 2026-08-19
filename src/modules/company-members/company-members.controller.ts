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
import { CompanyMembersService } from './company-members.service';
import { InviteMemberDto, UpdateMemberDto } from './dto';

/**
 * Usuários da empresa (V3 — seção 57).
 * companyId sempre vem de r.company.id (ActiveCompanyGuard), nunca do body.
 */
@ApiTags('company-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('company')
export class CompanyMembersController {
  constructor(private readonly members: CompanyMembersService) {}

  @Get('members')
  list(@Req() r: any) {
    return this.members.findAll(r.company.id);
  }

  @Post('members/invite')
  invite(@Req() r: any, @Body() dto: InviteMemberDto) {
    return this.members.invite(r.company.id, dto);
  }

  @Patch('members/:id')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.members.update(r.company.id, id, dto);
  }

  @Patch('members/:id/activate')
  activate(@Req() r: any, @Param('id') id: string) {
    return this.members.activate(r.company.id, id);
  }

  @Patch('members/:id/deactivate')
  deactivate(@Req() r: any, @Param('id') id: string) {
    return this.members.deactivate(r.company.id, id);
  }

  @Delete('members/:id')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.members.remove(r.company.id, id);
  }

  @Get('permissions')
  permissions(@Req() r: any) {
    return this.members.permissions(r.company.id, r.user.id);
  }
}