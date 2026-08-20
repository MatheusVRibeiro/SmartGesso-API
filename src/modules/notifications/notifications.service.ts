import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Dados mínimos para registrar um token push. */
export interface RegisterTokenInput {
  token: string;
  platform?: 'ANDROID' | 'IOS';
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra (ou atualiza) o token push do usuário na empresa ativa. */
  async registerToken(
    companyId: string,
    userId: string,
    input: RegisterTokenInput,
  ) {
    const token = input.token?.trim();
    if (!token) {
      return { ok: false };
    }
    await this.prisma.pushToken.upsert({
      where: { companyId_token: { companyId, token } },
      create: {
        companyId,
        userId,
        token,
        platform: input.platform ?? 'ANDROID',
      },
      update: { userId, platform: input.platform ?? 'ANDROID', deletedAt: null },
    });
    return { ok: true };
  }

  /** Lista as notificações da empresa ativa (mais recentes primeiro). */
  async list(companyId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /** Marca uma notificação como lida (somente da própria empresa). */
  async markRead(companyId: string, id: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id, companyId },
      data: { read: true },
    });
    return { ok: updated.count > 0 };
  }

  /** Cria uma notificação no banco (usada por outros módulos/cron). */
  async create(
    companyId: string,
    input: { type?: string; title: string; body: string; data?: unknown },
  ) {
    return this.prisma.notification.create({
      data: {
        companyId,
        type: input.type ?? 'GENERIC',
        title: input.title,
        body: input.body,
        data: input.data ? JSON.parse(JSON.stringify(input.data)) : undefined,
      },
    });
  }
}