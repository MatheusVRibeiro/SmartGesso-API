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
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { RegisterServiceOrderResultDto } from './dto/register-service-order-result.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('service-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('services.read')
  @ApiOperation({ summary: 'Lista ordens de serviço da empresa (paginado)' })
  findAll(
    @Req() r: any,
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.serviceOrdersService.findAll(r.company.id, pagination, search, status);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('services.read')
  @ApiOperation({ summary: 'Busca OS por ID' })
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.serviceOrdersService.findOne(r.company.id, id);
  }

  @Get(':id/result')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('services.read')
  @ApiOperation({ summary: 'Busca resultado da OS' })
  getResult(@Req() r: any, @Param('id') id: string) {
    return this.serviceOrdersService.getResult(r.company.id, id);
  }

  @Get(':id/financial-summary')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('services.read')
  @ApiOperation({ summary: 'Resumo financeiro da OS (recebido, custo, resultado)' })
  getFinancialSummary(@Req() r: any, @Param('id') id: string) {
    return this.serviceOrdersService.getFinancialSummary(r.company.id, id);
  }

  @Patch(':id/result')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('services.complete')
  @ApiOperation({ summary: 'Registra resultado da OS (conclusão)' })
  registerResult(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: RegisterServiceOrderResultDto,
  ) {
    return this.serviceOrdersService.registerResult(r.company.id, id, dto);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('services.create')
  @ApiOperation({ summary: 'Cria nova OS' })
  create(@Req() r: any, @Body() dto: CreateServiceOrderDto) {
    return this.serviceOrdersService.create(r.company.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('services.update')
  @ApiOperation({ summary: 'Atualiza OS' })
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateServiceOrderDto) {
    return this.serviceOrdersService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('services.update')
  @ApiOperation({ summary: 'Remove OS' })
  remove(@Req() r: any, @Param('id') id: string) {
    return this.serviceOrdersService.remove(r.company.id, id);
  }
}
