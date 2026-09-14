import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaService } from '../../database/prisma.service';

/** Payload de push enviado para todos os dispositivos ativos da empresa. */
export interface PushPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  sent: number;
  failed: number;
}

const TITLE_MAX_LENGTH = 100;
const BODY_MAX_LENGTH = 500;

/**
 * Sanitiza o texto: remove espaços nas pontas e trunca ao tamanho máximo
 * (com reticências). Retorna undefined para texto vazio.
 */
function sanitizeText(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Detecta tickets de erro indicando que o token não está mais registrado
 * no Expo (DeviceNotRegistered / 422 / ExponentDeviceNotRegistered).
 */
function isDeviceNotRegistered(ticket: ExpoPushTicket): boolean {
  if (ticket.status !== 'error') return false;
  const details = ticket.details;
  if (details?.error === 'DeviceNotRegistered') return true;
  const message = String(ticket.message ?? '');
  return /ExponentDeviceNotRegistered|422/.test(message);
}

/**
 * Serviço de push notifications via Expo (expo-server-sdk v6).
 * Envia para todos os tokens ativos da empresa e faz soft-delete
 * (deletedAt) dos tokens que o Expo reporta como não registrados.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo: Expo;

  constructor(private readonly prisma: PrismaService) {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
    });
  }

  /**
   * Envia um push para todos os dispositivos ativos da empresa.
   * Em NODE_ENV=test (ou quando não há tokens) retorna { sent: 0 }
   * sem chamar o Expo.
   */
  async sendToCompany(
    companyId: string,
    payload: PushPayload,
  ): Promise<PushResult> {
    const title = sanitizeText(payload.title, TITLE_MAX_LENGTH);
    const body = sanitizeText(payload.body, BODY_MAX_LENGTH);

    if (process.env.NODE_ENV === 'test') {
      return { sent: 0, failed: 0 };
    }

    const tokens = await this.prisma.pushToken.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, token: true },
    });

    if (tokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token.token,
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
      ...(payload.data ? { data: payload.data } : {}),
    }));

    let tickets: ExpoPushTicket[];
    try {
      tickets = await this.expo.sendPushNotificationsAsync(messages);
    } catch (error) {
      this.logger.warn(
        `Falha ao enviar push para a empresa ${companyId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { sent: 0, failed: tokens.length };
    }

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < tickets.length; i += 1) {
      const ticket = tickets[i];
      if (ticket.status === 'ok') {
        sent += 1;
        continue;
      }
      failed += 1;
      if (isDeviceNotRegistered(ticket)) {
        const token = tokens[i];
        if (token) {
          await this.prisma.pushToken.update({
            where: { id: token.id },
            data: { deletedAt: new Date() },
          });
        }
      }
    }

    return { sent, failed };
  }
}
