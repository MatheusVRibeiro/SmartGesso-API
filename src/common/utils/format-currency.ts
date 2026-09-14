/**
 * Formata um valor monetário em BRL (ex.: 1234.5 → "R$ 1.234,50").
 *
 * Utilitário compartilhado por eventos de push/notificação que exibem
 * valores em texto (pagamentos, despesas, aditivos).
 */
export function formatCurrency(value: number | string | { toString(): string }): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}
