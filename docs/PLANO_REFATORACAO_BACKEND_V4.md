# SmartGesso API — Plano de Refatoração e Evolução do Backend V4

> **Documento de execução técnica**  
> Repositório: `SmartGesso-API`  
> Data-base da auditoria: 24/08/2026  
> Stack atual: NestJS 11 + Prisma + MySQL + JWT/Argon2  
> Documento complementar: `SmartGesso-Mobile/docs/PLANO_REFATORACAO_FRONTEND_V4.md`

---

## 1. Objetivo deste documento

Este documento transforma a auditoria do backend em um plano de implementação executável, dividido em etapas e subetapas. O foco não é reescrever o projeto, e sim **preservar a base técnica atual e corrigir inconsistências de domínio, integridade, segurança, rastreabilidade e manutenção**.

A direção de produto adotada neste plano é:

```text
Cliente
  ↓
Orçamento
  ↓ aprovado
Serviço / Ordem de Serviço
  ↓
Execução + Compras + Estoque + Despesas + Recebimentos
  ↓
Resultado
  ↓
Garantia / Retorno
```

Princípios obrigatórios:

1. O `companyId` nunca deve ser confiado a partir do body do cliente.
2. Toda operação de negócio deve respeitar o tenant ativo.
3. Orçamento aprovado deve gerar **no máximo um serviço**.
4. Alterações compostas devem ser transacionais.
5. Valores financeiros devem ser rastreáveis até sua origem.
6. `profit` não deve ser uma verdade manual desconectada das receitas/despesas.
7. Nenhum arquivo privado de cliente deve ficar publicamente acessível por URL estática sem autorização.
8. Migrações de domínio devem ser progressivas e compatíveis; não remover tabelas/colunas antigas antes do backfill e da migração do mobile.
9. Funcionalidades opcionais, como Produção, devem ser habilitadas por capacidade/plano/empresa.
10. Cada etapa deve terminar com lint, typecheck, testes e build verdes.

---

# 2. Diagnóstico resumido do estado atual

## 2.1 Pontos fortes a preservar

- NestJS organizado por módulos de domínio.
- Prisma com MySQL e uso de `Decimal` no schema.
- Estrutura multiempresa com `Company`, `CompanyMember` e empresa ativa.
- JWT separado para usuário e administrador de plataforma.
- Refresh tokens persistidos como hash.
- Rotação/revogação de sessão.
- Guards de autenticação, empresa ativa e permissões já iniciados.
- Soft delete em várias entidades.
- Histórico de status de orçamento.
- Geração de PDF de orçamento.
- Rate limiting, Helmet, CORS allowlist e ValidationPipe global.
- Testes de conversão de orçamento em serviço já existentes.

## 2.2 Problemas prioritários identificados

### P0 — integridade/fluxo

- `approve()` já cria uma `ServiceOrder`, porém existe também `convertToService()`. O mobile chama os dois fluxos e pode receber `409` após aprovação.
- `QuoteService.update()` apaga itens fora da transação; uma falha posterior pode deixar o orçamento sem itens.
- `ServiceOrdersService.update()` possui risco equivalente ao substituir materiais.
- `createVersion()` gera novo `quoteNumber`, embora uma nova versão deva manter o mesmo número.
- Numerações usam padrão `buscar último + 1`, sujeito a corrida entre usuários simultâneos.
- O fluxo permite criar OS manualmente mesmo quando a regra principal deveria ser orçamento aprovado → serviço.

### P1 — segurança e contrato

- `CompanyAccessGuard` não está aplicado de forma consistente em todos os módulos operacionais.
- `PermissionsGuard` e `@RequirePermissions()` também não estão sistematicamente aplicados.
- A API usa `402` para suspensão de assinatura, enquanto o mobile trata especialmente `403`; o contrato precisa ser padronizado por `code`.
- Upload autenticado é salvo em filesystem e depois servido publicamente por `/uploads`.

### P1 — domínio

- `Work`/"Obra" continua sendo entidade central para medições e aparece no orçamento, embora o fluxo simplificado precise ser Cliente → Orçamento → Serviço.
- Recebimentos podem referenciar orçamento, mas não serviço.
- Despesas não possuem vínculo com serviço.
- `ServiceOrder.cost`, `saleValue` e `profit` podem divergir dos lançamentos reais.

### P2 — manutenção e evolução

- `BusinessService` centraliza operações que hoje também existem em módulos específicos, criando sobreposição.
- Falta um mecanismo de capacidades/feature flags por empresa.
- Faltam domínios de Aditivos, Fornecedores/Compras e Garantia/Retorno.
- A cobertura de testes ainda é pequena para fluxos multi-tenant e financeiros.

---

# 3. Arquitetura de domínio alvo

A arquitetura recomendada preserva `ServiceOrder` internamente para evitar conflito com o model `Service` do catálogo.

```text
Company
 ├── CompanyMember
 ├── Client
 │    └── Quote
 │         ├── QuoteEnvironment
 │         │    └── Measurement
 │         ├── QuoteItem
 │         ├── QuoteHistory
 │         └── ServiceOrder (apenas após aprovação)
 │              ├── ServiceOrderMaterial
 │              ├── InventoryMovement
 │              ├── ServiceAdditional
 │              ├── Expense
 │              ├── Receivable / Payment
 │              ├── Attachment
 │              ├── Purchase
 │              └── WarrantyReturn
 ├── Supplier
 ├── Material
 ├── ProductionOrder (feature opcional)
 └── ScheduleEvent
```

`Work` deve entrar em **depreciação progressiva**, não em remoção abrupta.

---

# 4. Matriz de prioridade

| Prioridade | Item | Motivo |
|---|---|---|
| P0 | Aprovação cria serviço uma única vez | Bug de fluxo e duplicidade |
| P0 | Transactions em substituições | Risco de perda de dados |
| P0 | Corrigir versionamento | Inconsistência comercial |
| P0 | Corrigir numeração concorrente | Risco de colisão |
| P1 | Aplicar acesso/assinatura/permissões | Segurança SaaS |
| P1 | Padronizar contrato de erro | Integração mobile/API |
| P1 | Financeiro vinculado ao serviço | Resultado auditável |
| P1 | Upload privado | Privacidade e infraestrutura |
| P1 | Retirar Obra do fluxo principal | UX e domínio |
| P2 | Feature flags/capacidades | Produto adaptável |
| P2 | Aditivos | Mudança de escopo pós-aprovação |
| P2 | Compras/fornecedores | Custo real e estoque |
| P2 | Garantia/retorno | Pós-serviço |
| P2 | Follow-up comercial | Inteligência comercial |
| P2 | Limpeza de legado | Manutenção |
| P2 | Observabilidade/CI | Operação em produção |

---

# 5. ETAPA 0 — Preparação e baseline

## 5.1 Objetivo

Criar uma linha de base segura antes de alterar schema e regras de domínio.

## 5.2 Ações

- [ ] Criar branch específica para cada etapa de código; não misturar todas as etapas em um único PR.
- [ ] Executar `npm ci` ou instalação equivalente com lockfile.
- [ ] Executar `npm run lint`.
- [ ] Executar `npm run typecheck`.
- [ ] Executar `npm test`.
- [ ] Executar `npm run build`.
- [ ] Gerar snapshot/documentação da estrutura atual do banco.
- [ ] Validar migrations aplicadas em produção antes de criar novas migrations.
- [ ] Realizar backup do banco antes das migrations de domínio.
- [ ] Registrar a versão atual do mobile compatível com a API.

## 5.3 Regra de migration

Não fazer em uma única migration:

```text
adicionar novo campo
+ mover dados
+ remover campo antigo
```

Usar:

```text
Migration A → adiciona novo modelo/campo nullable
Deploy A → aplicação grava novo + mantém legado
Backfill → migra dados existentes
Deploy B → mobile/API usam novo modelo
Migration B → somente depois remove legado
```

## 5.4 Critério de aceite

Baseline documentado e todos os comandos de qualidade executados antes da primeira alteração funcional.

---

# 6. ETAPA 1 — Corrigir Orçamento → Aprovação → Serviço

## 6.1 Problema atual

Existem duas responsabilidades sobrepostas:

```text
QuotesService.approve()
  → status APROVADO
  → cria ServiceOrder
  → marca convertedAt

QuotesService.convertToService()
  → exige APROVADO
  → cria ServiceOrder
  → marca convertedAt
```

O sistema deve ter **uma única operação canônica**.

## 6.2 Decisão

`approve()` será a operação oficial e idempotente.

Contrato desejado:

```json
{
  "quote": {
    "id": "...",
    "status": "APROVADO"
  },
  "serviceOrder": {
    "id": "...",
    "code": 123,
    "status": "PENDENTE"
  },
  "serviceOrderCreated": true
}
```

Se a aprovação for repetida:

```json
{
  "quote": {
    "id": "...",
    "status": "APROVADO"
  },
  "serviceOrder": {
    "id": "...",
    "code": 123,
    "status": "PENDENTE"
  },
  "serviceOrderCreated": false
}
```

## 6.3 Modificações no schema

Recomendado adicionar unicidade de origem:

```prisma
model ServiceOrder {
  // ...
  quoteId String? @db.Char(36)

  @@unique([companyId, quoteId])
}
```

Observação: em MySQL, `NULL` pode repetir; isso permite serviços avulsos futuramente sem bloquear vários registros com `quoteId = null`.

## 6.4 Modificações em `QuotesService`

Arquivo principal:

```text
src/modules/quotes/quotes.service.ts
```

Subetapas:

1. Buscar o orçamento com tenant.
2. Rejeitar cancelado.
3. Se já aprovado, buscar `ServiceOrder` por `companyId + quoteId` e retornar o existente.
4. Se ainda não aprovado, iniciar uma única transaction.
5. Atualizar o orçamento para `APROVADO`.
6. Criar histórico de aprovação.
7. Criar `ServiceOrder` uma única vez.
8. Marcar `convertedAt`.
9. Retornar orçamento + serviço.

Não usar duas operações independentes para aprovar e converter.

## 6.5 Endpoint legado

```text
POST /quotes/:id/convert-to-service
```

Fase A:

- manter endpoint por compatibilidade;
- fazer endpoint chamar a mesma lógica interna idempotente;
- marcar no código/documentação como `@deprecated`.

Fase B, depois que o mobile estiver migrado:

- remover endpoint.

## 6.6 Testes obrigatórios

- [ ] orçamento RASCUNHO aprovado → cria exatamente 1 serviço.
- [ ] orçamento ENVIADO aprovado → cria exatamente 1 serviço.
- [ ] orçamento já APROVADO → retorna mesmo serviço.
- [ ] duas chamadas concorrentes → apenas um serviço persiste.
- [ ] orçamento CANCELADO → não aprova.
- [ ] empresa A não aprova orçamento da empresa B.
- [ ] histórico registra somente a transição real.

## 6.7 Critério de aceite

Nenhum fluxo funcional pode criar duas OS para o mesmo orçamento.

### Prompt de implementação da Etapa 1

```text
Atue como engenheiro backend sênior no repositório SmartGesso-API.

Objetivo: corrigir o fluxo Orçamento → Aprovação → Serviço sem reescrever a arquitetura.

Leia primeiro:
- prisma/schema.prisma
- src/modules/quotes/quotes.service.ts
- src/modules/quotes/quotes.controller.ts
- src/modules/service-orders/**
- test/quotes-convert-to-service.spec.ts
- docs/PLANO_REFATORACAO_BACKEND_V4.md, Etapa 1

Regras:
1. approve() deve ser a operação canônica e idempotente.
2. Um orçamento pode gerar no máximo uma ServiceOrder.
3. Não confiar em companyId vindo do body.
4. Executar aprovação, histórico, criação do serviço e convertedAt na mesma transaction.
5. Manter convert-to-service temporariamente apenas como compatibilidade e fazê-lo reutilizar a mesma regra, sem duplicar implementação.
6. Não alterar módulos não relacionados.
7. Criar/ajustar migration de unicidade segura se necessário.
8. Criar testes para repetição, concorrência, tenant isolation e cancelamento.
9. Ao final executar lint, typecheck, testes e build.
10. Mostre um resumo dos arquivos alterados, decisões tomadas e riscos residuais.
```

---

# 7. ETAPA 2 — Garantir transações atômicas em atualizações compostas

## 7.1 Quote items

Problema atual: `quoteItem.deleteMany()` ocorre antes da `$transaction` de atualização.

Corrigir para:

```text
transaction
  ├── validar / carregar estado
  ├── deleteMany itens antigos
  ├── update quote
  ├── create itens novos
  ├── create history se necessário
  └── commit
```

Se qualquer passo falhar, tudo deve retornar ao estado anterior.

## 7.2 ServiceOrder materials

Aplicar o mesmo padrão ao substituir `ServiceOrderMaterial`.

## 7.3 Demais pontos a revisar

Pesquisar padrões do tipo:

```text
deleteMany(...)
update(...)
create(...)
```

fora de transação nos módulos:

- quotes
- service-orders
- production-orders
- inventory
- payments
- subscriptions

## 7.4 Testes

- [ ] falha após delete de item → rollback completo.
- [ ] falha ao criar novo item → itens antigos permanecem.
- [ ] material de OS não fica vazio em atualização falha.

## 7.5 Critério de aceite

Nenhuma atualização composta deixa entidade parcialmente modificada.

---

# 8. ETAPA 3 — Corrigir versionamento e duplicação de orçamento

## 8.1 Regra comercial

### Nova versão

```text
#52 v1
  ↓ nova versão
#52 v2
  ↓ nova versão
#52 v3
```

### Duplicar

```text
#52 v3
  ↓ duplicar
#53 v1
```

## 8.2 Mudanças

`createVersion()`:

- manter `quoteNumber` do original;
- calcular `MAX(version) + 1` para aquele `companyId + quoteNumber`;
- status inicial `RASCUNHO`;
- copiar itens e demais campos;
- criar histórico da nova versão.

`duplicate()`:

- obter novo número;
- definir `version = 1`.

## 8.3 Melhoria recomendada

Guardar relação opcional entre versões:

```prisma
sourceQuoteId String? @db.Char(36)
```

ou um `quoteGroupId`, caso seja necessário navegar facilmente pela família de versões no futuro.

## 8.4 Testes

- [ ] createVersion mantém número.
- [ ] createVersion incrementa versão.
- [ ] duplicate muda número e volta para v1.
- [ ] concorrência não gera duas versões iguais.

---

# 9. ETAPA 4 — Numeração concorrente segura

## 9.1 Problema

Padrão atual:

```text
SELECT último código
+ 1
```

Dois usuários podem obter o mesmo número.

## 9.2 Solução recomendada

Criar contador por tenant e tipo:

```prisma
model CompanySequence {
  companyId    String @db.Char(36)
  sequenceType String
  currentValue Int    @default(0)
  updatedAt    DateTime @updatedAt

  @@id([companyId, sequenceType])
}
```

Tipos iniciais:

```text
QUOTE
SERVICE_ORDER
PRODUCTION_ORDER
PURCHASE
ADDITIONAL
```

## 9.3 Serviço de sequência

Criar:

```text
src/modules/core/services/company-sequence.service.ts
```

Responsabilidades:

- incrementar atomicamente;
- retornar próximo número;
- operar dentro de transaction quando necessário;
- nunca receber tenant livre do frontend.

## 9.4 Critério de aceite

Testar múltiplas solicitações paralelas sem colisão de número.

---

# 10. ETAPA 5 — Segurança SaaS: guards, assinatura e permissões

## 10.1 Objetivo

Garantir que autenticação, tenant, assinatura e permissão sejam verificações independentes e consistentes.

Fluxo recomendado:

```text
JwtAuthGuard
  ↓
ActiveCompanyGuard
  ↓
CompanyAccessGuard
  ↓
PermissionsGuard (quando a rota exige permissão específica)
  ↓
Controller
```

## 10.2 Aplicar `CompanyAccessGuard`

Revisar controllers operacionais:

- clients
- works enquanto existir
- measurements
- compositions
- quotes
- service-orders
- production-orders
- inventory
- payments
- expenses
- schedule
- notifications
- uploads/attachments
- company-dashboard

Não aplicar indiscriminadamente a endpoints que precisam continuar acessíveis para resolver a suspensão, como informações mínimas de assinatura/suporte, caso sejam necessárias.

## 10.3 Aplicar permissões

Matriz inicial sugerida:

| Domínio | Owner | Manager | Sales | Finance | Installer | Production |
|---|---:|---:|---:|---:|---:|---:|
| Clientes leitura | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clientes escrita | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Orçamentos leitura | ✅ | ✅ | ✅ | ✅ | 👁 | ❌ |
| Orçamentos escrita | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Aprovar/rejeitar orçamento | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Serviços leitura | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Execução/checklist/fotos | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Financeiro | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Estoque | ✅ | ✅ | 👁 | ❌ | ✅ | ✅ |
| Produção | ✅ | ✅ | ❌ | ❌ | 👁 | ✅ |
| Usuários/configurações | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |

`*` conforme política escolhida para Manager.

A matriz real deve ficar centralizada em `company-permissions.ts` e coberta por testes.

## 10.4 Contrato de erro de assinatura

A API pode manter `HTTP 402`, mas o contrato deve ser estável:

```json
{
  "statusCode": 402,
  "code": "COMPANY_ACCESS_SUSPENDED",
  "message": "O acesso da empresa está suspenso.",
  "details": {
    "companyName": "...",
    "accessStatus": "SUSPENDED",
    "supportPhone": "..."
  }
}
```

O mobile deverá reagir ao `code`, não somente ao status HTTP.

## 10.5 Testes obrigatórios

- [ ] usuário sem vínculo não acessa tenant.
- [ ] empresa suspensa não acessa módulos operacionais.
- [ ] tenant A não consulta tenant B.
- [ ] SALES não lança despesa.
- [ ] FINANCE não altera orçamento.
- [ ] INSTALLER não visualiza custo se não permitido.

---

# 11. ETAPA 6 — Retirar "Obra" do fluxo principal de forma segura

## 11.1 Objetivo

Eliminar a dependência do usuário final em `Work` sem apagar dados antigos abruptamente.

## 11.2 Novo conceito: ambiente do orçamento

Criar:

```prisma
model QuoteEnvironment {
  id          String   @id @default(uuid()) @db.Char(36)
  companyId   String   @db.Char(36)
  quoteId     String   @db.Char(36)
  name        String
  description String?  @db.Text
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  quote        Quote         @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  measurements Measurement[]

  @@index([companyId])
  @@index([quoteId])
}
```

E evoluir `Measurement`:

```text
workId             String?       // legado temporário
quoteEnvironmentId String?       // novo vínculo
```

## 11.3 Fases de migração

### 6A — schema compatível

- adicionar `QuoteEnvironment`;
- tornar novo vínculo opcional;
- manter `workId`.

### 6B — API nova

Novos endpoints possíveis:

```text
POST   /quotes/:quoteId/environments
GET    /quotes/:quoteId/environments
PATCH  /quotes/:quoteId/environments/:id
DELETE /quotes/:quoteId/environments/:id

POST   /quotes/:quoteId/environments/:id/measurements
```

### 6C — mobile migra

O mobile deixa de pedir Obra e passa a registrar ambientes/medições no próprio orçamento.

### 6D — backfill

Para dados antigos, transformar `Work + Measurements` em ambientes quando fizer sentido ou manter consulta de histórico legado.

### 6E — depreciação

Somente depois:

- retirar `WorksModule` de novos fluxos;
- avaliar remoção futura do model.

## 11.4 O que NÃO fazer

Não apagar `Work` na primeira migration.

---

# 12. ETAPA 7 — Financeiro orientado ao Serviço

## 12.1 Problema atual

Hoje existem três fontes de verdade desconectadas:

```text
ServiceOrder.cost
ServiceOrder.saleValue
ServiceOrder.profit
```

```text
Payment → cliente/orçamento
```

```text
Expense → empresa
```

Isso permite que o lucro exibido não represente os lançamentos reais.

## 12.2 Estratégia em duas fases

### Fase 7A — integração sem ruptura

Adicionar a `Payment` e `Expense`:

```text
serviceOrderId String?
```

Adicionar relações Prisma e índices.

Regra:

- recebimento de serviço deve apontar para `ServiceOrder`;
- despesa direta deve apontar para `ServiceOrder`;
- despesa administrativa continua com `serviceOrderId = null`.

Criar categoria de vínculo:

```text
DIRECT
OVERHEAD
```

ou atributo equivalente para diferenciar custo direto e despesa geral.

### Fase 7B — domínio financeiro explícito

Quando o comportamento estiver consolidado, considerar separar:

```text
Receivable
ReceivableInstallment
Receipt
```

porque o model atual `Payment` mistura conceitos de cobrança, parcela e recebimento.

## 12.3 Resultado calculado

Criar `ServiceFinancialSummaryService` ou domínio equivalente.

Saída:

```json
{
  "serviceOrderId": "...",
  "contractValue": 10000,
  "approvedAdditionals": 1200,
  "totalContracted": 11200,
  "received": 7000,
  "receivable": 4200,
  "directExpenses": 4400,
  "inventoryConsumptionCost": 900,
  "realizedCost": 5300,
  "projectedResult": 5900,
  "realizedCashResult": 1700,
  "marginPct": 52.68
}
```

Definir claramente semântica de:

- valor contratado;
- receita recebida;
- valor a receber;
- custo previsto;
- custo realizado;
- resultado econômico;
- resultado de caixa.

Não misturar competência e caixa.

## 12.4 `profit` no ServiceOrder

Opções aceitáveis:

1. remover como campo após migração; ou
2. manter como cache/denormalização recalculada exclusivamente pelo backend.

Não permitir que `profit` seja digitado pelo cliente.

## 12.5 Corrigir relação `quoteId` de Payment

Revisar `prisma/schema.prisma` e `PaymentsService` para garantir que o modelo Prisma e o uso de `quote: { connect: ... }` estejam coerentes.

O schema deve conter relação explícita caso o service use nested connect.

## 12.6 Endpoints sugeridos

```text
GET /service-orders/:id/financial-summary
GET /service-orders/:id/expenses
POST /service-orders/:id/expenses
GET /service-orders/:id/receivables
POST /service-orders/:id/receivables
POST /receivables/:id/installments/:installmentId/receive
```

## 12.7 Testes

- [ ] despesa da empresa A não entra no serviço da empresa B.
- [ ] custo direto soma corretamente.
- [ ] despesa geral não altera custo direto do serviço.
- [ ] parcelas somam o total do recebível.
- [ ] recebimento parcial não marca tudo como recebido.
- [ ] margem usa regra documentada.

---

# 13. ETAPA 8 — Uploads privados e Attachments

## 13.1 Problema atual

O upload exige autenticação, porém o arquivo fica em filesystem local e é exposto estaticamente por `/uploads`.

## 13.2 Modelo recomendado

```prisma
model Attachment {
  id          String   @id @default(uuid()) @db.Char(36)
  companyId   String   @db.Char(36)
  entityType  String
  entityId    String
  category    String
  storageKey  String   @unique
  originalName String?
  mimeType    String
  size        Int
  sha256      String?
  createdById String?  @db.Char(36)
  createdAt   DateTime @default(now())
  deletedAt   DateTime?

  @@index([companyId])
  @@index([entityType, entityId])
}
```

Categorias:

```text
QUOTE_PHOTO
SERVICE_BEFORE
SERVICE_DURING
SERVICE_AFTER
RECEIPT
PURCHASE_DOCUMENT
WARRANTY
COMPANY_LOGO
OTHER
```

## 13.3 Storage abstraction

Criar interface:

```text
StorageProvider
  upload()
  open/read()
  delete()
  createSignedUrl() // se provider permitir
```

Implementações possíveis:

```text
LocalPrivateStorageProvider   // transição/dev
S3CompatibleStorageProvider   // produção
```

Não acoplar controllers diretamente ao filesystem.

## 13.4 Download seguro

Opção 1:

```text
GET /attachments/:id/content
  → JwtAuthGuard
  → ActiveCompanyGuard
  → CompanyAccessGuard
  → verifica attachment.companyId
  → stream
```

Opção 2: URL assinada curta emitida somente após autorização.

## 13.5 Validações

- validar MIME real, não confiar somente em extensão do nome;
- mapear extensão a partir do MIME validado;
- limite de tamanho por categoria;
- nomes aleatórios/UUID;
- impedir path traversal;
- registrar tenant e criador;
- excluir logicamente antes de remoção física, se houver política de retenção.

## 13.6 Critério de aceite

Conhecer a URL física de um arquivo não deve ser suficiente para acessá-lo.

---

# 14. ETAPA 9 — Aditivos de Serviço

## 14.1 Motivação

Mudanças de escopo depois da aprovação não devem alterar silenciosamente o orçamento original.

## 14.2 Modelo

```prisma
model ServiceAdditional {
  id             String   @id @default(uuid()) @db.Char(36)
  companyId      String   @db.Char(36)
  serviceOrderId String   @db.Char(36)
  code           Int
  description    String   @db.Text
  amount         Decimal  @db.Decimal(15, 2)
  estimatedCost  Decimal? @db.Decimal(15, 2)
  status         String
  approvedAt     DateTime?
  rejectedAt     DateTime?
  notes          String?  @db.Text
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Status sugeridos:

```text
DRAFT
SENT
APPROVED
REJECTED
CANCELLED
```

## 14.3 Regra financeira

Somente aditivo `APPROVED` entra em `totalContracted`.

---

# 15. ETAPA 10 — Fornecedores e Compras

## 15.1 Modelos

```text
Supplier
Purchase
PurchaseItem
```

`Purchase` deve poder se relacionar com:

```text
serviceOrderId?   // compra direta para um serviço
supplierId
status
purchaseDate
invoiceNumber?
total
```

`PurchaseItem`:

```text
materialId?
description
quantity
unit
unitCost
total
```

## 15.2 Integração com estoque

Ao receber compra:

```text
Purchase RECEIVED
  ↓
InventoryMovement ENTRADA
```

Ao consumir material:

```text
ServiceOrder
  ↓
InventoryMovement CONSUMO
  ↓
Custo realizado do serviço
```

## 15.3 Evitar dupla contagem

Se compra entra em estoque, o custo do serviço deve ser reconhecido no consumo/reserva conforme a regra adotada, e não contar compra + consumo duas vezes no mesmo resultado.

Documentar o critério contábil/gerencial escolhido.

---

# 16. ETAPA 11 — Garantia e Retorno

## 16.1 Modelo sugerido

```text
ServiceWarrantyReturn
```

Campos:

```text
companyId
serviceOrderId
type: WARRANTY | RETURN | REWORK
reason
status
openedAt
scheduledAt
closedAt
cost
notes
```

Anexos devem usar `Attachment`.

## 16.2 Regra

A conclusão original do serviço não deve ser apagada. Retorno é um evento posterior e rastreável.

---

# 17. ETAPA 12 — Follow-up comercial e motivos de perda

## 17.1 Objetivo

Transformar orçamento em funil comercial mensurável.

## 17.2 Modelos possíveis

```text
QuoteFollowUp
QuoteLossReason
```

Motivos iniciais:

```text
PRICE
DEADLINE
COMPETITOR
POSTPONED
NO_RESPONSE
SCOPE_CHANGED
OTHER
```

## 17.3 Métricas futuras

- taxa de aprovação;
- tempo médio até resposta;
- ticket médio aprovado;
- motivo de perda;
- propostas sem follow-up;
- propostas vencidas;
- conversão por vendedor.

---

# 18. ETAPA 13 — Feature flags e capacidades por empresa

## 18.1 Problema

Nem toda empresa usa produção, estoque avançado ou equipe.

## 18.2 Solução

Não duplicar a verdade entre `Plan.features` e configurações da empresa sem regra clara.

Estratégia recomendada:

```text
EffectiveFeatures = Plan.features ∩ CompanyOverrides
```

Ou seja:

- plano define o que pode usar;
- empresa configura o que está habilitado entre as opções permitidas.

Capacidades iniciais:

```text
production
inventory
purchases
team
advancedFinance
warranty
pushNotifications
customBranding
```

## 18.3 Endpoint

```text
GET /companies/current/features
```

Resposta:

```json
{
  "production": false,
  "inventory": true,
  "purchases": true,
  "team": false,
  "advancedFinance": true
}
```

O backend continua autorizando a feature; esconder no mobile sozinho não é segurança.

---

# 19. ETAPA 14 — Limpeza de legado e responsabilidades

## 19.1 `BusinessService`

Revisar `src/business.service.ts`.

Objetivo:

- identificar métodos ainda utilizados;
- mover responsabilidades para módulos específicos já existentes;
- eliminar duplicação de Company/Plan/Subscription/Auth;
- remover somente quando todos os imports tiverem sido migrados.

## 19.2 `CoreModule`

`CoreModule` não deve virar um depósito de regras de negócio. Manter nele apenas infraestrutura transversal realmente compartilhada:

- guards;
- permissions;
- sequence service;
- decorators;
- utilidades de contexto.

## 19.3 Tipagem

Reduzir `any` principalmente em:

- request context;
- conversions de Prisma;
- DTOs;
- responses financeiras.

Criar tipos explícitos para `AuthenticatedRequest`/contexto ou decorators como `@CurrentCompany()`.

---

# 20. ETAPA 15 — Dinheiro e precisão numérica

## 20.1 Regra

Não usar JavaScript `number` como fonte principal de cálculo monetário no domínio financeiro quando houver operações cumulativas relevantes.

## 20.2 Recomendações

- manter `Decimal(15,2)` no banco;
- usar `Prisma.Decimal` em regras críticas;
- ou representar internamente valores monetários em centavos inteiros quando apropriado;
- converter para `number` apenas na borda de resposta quando necessário para o mobile;
- arredondamento deve ser explícito.

## 20.3 Revisar

- cálculo de orçamento;
- desconto;
- margem;
- parcelamento;
- aditivos;
- compras;
- custo de estoque;
- resultado.

---

# 21. ETAPA 16 — Testes e garantia de qualidade

## 21.1 Pirâmide recomendada

### Unitários

- regras de cálculo;
- permissões;
- status transitions;
- numeração;
- versionamento;
- financeiro.

### Integração

- Prisma + banco de teste;
- transactions;
- constraints;
- tenant isolation.

### E2E

Fluxos completos:

```text
login
→ selecionar empresa
→ cadastrar cliente
→ criar orçamento
→ aprovar
→ serviço criado
→ registrar despesa
→ registrar recebimento
→ concluir serviço
→ consultar resultado
```

## 21.2 Casos críticos obrigatórios

- [ ] tenant A nunca acessa tenant B.
- [ ] aprovação dupla não duplica serviço.
- [ ] refresh token antigo reutilizado revoga sessões conforme regra.
- [ ] empresa suspensa não usa API operacional.
- [ ] role sem permissão recebe bloqueio.
- [ ] update falho não perde itens.
- [ ] sequência concorrente não colide.
- [ ] parcelas somam exatamente o total.
- [ ] upload de tenant A não é acessível por tenant B.

## 21.3 Bug a revisar no refresh reuse

No fluxo de detecção de refresh token reutilizado, revisar blocos `try/catch` para garantir que a exceção de reuso não seja engolida pelo próprio `catch`. A revogação pode acontecer, mas o comportamento/erro deve permanecer explícito e testado.

---

# 22. ETAPA 17 — Observabilidade e operação em produção

## 22.1 Logging

Migrar gradualmente `console.error` para logger estruturado.

Campos úteis:

```text
requestId
userId
companyId
route
method
statusCode
durationMs
errorCode
entityType
entityId
```

Nunca logar:

- senha;
- JWT completo;
- refresh token;
- chaves bancárias completas quando desnecessário;
- documento sensível sem mascaramento.

## 22.2 AuditLog

Aproveitar `AuditLog` para ações sensíveis:

- aprovação/rejeição;
- exclusão lógica;
- alteração financeira;
- baixa de parcela;
- alteração de permissão;
- suspensão/reactivação;
- upload/exclusão de documento.

## 22.3 Health

Health check deve separar, quando possível:

```text
liveness
readiness
DB connectivity
```

## 22.4 Migrations de produção

Produção deve usar:

```text
prisma migrate deploy
```

Nunca `migrate dev`.

---

# 23. ETAPA 18 — Contrato OpenAPI e geração do client mobile

O `package.json` do mobile possui um TODO para geração de client.

Backend já expõe Swagger em desenvolvimento.

Recomendação:

1. estabilizar DTOs/responses principais;
2. exportar OpenAPI no CI;
3. gerar tipos/client consumidos pelo mobile;
4. reduzir divergências como `array puro` vs `{ data, total }`.

## 23.1 Padronizar paginação

Escolher um contrato único para listas:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

Aplicar primeiro aos módulos que podem crescer muito:

- clients;
- quotes;
- service-orders;
- payments/receivables;
- expenses;
- notifications;
- audit logs.

---

# 24. Ordem recomendada de implementação

```text
FASE 1 — Estabilização P0
  1. Aprovação → Serviço idempotente
  2. Transactions
  3. Versionamento
  4. Sequence segura

FASE 2 — Segurança SaaS
  5. CompanyAccessGuard
  6. PermissionsGuard
  7. Error contract
  8. Testes tenant/roles

FASE 3 — Domínio principal
  9. QuoteEnvironment
 10. Measurement sem Work obrigatório
 11. Mobile migra
 12. Work entra em depreciação

FASE 4 — Financeiro
 13. serviceOrderId em Expense/Payment
 14. financial summary
 15. recebíveis/parcelas/recebimentos

FASE 5 — Arquivos
 16. Attachment
 17. storage privado
 18. migração do upload atual

FASE 6 — Expansão de produto
 19. Aditivos
 20. Fornecedores/Compras
 21. Garantia/Retorno
 22. Follow-up
 23. Feature flags

FASE 7 — Consolidação
 24. limpar legado
 25. OpenAPI client
 26. observabilidade
 27. ampliar testes/CI
```

---

# 25. Checklist de definição de pronto por etapa

Uma etapa NÃO está pronta apenas porque compilou.

Considere pronta somente quando:

- [ ] regra de negócio documentada;
- [ ] migration criada quando necessária;
- [ ] migration reversível/segura operacionalmente;
- [ ] tenant isolation testado;
- [ ] permissão testada;
- [ ] testes unitários relevantes criados;
- [ ] integração/E2E criada para fluxo crítico;
- [ ] lint verde;
- [ ] typecheck verde;
- [ ] testes verdes;
- [ ] build verde;
- [ ] OpenAPI atualizado se contrato mudou;
- [ ] mobile possui estratégia de compatibilidade;
- [ ] nenhum segredo foi versionado;
- [ ] nenhuma alteração não relacionada entrou no commit.

---

# 26. PROMPT MESTRE — Implementação segura do backend

Use este prompt para executar as alterações **uma etapa por vez**.

```text
Você é o engenheiro backend sênior responsável por evoluir o SmartGesso-API sem quebrar o produto existente.

CONTEXTO
- Stack: NestJS 11 + Prisma + MySQL + JWT + Argon2.
- O sistema é SaaS multiempresa.
- companyId deve vir do contexto autenticado, nunca de input confiável do usuário.
- O fluxo de negócio alvo é Cliente → Orçamento → Serviço → Execução/Financeiro → Resultado → Garantia.
- O mobile depende desta API e mudanças breaking precisam de compatibilidade progressiva.

DOCUMENTO OBRIGATÓRIO
Leia integralmente docs/PLANO_REFATORACAO_BACKEND_V4.md antes de alterar código.
Trabalhe SOMENTE na etapa que eu indicar.

ANTES DE CODIFICAR
1. Inspecione os arquivos atuais relacionados à etapa.
2. Liste resumidamente o comportamento atual.
3. Identifique dependências de schema, DTO, service, controller, guard e testes.
4. Verifique se já existe implementação equivalente para não duplicar lógica.
5. Preserve compatibilidade com dados existentes.

REGRAS DE IMPLEMENTAÇÃO
1. Não reescreva o projeto.
2. Não altere módulos não relacionados.
3. Não remova tabela/coluna legada na mesma fase em que introduzir a substituta.
4. Toda operação composta que precisa ser atômica deve usar Prisma transaction.
5. Toda query de entidade tenant-scoped deve incluir companyId ou passar por mecanismo equivalente comprovadamente seguro.
6. Nunca confie em companyId vindo de body/query do cliente.
7. Não use any sem necessidade; crie tipos explícitos quando possível.
8. Não use console.log/error como solução permanente de observabilidade.
9. Não exponha segredos, tokens ou arquivos privados.
10. Para dinheiro, preserve Decimal/precisão e arredondamento explícito.
11. Alterações de status devem validar transições permitidas.
12. Endpoints devem ser idempotentes quando a operação de negócio exigir isso.
13. Se criar migration, explique como ela convive com a versão anterior do mobile/API.
14. Não use destructive migration sem plano de backfill e rollback.
15. Mantenha o padrão NestJS já adotado no repositório.

TESTES OBRIGATÓRIOS
Para toda regra crítica, inclua pelo menos:
- caminho feliz;
- erro de validação;
- tenant incorreto;
- permissão quando aplicável;
- repetição/idempotência quando aplicável;
- rollback quando houver transaction;
- concorrência quando houver geração de número ou criação única.

VALIDAÇÃO FINAL
Execute e corrija até ficar verde:
- npm run lint
- npm run typecheck
- npm test
- npm run build

Se houver migration, valide também:
- prisma validate
- prisma generate

SAÍDA FINAL
Ao terminar, apresente:
1. Resumo do que foi alterado.
2. Arquivos modificados.
3. Migration criada e impacto.
4. Testes adicionados/alterados.
5. Contrato de API alterado, se houver.
6. Compatibilidade com mobile atual.
7. Riscos residuais.
8. Próxima etapa recomendada.

IMPORTANTE
Não comece outra etapa automaticamente. Termine e estabilize a etapa atual primeiro.
```

---

# 27. Sugestões finais de engenharia

## 27.1 Não trocar NestJS/Prisma agora

Não há motivo técnico forte para substituir a stack. O ganho virá de melhorar domínio, contratos, segurança e testes.

## 27.2 Tratar Serviço como unidade operacional central

Depois da aprovação, o serviço deve concentrar:

- execução;
- agenda;
- equipe;
- materiais;
- estoque;
- compras;
- despesas;
- recebíveis;
- fotos;
- aditivos;
- resultado;
- garantia.

Isso evita múltiplos módulos desconectados representando o mesmo trabalho do cliente.

## 27.3 Manter Orçamento imutável após aprovação

Mudança de escopo deve virar `ServiceAdditional`, não edição silenciosa do orçamento aprovado.

## 27.4 Não remover Work/Obra de uma vez

A direção é removê-lo do fluxo principal, mas preservar compatibilidade durante a migração de medições e histórico.

## 27.5 Financeiro: separar projetado, realizado e caixa

Nunca mostrar um único "lucro" sem explicar sua semântica.

Recomenda-se pelo menos:

```text
Resultado projetado
Resultado realizado
Saldo a receber
Caixa recebido
Custo realizado
```

## 27.6 Upload privado é requisito de produção

Fotos de cliente, comprovantes e documentos não devem depender de uma pasta pública.

## 27.7 Feature flags são importantes para posicionamento do produto

O SmartGesso deve funcionar tanto para profissional autônomo quanto para empresa com produção/estoque/equipe. O backend deve fornecer capabilities efetivas.

## 27.8 Gerar client OpenAPI

Isso reduz bugs de contrato, especialmente divergências de arrays, paginação, enums e respostas.

## 27.9 Criar CI mínimo

Em todo PR:

```text
install
→ lint
→ typecheck
→ prisma validate
→ tests
→ build
```

## 27.10 Definir política de backup/migration

Antes de evoluir financeiro e anexos, documentar:

- backup automático;
- retenção;
- teste de restore;
- procedure de migrate deploy;
- rollback de aplicação.

## 27.11 Evitar microserviços prematuros

A aplicação ainda se beneficia de um **monólito modular**. Separar serviços agora aumentaria complexidade operacional sem resolver os problemas atuais.

## 27.12 Prioridade de negócio recomendada

Depois dos P0/P1, a ordem que tende a gerar mais valor é:

```text
Financeiro por Serviço
→ Aditivos
→ Compras/Fornecedores
→ Garantia/Retorno
→ Follow-up comercial
→ funcionalidades avançadas de produção
```

---

# 28. Resultado esperado após o plano

Ao final das fases principais, o backend deve conseguir responder com rastreabilidade completa:

```text
Qual cliente?
Qual orçamento originou o serviço?
Qual versão foi aprovada?
Qual serviço foi criado?
Qual era o valor contratado?
Quais aditivos foram aprovados?
Quanto foi recebido?
Quanto falta receber?
Quais despesas pertencem ao serviço?
Quais materiais foram consumidos?
Quais compras abasteceram o estoque?
Qual foi o custo realizado?
Qual o resultado e a margem?
Quais fotos/documentos pertencem ao serviço?
Houve garantia ou retorno?
Quem executou cada ação?
```

Quando essas respostas forem derivadas de dados relacionais consistentes — e não de valores manuais desconectados — o SmartGesso estará com uma base adequada para evoluir como SaaS de gestão operacional e financeira.