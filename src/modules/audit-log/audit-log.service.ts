import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    companyId?: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: Record<string, any>;
  }) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          companyId: params.companyId ?? undefined,
          userId: params.userId ?? undefined,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId ?? undefined,
          details: params.details ?? undefined,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar log de auditoria: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}

