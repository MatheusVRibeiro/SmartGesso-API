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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompositionsService } from './compositions.service';
import { CalculateFromQuoteDto, CalculateMaterialsDto } from './dto';
import { CreateCompositionDto } from './dto/create-composition.dto';
import { UpdateCompositionDto } from './dto/update-composition.dto';

@ApiTags('compositions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('compositions')
export class CompositionsController {
  constructor(private readonly compositionsService: CompositionsService) {}

  @Get()
  findAll(@Req() r: any) {
    return this.compositionsService.findAll(r.company.id);
  }

  @Post()
  create(@Req() r: any, @Body() dto: CreateCompositionDto) {
    return this.compositionsService.create(r.company.id, dto);
  }

  @Post('calculate')
  calculate(@Req() r: any, @Body() dto: CalculateMaterialsDto) {
    return this.compositionsService.calculate(r.company.id, dto);
  }

  @Post('calculate-from-quote')
  @ApiOperation({
    summary: 'Calcula materiais a partir das medições dos ambientes de um orçamento',
    description:
      'Busca todas as medições armazenadas nos ambientes (QuoteEnvironment) do orçamento informado e calcula os materiais da composição ativa — sem depender de Work.',
  })
  calculateFromQuote(@Req() r: any, @Body() dto: CalculateFromQuoteDto) {
    return this.compositionsService.calculateFromQuote(r.company.id, dto);
  }

  @Get(':id')
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.compositionsService.findOne(r.company.id, id);
  }

  @Patch(':id')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateCompositionDto) {
    return this.compositionsService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.compositionsService.remove(r.company.id, id);
  }
}