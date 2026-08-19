import { ServiceOrderStatus } from '@prisma/client';

/**
 * Resposta da conversão de orçamento aprovado em ordem de serviço.
 * Reaproveita os dados do orçamento (cliente, obra, observações, prazo e valor).
 */
export class ConvertQuoteToServiceResponseDto {
  /** ID da ordem de serviço criada. */
  serviceOrderId!: string;

  /** Código sequencial da OS dentro da empresa. */
  code!: number;

  /** Status inicial da OS criada (PENDENTE). */
  status!: ServiceOrderStatus;

  /** Cliente reaproveitado do orçamento. */
  clientId!: string;

  /** Obra reaproveitada do orçamento (se houver). */
  workId?: string | null;

  /** Data de início prevista (startDate do orçamento, se houver). */
  scheduledDate?: string | null;

  /** Valor de venda reaproveitado do total do orçamento. */
  saleValue?: number | null;

  /** Observações reaproveitadas do orçamento. */
  observations?: string | null;
}