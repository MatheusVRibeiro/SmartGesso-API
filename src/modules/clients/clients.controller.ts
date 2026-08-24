import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista clientes da empresa' })
  list(@Req() r: any, @Query('search') search?: string) {
    return this.clients.findAll(r.company.id, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca cliente por ID' })
  get(@Req() r: any, @Param('id') id: string) {
    return this.clients.findOne(r.company.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria novo cliente' })
  create(@Req() r: any, @Body() dto: CreateClientDto) {
    return this.clients.create(r.company.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza cliente' })
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove cliente' })
  remove(@Req() r: any, @Param('id') id: string) {
    return this.clients.remove(r.company.id, id);
  }
}
