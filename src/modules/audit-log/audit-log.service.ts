import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    companyId?: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        companyId: params.companyId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: params.details ?? null,
      },
    });
  }
}