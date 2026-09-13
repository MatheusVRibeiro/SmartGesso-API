import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

/**
 * Cron diário (08:00): avisa as empresas sobre follow-ups de orçamento
 * pendentes agendados para hoje (ou atrasados).
 *
 * Para cada empresa com follow-ups PENDING e scheduledAt <= fim do dia:
 *  - cria uma Notification (type FOLLOW_UP_TODAY);
 *  - envia push para os dispositivos ativos da empresa.
 */
@Injectable()
export class NotificationsCronService {
  private readonly logger = new Logger(NotificationsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async notifyPendingFollowUps(): Promise<void> {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const followUps = await this.prisma.quoteFollowUp.findMany({
      where: {
        status: 'PENDING',
        deletedAt: null,
        scheduledAt: { lte: endOfToday },
      },
      select: { id: true, companyId: true, quoteId: true },
    });

    if (followUps.length === 0) {
      return;
    }

    // Agrupa por empresa
    const byCompany = new Map<string, number>();
    for (const followUp of followUps) {
      byCompany.set(followUp.companyId, (byCompany.get(followUp.companyId) ?? 0) + 1);
    }

    for (const [companyId, count] of byCompany) {
      try {
        const body =
          count === 1
            ? 'Você tem 1 follow-up hoje'
            : `Você tem ${count} follow-ups hoje`;

        await this.notificationsService.create(companyId, {
          type: 'FOLLOW_UP_TODAY',
          title: 'Follow-ups de orçamento',
          body,
          data: { count },
        });

        await this.pushService.sendToCompany(companyId, {
          title: 'Follow-ups de orçamento',
          body,
          data: { route: '/orcamentos', count },
        });
      } catch (error) {
        this.logger.warn(
          `Falha ao notificar follow-ups da empresa ${companyId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
