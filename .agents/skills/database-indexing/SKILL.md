---
name: database-indexing
description: Padrões para modelagem de dados no Prisma com MySQL, estratégias de indexação de alta performance, filtragem multi-tenant e tratamento de valores monetários com Decimal(15,2).
---

# Database Indexing & Prisma Optimization Skill

Esta skill orienta a criação de índices eficientes, modelagem de banco de dados com Prisma ORM no MySQL e garantia de integridade transacional e financeira.

---

## 💰 Regra Obrigatória: Valores Financeiros

- Todos os campos que representam valores monetários, preços, descontos, totais e taxas DEVEM ser modelados como `Decimal(15,2)` no `schema.prisma`.
- **Nunca use `Float` ou `Int` direto para dinheiro.**
- Nas operações em TypeScript, utilize a classe `Prisma.Decimal` (ou converta com precisão decimal usando bibliotecas como `decimal.js`) para evitar erros de ponto flutuante IEEE-754.

```prisma
model Quote {
  id          String   @id @default(uuid())
  companyId   String
  totalAmount Decimal  @db.Decimal(15, 2)
  discount    Decimal? @db.Decimal(15, 2)
  // ...
}
```

---

## ⚡ Estratégias de Indexação para Multi-tenancy

Em bancos multi-tenant baseados em coluna discriminadora (`companyId`), praticamente todas as consultas filtram por empresa. Portanto:

1. **Índices Compostos com `companyId` como Primeiro Membro:**
   - Se uma tabela frequentemente busca por `status` dentro de uma empresa:
     ```prisma
     @@index([companyId, status])
     ```
   - Se filtra por data de criação:
     ```prisma
     @@index([companyId, createdAt])
     ```
   - Chaves únicas com escopo da empresa (ex: número sequencial de orçamento ou OS):
     ```prisma
     @@unique([companyId, orderNumber])
     ```

2. **Evitar Índices Redundantes:**
   - Se você possui `@@index([companyId, status])`, um índice avulso em `@@index([companyId])` pode ser redundante porque o MySQL consegue usar o prefixo mais à esquerda (leftmost prefix).

3. **Chaves Estrangeiras (Foreign Keys):**
   - O MySQL InnoDB cria índices automaticamente para FKs, mas certifique-se de que relacionamentos frequentes com filtros de empresa tirem proveito de índices compostos adequados.

---

## 🔄 Transações Seguras (`$transaction`)

- Para qualquer fluxo que altere mais de uma tabela ou dependa do estado de outra entidade (ex: converter orçamento em ordem de serviço, atualizar estoque com baixa, lançar movimentação financeira):
  - **Sempre utilize `this.prisma.$transaction(async (tx) => { ... })`**.
  - Execute todas as operações daquele fluxo usando o cliente transacional `tx` e não `this.prisma`.
  - Mantenha a transação o mais curta possível para não reter locks desnecessários nas tabelas MySQL.
