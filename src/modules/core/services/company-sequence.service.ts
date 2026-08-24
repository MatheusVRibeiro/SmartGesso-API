import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Tipos de sequência atômica por tenant (companyId).
 *
 * Cada tipo mantém um contador `currentValue` na tabela `CompanySequence`.
 * O incremento é feito atomicamente via `upsert` com `increment` dentro de
 * transação, garantindo que chamadas concorrentes nunca produzam números
 * duplicados.
 */
export const SEQUENCE_TYPES = {
  QUOTE: 'QUOTE',
  SERVICE_ORDER: 'SERVICE_ORDER',
} as const;

export type SequenceType = (typeof SEQUENCE_TYPES)[keyof typeof SEQUENCE_TYPES];

/**
 * Service de numeração concorrente segura por tenant e tipo de entidade.
 *
 * Elimina a race condition do padrão "SELECT MAX + 1" substituindo-o por um
 * incremento atômico via `upsert` com `{ increment: 1 }` dentro de transação.
 *
 * Estratégia de atomicidade:
 * - Quando a linha já existe, o `UPDATE ... SET currentValue = currentValue + 1`
 *   é atômico no nível SQL — múltiplas transações concorrentes recebem valores
 *   únicos e sequenciais.
 * - Quando a linha não existe, o `INSERT` pode colidir com outra transação
 *   concorrente (P2002 — unique constraint violation). O retry garante que a
 *   segunda tentativa faça o `increment` sobre a linha criada pela primeira.
 *
 * O backfill (migration 0007) pré-popula a tabela a partir dos números já
 * existentes, garantindo que a numeração não reinicie em 1.
 */
@Injectable()
export class CompanySequenceService {
  private readonly logger = new Logger(CompanySequenceService.name);

  private static readonly MAX_RETRIES = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Incrementa atomicamente a sequência de um tenant e retorna o novo valor.
   *
   * @param companyId    Tenant ao qual a sequência pertence.
   * @param entityType   Tipo da sequência (QUOTE, SERVICE_ORDER).
   * @param tx           Cliente de transação Prisma (quando chamado dentro
   *                     de um `$transaction` existente).
   * @returns O próximo número de sequência (já incrementado).
   */
  async increment(
    companyId: string,
    entityType: SequenceType,
    tx?: any,
  ): Promise<number> {
    const client = tx ?? this.prisma;

    const execute = async (c: any): Promise<number> => {
      for (let attempt = 0; attempt < CompanySequenceService.MAX_RETRIES; attempt++) {
        try {
          const sequence = await c.companySequence.upsert({
            where: {
              companyId_entityType: { companyId, entityType },
            },
            update: {
              currentValue: { increment: 1 },
            },
            create: {
              companyId,
              entityType,
              currentValue: 1,
            },
          });
          return sequence.currentValue;
        } catch (error: any) {
          // P2002: unique constraint violation — outra requisição concorrente
          // criou a linha de sequência antes desta. Retry para fazer o increment.
          if (
            error?.code === 'P2002' &&
            attempt < CompanySequenceService.MAX_RETRIES - 1
          ) {
            this.logger.warn(
              `Race condition na sequência ${entityType} para company ${companyId} — retry ${attempt + 1}/${CompanySequenceService.MAX_RETRIES}`,
            );
            continue;
          }
          throw error;
        }
      }
      throw new Error(
        `Falha ao adquirir sequência ${entityType} para company ${companyId} após ${CompanySequenceService.MAX_RETRIES} tentativas`,
      );
    };

    // Se já estamos dentro de uma transação, reutilizamos o cliente (tx).
    // Caso contrário, envolvemos tudo em uma transação para garantir
    // atomicidade entre o upsert e o incremento.
    if (tx) {
      return execute(client);
    }
    return this.prisma.$transaction(async (t: any) => execute(t));
  }

  /**
   * Inicializa ou atualiza o valor atual da sequência para um tenant/tipo.
   * Usado pelo backfill e por scripts de migração.
   *
   * Nunca sobrescreve um currentValue maior — protege contra perda de
   * numeração existente durante backfill.
   *
   * @param companyId    Tenant ao qual a sequência pertence.
   * @param entityType   Tipo da sequência.
   * @param initialValue Valor a ser definido (nunca sobrescreve um valor maior).
   */
  async initialize(
    companyId: string,
    entityType: SequenceType,
    initialValue: number,
  ): Promise<void> {
    const existing = await this.prisma.companySequence.findUnique({
      where: {
        companyId_entityType: { companyId, entityType },
      },
      select: { currentValue: true },
    });

    if (existing) {
      if (existing.currentValue < initialValue) {
        await this.prisma.companySequence.update({
          where: {
            companyId_entityType: { companyId, entityType },
          },
          data: { currentValue: initialValue },
        });
      }
    } else {
      await this.prisma.companySequence.create({
        data: {
          companyId,
          entityType,
          currentValue: initialValue,
        },
      });
    }
  }

  /**
   * Retorna o valor atual da sequência para um tenant/tipo, ou null se não
   * existir.
   */
  async getCurrentValue(
    companyId: string,
    entityType: SequenceType,
  ): Promise<number | null> {
    const sequence = await this.prisma.companySequence.findUnique({
      where: {
        companyId_entityType: { companyId, entityType },
      },
      select: { currentValue: true },
    });
    return sequence?.currentValue ?? null;
  }
}
