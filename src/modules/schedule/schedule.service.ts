import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateScheduleEventDto } from './dto/create-schedule-event.dto';
import { UpdateScheduleEventDto } from './dto/update-schedule-event.dto';

/** Inclusões padrão para enriquecer o retorno dos eventos de agenda. */
const SCHEDULE_INCLUDE = {
  client: { select: { id: true, name: true } },
  serviceOrder: { select: { id: true, code: true } },
  quote: { select: { id: true, quoteNumber: true } },
} satisfies Prisma.ScheduleEventInclude;

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateScheduleEventDto) {
    return this.prisma.scheduleEvent.create({
      data: {
        companyId,
        type: dto.type,
        title: dto.title,
        clientId: dto.clientId,
        serviceOrderId: dto.serviceOrderId,
        quoteId: dto.quoteId,
        // Mesmo fix dos demais módulos: converter ISO-8601 para Date antes de persistir
        date: new Date(dto.date),
        time: dto.time,
        notes: dto.notes,
        status: dto.status,
      },
      include: SCHEDULE_INCLUDE,
    });
  }

  async findAll(companyId: string, from?: string, to?: string) {
    const where: Prisma.ScheduleEventWhereInput = {
      companyId,
      deletedAt: null,
      ...(from ? { date: { gte: new Date(from) } } : {}),
      ...(to ? { date: { lte: new Date(to) } } : {}),
    };

    return this.prisma.scheduleEvent.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: SCHEDULE_INCLUDE,
    });
  }

  /** Eventos do dia atual (fuso America/Sao_Paulo). */
  async findToday(companyId: string) {
    const { start, end } = this.getTodayRange();
    return this.prisma.scheduleEvent.findMany({
      where: {
        companyId,
        deletedAt: null,
        date: { gte: start, lt: end },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: SCHEDULE_INCLUDE,
    });
  }

  async findOne(companyId: string, id: string) {
    const event = await this.prisma.scheduleEvent.findFirst({
      where: { id, companyId, deletedAt: null },
      include: SCHEDULE_INCLUDE,
    });
    if (!event) throw new NotFoundException('Evento de agenda não encontrado');
    return event;
  }

  async update(companyId: string, id: string, dto: UpdateScheduleEventDto) {
    await this.findOne(companyId, id);

    return this.prisma.scheduleEvent.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        clientId: dto.clientId,
        serviceOrderId: dto.serviceOrderId,
        quoteId: dto.quoteId,
        date: dto.date ? new Date(dto.date) : undefined,
        time: dto.time,
        notes: dto.notes,
        status: dto.status,
      },
      include: SCHEDULE_INCLUDE,
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.scheduleEvent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Intervalo [início, fim) do dia atual em America/Sao_Paulo, em UTC. */
  private getTodayRange(): { start: Date; end: Date } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .split('-')
      .map(Number);
    const [year, month, day] = parts;
    return {
      start: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0)),
    };
  }
}