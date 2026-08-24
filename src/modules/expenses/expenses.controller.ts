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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista despesas da empresa' })
  findAll(
    @Req() r: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.expensesService.findAll(r.company.id, search, category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca despesa por ID' })
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.expensesService.findOne(r.company.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria nova despesa' })
  create(@Req() r: any, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(r.company.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza despesa' })
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove despesa' })
  remove(@Req() r: any, @Param('id') id: string) {
    return this.expensesService.remove(r.company.id, id);
  }
}
