# SmartGesso API — Plano de Refatoração e Evolução do Backend V4

> **Documento de execução técnica para Hermes / implementação incremental**  
> Repositório: `SmartGesso-API`  
> Data-base da auditoria: 24/08/2026  
> Stack atual: NestJS 11 + Prisma + MySQL + JWT + Argon2  
> Documento complementar: `SmartGesso-Mobile/docs/PLANO_REFATORACAO_FRONTEND_V4.md`

---

# 1. Objetivo deste documento

Este documento é a **especificação autoritativa de refatoração do backend**. Ele não deve ser executado inteiro de uma vez.

A regra de execução é:

```text
1 etapa
  ↓
1 /goal no Hermes
  ↓
implementar
  ↓
testar
  ↓
revisar diff
  ↓
commit/PR
  ↓
só então iniciar a próxima etapa
```

A direção de produto é:

```text
Cliente
  ↓
Orçamento
  ↓ aprovado
Serviço
  ↓
Execução + Materiais + Compras + Despesas + Recebimentos
  ↓
Resultado
  ↓
Garantia / Retorno
```

Princípios obrigatórios em todas as etapas:

1. `companyId` vem do contexto autenticado; nunca confiar em `companyId` enviado pelo cliente.
2. Toda entidade de negócio deve respeitar isolamento multiempresa.
3. Orçamento aprovado gera **no máximo um Serviço**.
4. Alterações compostas precisam ser atômicas quando uma falha parcial puder corromper o estado.
5. `Work/Obra` será removido do fluxo principal de forma progressiva, não apagado abruptamente.
6. Dinheiro deve possuir semântica clara e rastreável.
7. O backend é a fonte da verdade para autorização, regras de negócio e cálculos financeiros.
8. Arquivos privados não podem depender de URL pública estática.
9. Mudanças breaking devem possuir estratégia de compatibilidade com o Mobile.
10. Não iniciar uma etapa seguinte automaticamente.

---

# 2. Diagnóstico atual — o que preservar e o que corrigir

## 2.1 Preservar

- NestJS modular.
- Prisma + MySQL.
- `Company`, `CompanyMember` e contexto de empresa ativa.
- JWT de access e refresh separados.
- refresh token persistido como hash.
- rotação/revogação de sessão.
- `ActiveCompanyGuard`, `CompanyAccessGuard`, `PermissionsGuard` e `PlatformAdminGuard`.
- soft delete onde já faz sentido.
- histórico do orçamento.
- PDF de orçamento.
- Helmet, CORS allowlist, ValidationPipe e rate limiting.
- React Native consumindo API versionada.

## 2.2 Problemas P0 identificados

1. `approve()` e `convertToService()` possuem responsabilidades sobrepostas.
2. substituição de itens/materiais executa deleções fora de transaction.
3. `createVersion()` altera `quoteNumber` quando deveria manter o mesmo número.
4. sequências usam “último + 1” e podem colidir em concorrência.
5. criação manual de Serviço conflita com o fluxo principal de negócio.

## 2.3 Problemas P1

1. guards de assinatura/permissões não estão aplicados de forma consistente.
2. API e Mobile divergem sobre `402/403` para empresa suspensa.
3. `Work` continua central no fluxo de medição/orçamento.
4. `Expense` não pertence a Serviço.
5. `Payment` não possui vínculo principal com Serviço.
6. `ServiceOrder.cost/profit` pode divergir do financeiro real.
7. uploads autenticados tornam-se públicos após gravação.

---

# 3. Arquitetura alvo de domínio

```text
Company
 ├── CompanyMember
 ├── Client
 │    └── Quote
 │         ├── QuoteEnvironment
 │         │    ├── Measurement
 │         │    └── Attachment
 │         ├── QuoteItem
 │         ├── QuoteHistory
 │         ├── QuoteFollowUp
 │         └── ServiceOrder
 │              ├── ServiceOrderMaterial
 │              ├── InventoryMovement
 │              ├── Expense
 │              ├── Receivable
 │              │    ├── ReceivableInstallment
 │              │    └── Receipt
 │              ├── ServiceAdditional
 │              ├── Attachment
 │              ├── Purchase
 │              └── WarrantyReturn
 ├── Supplier
 ├── Material
 ├── ProductionOrder (opcional)
 └── ScheduleEvent
```

`ServiceOrder` continua sendo o nome técnico interno para evitar conflito com `Service` do catálogo. Na UX, o nome deve ser **Serviço**.

---

# 4. Como usar este documento no Hermes

Para cada etapa abaixo existe um bloco `GOAL HERMES` pronto.

Use:

```text
/goal draft <conteúdo do bloco da etapa>
```

Antes de iniciar a próxima etapa:

```text
/goal status
```

Depois da revisão:

```text
/goal clear
```

Não use:

```text
/goal implemente todo este documento
```

---

# ETAPA 0 — Baseline técnico e proteção contra regressão

## Objetivo de negócio

Garantir que as próximas alterações não sejam feitas sobre uma base já quebrada e que seja possível diferenciar regressão nova de problema preexistente.

## Objetivo técnico

Criar uma referência verificável do estado atual da API, banco, migrations e testes.

## Problema que resolve

Sem baseline, uma grande refatoração pode introduzir falhas e a equipe não consegue provar se o problema já existia antes.

## Arquivos/domínios a analisar

- `package.json`
- lockfile
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `src/app.module.ts`
- `src/main.ts`
- `test/**`
- `.env.example`
- docs atuais de deploy/migrations

## Alterações obrigatórias

### 0.1 Qualidade

Executar e registrar resultado de:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate
npx prisma generate
```

Se algum script não existir, identificar o equivalente; não inventar script silenciosamente.

### 0.2 Banco

- conferir migrations existentes;
- conferir se o schema representa o banco esperado;
- documentar migrations pendentes;
- não executar migration destrutiva em produção nesta etapa;
- registrar estratégia de backup antes das etapas com alteração estrutural.

### 0.3 Contrato atual

Registrar os endpoints críticos atuais:

```text
/auth
/clients
/quotes
/service-orders
/payments
/expenses
/uploads
```

### 0.4 Testes de fumaça

Criar apenas se inexistentes:

- API inicia;
- health/liveness responde;
- Prisma conecta no ambiente de teste;
- um request autenticado básico funciona.

## O que NÃO alterar

- não mudar regra de negócio;
- não renomear modelos;
- não alterar fluxo de Orçamento;
- não mexer em financeiro;
- não remover código legado.

## Critério de aceite

- baseline documentado;
- lint/typecheck/tests/build conhecidos;
- migrations conhecidas;
- nenhum comportamento funcional alterado.

## GOAL HERMES — ETAPA 0

```text
/goal draft
Você está trabalhando no repositório SmartGesso-API.

OBJETIVO DA ETAPA
Criar uma baseline técnica confiável antes da refatoração V4, sem modificar regra de negócio.

LEIA PRIMEIRO
- docs/PLANO_REFATORACAO_BACKEND_V4.md — ETAPA 0
- package.json e lockfile
- prisma/schema.prisma
- prisma/migrations/**
- src/main.ts
- src/app.module.ts
- test/**

O QUE DEVE FAZER
1. Inspecionar scripts e dependências atuais.
2. Executar lint, typecheck, testes, build, prisma validate e prisma generate usando os comandos reais disponíveis.
3. Identificar falhas preexistentes e corrigi-las somente se forem claramente de baseline e não alterarem regra de negócio; documentar qualquer correção.
4. Revisar migrations existentes e registrar riscos/pêndencias.
5. Confirmar os endpoints críticos atuais de auth, clients, quotes, service-orders, payments, expenses e uploads.
6. Criar testes de fumaça mínimos somente se inexistentes.
7. Produzir um resumo objetivo da baseline ao final.

NÃO DEVE
- alterar schema funcionalmente;
- mudar fluxos de negócio;
- remover Work/Obra;
- mudar financeiro;
- iniciar Etapa 1.

CRITÉRIO DE CONCLUSÃO
A etapa termina somente quando a baseline estiver documentada e os comandos de qualidade tiverem resultado conhecido e reproduzível.
```

---

# ETAPA 1 — Aprovação de orçamento cria um único Serviço

## Objetivo de negócio

Transformar a aprovação do cliente em uma operação simples e confiável: **aprovar um orçamento deve resultar automaticamente em exatamente um Serviço**.

## Objetivo técnico

Unificar `approve()` e `convertToService()` em uma única regra idempotente e transacional.

## Problema atual

Hoje existe sobreposição:

```text
approve()
  → APROVADO
  → cria ServiceOrder
  → convertedAt

convertToService()
  → exige APROVADO
  → cria ServiceOrder
  → convertedAt
```

Isso faz o Mobile poder aprovar e, em seguida, tentar converter novamente.

## Arquivos a analisar/alterar

Principais:

- `src/modules/quotes/quotes.service.ts`
- `src/modules/quotes/quotes.controller.ts`
- `src/modules/quotes/dto/**`
- `src/modules/service-orders/**`
- `prisma/schema.prisma`
- `test/quotes-convert-to-service.spec.ts`

Possíveis novos testes:

- `test/quotes-approve.spec.ts`
- `test/e2e/quotes-approve.e2e-spec.ts`

## Alterações obrigatórias

### 1.1 Regra canônica

`POST /quotes/:id/approve` passa a:

1. localizar orçamento por `id + companyId`;
2. validar estado;
3. detectar se já existe Serviço originado daquele orçamento;
4. abrir transaction;
5. marcar `APROVADO` somente se necessário;
6. registrar histórico somente se houve transição real;
7. criar ServiceOrder se ainda não existir;
8. marcar `convertedAt` de forma coerente;
9. retornar orçamento + Serviço.

### 1.2 Idempotência

Segunda chamada para o mesmo orçamento deve retornar o mesmo Serviço, não criar outro e não retornar erro de duplicidade funcional.

### 1.3 Constraint

Garantir no banco que um orçamento não gere duas OS. Preferência:

```prisma
@@unique([companyId, quoteId])
```

se compatível com o schema atual.

### 1.4 Endpoint legado

`POST /quotes/:id/convert-to-service`:

- manter temporariamente;
- marcar como deprecated;
- internamente reutilizar a mesma regra;
- não duplicar implementação.

Remoção ocorrerá somente depois do Mobile migrar.

### 1.5 Response

Contrato sugerido:

```json
{
  "quote": { "id": "...", "status": "APROVADO" },
  "serviceOrder": { "id": "...", "code": 123, "status": "PENDENTE" },
  "serviceOrderCreated": true
}
```

## Não alterar nesta etapa

- não remover `Work`;
- não reestruturar financeiro;
- não alterar UI Mobile;
- não criar Aditivos/Compras;
- não renomear `ServiceOrder` no Prisma.

## Testes obrigatórios

- RASCUNHO → aprovação cria 1 Serviço;
- ENVIADO → aprovação cria 1 Serviço;
- APROVADO novamente → retorna Serviço existente;
- concorrência → banco termina com 1 Serviço;
- CANCELADO → não aprova;
- tenant A não aprova quote de B;
- histórico não duplica aprovação;
- endpoint legado retorna a mesma entidade sem duplicação.

## Critério de aceite

Para qualquer `Quote`, existe **0 ou 1** `ServiceOrder` de origem. Nunca 2.

## GOAL HERMES — ETAPA 1

```text
/goal draft
Leia integralmente docs/PLANO_REFATORACAO_BACKEND_V4.md e implemente SOMENTE a ETAPA 1.

OBJETIVO DE NEGÓCIO
Fazer com que aprovar um orçamento gere automaticamente exatamente um Serviço, sem segunda conversão manual e sem duplicidade.

OBJETIVO TÉCNICO
Tornar POST /quotes/:id/approve a operação canônica, transacional e idempotente; convert-to-service ficará temporariamente apenas como compatibilidade e reutilizará a mesma regra.

ANALISE E ALTERE PRINCIPALMENTE
- prisma/schema.prisma
- src/modules/quotes/quotes.service.ts
- src/modules/quotes/quotes.controller.ts
- src/modules/quotes/dto/**
- src/modules/service-orders/**
- test/quotes-convert-to-service.spec.ts
- novos testes de approve/e2e se necessários

ALTERAÇÕES OBRIGATÓRIAS
1. Buscar Quote sempre pelo tenant autenticado.
2. Validar transição de status.
3. Criar ServiceOrder dentro da mesma transaction da aprovação.
4. Garantir unicidade de origem Quote→ServiceOrder no banco.
5. Retornar quote + serviceOrder + serviceOrderCreated.
6. Segunda aprovação deve retornar o serviço já existente.
7. Histórico de aprovação não deve duplicar evento quando não houve nova transição.
8. convert-to-service deve chamar a mesma regra interna e ser marcado deprecated.
9. Adicionar testes de concorrência, repetição, cancelamento e isolamento tenant.

NÃO ALTERE
- financeiro;
- Work/Obra;
- uploads;
- módulos de produto avançado;
- frontend.

VALIDAÇÃO
Execute lint, typecheck, testes, build, prisma validate e prisma generate.

CONCLUSÃO
Só considere concluído quando for impossível persistir duas OS para o mesmo orçamento e todos os testes relevantes estiverem verdes.
```

---

# ETAPA 2 — Transactions e integridade de atualizações compostas

## Objetivo de negócio

Impedir que uma falha de rede, banco ou validação deixe orçamento ou Serviço parcialmente alterado.

## Objetivo técnico

Mover operações relacionadas de `delete/update/create` para transactions atômicas.

## Problemas atuais

- `QuoteItem.deleteMany()` pode ocorrer antes da transaction do update.
- `ServiceOrderMaterial.deleteMany()` possui risco equivalente.

## Arquivos principais

- `src/modules/quotes/quotes.service.ts`
- `src/modules/service-orders/service-orders.service.ts`
- `src/modules/production-orders/**`
- `src/modules/inventory/**`
- `src/modules/payments/**`
- `src/modules/subscriptions/**`

## Alterações obrigatórias

### 2.1 Quote update

Executar dentro de `prisma.$transaction`:

```text
validar estado
→ apagar itens antigos
→ atualizar quote
→ criar novos itens
→ histórico se aplicável
→ commit
```

### 2.2 ServiceOrder update

Substituição de materiais deve ser atômica.

### 2.3 Auditoria de padrões perigosos

Pesquisar combinações de:

```text
deleteMany
update
createMany/create
```

que representam uma única intenção de negócio mas estejam fora de transaction.

## O que não fazer

Não embrulhar toda operação simples em transaction desnecessariamente. O foco é **consistência de uma intenção composta**.

## Testes

- falha após `deleteMany` → rollback;
- falha ao criar novo item → itens antigos permanecem;
- falha de material → OS permanece íntegra.

## Critério de aceite

Nenhuma atualização composta auditada termina em estado parcial observável.

## GOAL HERMES — ETAPA 2

```text
/goal draft
Implemente SOMENTE a ETAPA 2 de docs/PLANO_REFATORACAO_BACKEND_V4.md.

OBJETIVO
Garantir atomicidade nas atualizações compostas do SmartGesso-API.

ANALISE
- quotes.service.ts
- service-orders.service.ts
- production-orders
- inventory
- payments
- subscriptions

FAÇA
1. Identifique delete/update/create que pertencem à mesma intenção de negócio.
2. Mova Quote item replacement para uma transaction única.
3. Mova ServiceOrder material replacement para uma transaction única.
4. Corrija outros casos realmente equivalentes encontrados, mas documente por que pertencem ao escopo.
5. Não altere regra funcional além da atomicidade.
6. Crie testes que forcem falha intermediária e comprovem rollback.

NÃO FAÇA
- não mude versionamento;
- não mude sequência;
- não mude financeiro;
- não remova Obra;
- não avance para Etapa 3.

CONCLUSÃO
Todos os fluxos compostos corrigidos precisam ser comprovadamente atômicos por testes.
```

---

# ETAPA 3 — Versionamento correto de orçamento

## Objetivo de negócio

Preservar a história comercial: uma revisão do mesmo orçamento mantém o número; uma cópia nova recebe outro número.

## Regra alvo

```text
Nova versão:
#52 v1 → #52 v2 → #52 v3

Duplicar:
#52 v3 → #53 v1
```

## Arquivos principais

- `src/modules/quotes/quotes.service.ts`
- DTOs/types de Quote
- `prisma/schema.prisma` se for necessário `sourceQuoteId`/`quoteGroupId`
- testes de quote/version

## Alterações obrigatórias

### 3.1 `createVersion()`

- manter `quoteNumber`;
- obter próxima versão para `companyId + quoteNumber`;
- copiar itens, local, prazo, pagamento e campos comerciais necessários;
- novo status `RASCUNHO`;
- não alterar versão original.

### 3.2 `duplicate()`

- gerar novo `quoteNumber`;
- `version = 1`;
- copiar conteúdo apropriado;
- manter histórico de origem opcional.

### 3.3 Rastreabilidade

Preferível adicionar uma relação de origem/família somente se isso simplificar navegação e auditoria sem criar complexidade desnecessária.

## Testes

- version mantém número;
- version incrementa versão;
- duplicate troca número e volta v1;
- original permanece imutável;
- tenant isolado;
- concorrência não cria duas `v2`.

## GOAL HERMES — ETAPA 3

```text
/goal draft
Implemente SOMENTE a ETAPA 3 do plano backend V4.

OBJETIVO
Corrigir a semântica comercial de versionamento de orçamento.

REGRAS
- nova versão mantém quoteNumber;
- nova versão incrementa version;
- duplicar gera novo quoteNumber e version 1;
- original não pode ser alterado;
- copie todos os campos comerciais que o documento define como parte do snapshot;
- preserve tenant isolation;
- trate concorrência de versão.

ARQUIVOS
Analise quotes.service.ts, DTOs de Quote, schema Prisma e testes relacionados.

NÃO ALTERE
financeiro, Work, uploads ou Mobile.

CRITÉRIO
#52 v1 → nova versão = #52 v2; duplicar #52 v2 → novo número v1.
```

---

# ETAPA 4 — Numeração concorrente segura

## Objetivo de negócio

Evitar que dois usuários trabalhando simultaneamente recebam o mesmo número de orçamento, Serviço ou outro documento.

## Objetivo técnico

Substituir “buscar maior código + 1” por sequência atômica por empresa e tipo.

## Arquivos principais

- `prisma/schema.prisma`
- novo serviço em `src/modules/core/services/` ou módulo específico de sequence
- `quotes.service.ts`
- `service-orders.service.ts`
- production/purchase quando aplicável

## Modelo sugerido

```prisma
model CompanySequence {
  companyId    String
  sequenceType String
  currentValue Int      @default(0)
  updatedAt    DateTime @updatedAt

  @@id([companyId, sequenceType])
}
```

## Alterações obrigatórias

- incremento atômico;
- transação compatível com criação da entidade;
- sequências separadas por tenant;
- tipos iniciais `QUOTE`, `SERVICE_ORDER` e os realmente existentes;
- backfill/inicialização sem reiniciar numeração existente.

## Testes

Executar solicitações paralelas e verificar números distintos e sequenciais.

## GOAL HERMES — ETAPA 4

```text
/goal draft
Implemente SOMENTE a ETAPA 4.

OBJETIVO
Eliminar colisões de numeração causadas pelo padrão SELECT último + 1.

FAÇA
1. Levante todos os lugares que geram número sequencial.
2. Crie CompanySequence ou mecanismo equivalente atômico por tenant e tipo.
3. Inicialize sem perder a numeração existente.
4. Use a sequência nos fluxos de Quote e ServiceOrder primeiro; aplique aos outros tipos já existentes que usam o mesmo padrão.
5. Teste concorrência real/integração.

NÃO MUDE
regra de negócio dos documentos, financeiro, Work ou uploads.

CRITÉRIO
Duas requisições simultâneas nunca persistem o mesmo código dentro do mesmo tenant.
```

---

# ETAPA 5 — Segurança SaaS: assinatura, permissões e contrato de erros

## Objetivo de negócio

Garantir que uma empresa suspensa ou um usuário sem permissão não continue operando o sistema apenas porque possui token válido.

## Objetivo técnico

Aplicar guards de forma consistente e padronizar códigos de erro consumidos pelo Mobile.

## Arquivos principais

- `src/modules/core/guards/**`
- `src/modules/core/company-permissions.ts`
- controllers operacionais
- auth/session quando necessário
- testes de autorização

## Alterações obrigatórias

### 5.1 Pipeline

Rota operacional deve seguir, conforme aplicável:

```text
JwtAuthGuard
→ ActiveCompanyGuard
→ CompanyAccessGuard
→ PermissionsGuard
→ controller
```

### 5.2 Controllers a revisar

- clients
- works/measurements enquanto existirem
- quotes
- service-orders
- production-orders
- inventory
- payments
- expenses
- schedule
- notifications
- uploads/attachments
- dashboards

### 5.3 Permissões

Centralizar matriz em `company-permissions.ts`; não espalhar enums ad hoc.

### 5.4 Suspensão

Manter contrato estável por `code`, por exemplo:

```json
{
  "statusCode": 402,
  "code": "COMPANY_ACCESS_SUSPENDED",
  "message": "O acesso da empresa está suspenso.",
  "details": {}
}
```

Mobile deve reagir ao `code`; não dependa exclusivamente de 402/403.

### 5.5 Exceções deliberadas

Rotas necessárias para recuperar acesso, suporte, trocar empresa ou consultar situação não devem ser bloqueadas de forma circular.

## Testes

- tenant A não acessa B;
- empresa suspensa não opera;
- SALES não lança despesa se política proibir;
- FINANCE não altera orçamento se política proibir;
- INSTALLER não vê custos sem permissão;
- Owner/Manager conforme matriz.

## GOAL HERMES — ETAPA 5

```text
/goal draft
Implemente SOMENTE a ETAPA 5 do plano backend V4.

OBJETIVO
Fechar lacunas de autorização SaaS sem quebrar login, seleção de empresa ou recuperação de acesso.

FAÇA
1. Audite todos os controllers operacionais e guards atuais.
2. Aplique CompanyAccessGuard onde operação deve ser bloqueada por assinatura/status.
3. Aplique PermissionsGuard/RequirePermissions conforme matriz central.
4. Centralize códigos de erro estáveis, principalmente COMPANY_ACCESS_SUSPENDED.
5. Garanta que rotas de suporte/seleção necessárias não entrem em deadlock de autorização.
6. Crie testes por role, tenant e assinatura.

NÃO FAÇA
- não reestruture Financeiro;
- não remova Work;
- não mude uploads além do necessário para guard;
- não altere Mobile.

CRITÉRIO
Token válido não é suficiente para operar se empresa estiver suspensa ou role não possuir permissão.
```

---

# ETAPA 6 — Remover Obra do fluxo principal e criar Ambientes do Orçamento

## Objetivo de negócio

Permitir que o profissional faça orçamento e medição diretamente no contexto do cliente/local, sem cadastrar “Obra” como entidade intermediária obrigatória.

## Objetivo técnico

Introduzir `QuoteEnvironment` e migrar `Measurement` progressivamente de `Work` para ambiente do orçamento.

## Arquivos principais

- `prisma/schema.prisma`
- módulo `works`
- módulo `measurements`
- módulo `quotes`
- novo módulo/serviço de `quote-environments`
- cálculo de composição/material
- testes de backfill/compatibilidade

## Alterações obrigatórias

### 6.1 Schema compatível

Criar `QuoteEnvironment` com:

- `companyId`
- `quoteId`
- `name`
- `description?`
- `order`
- timestamps

E permitir em `Measurement`:

```text
workId             opcional/legado
quoteEnvironmentId novo vínculo
```

Não remover `workId` agora.

### 6.2 Endpoints

Implementar contrato equivalente a:

```text
GET    /quotes/:quoteId/environments
POST   /quotes/:quoteId/environments
PATCH  /quotes/:quoteId/environments/:environmentId
DELETE /quotes/:quoteId/environments/:environmentId
POST   /quotes/:quoteId/environments/:environmentId/measurements
PATCH  /quotes/:quoteId/environments/:environmentId/measurements/:id
```

### 6.3 Tenant

Todo `quoteId`, `environmentId` e `measurementId` precisa ser validado contra `companyId` ativo.

### 6.4 Cálculo de materiais

Adaptar composição para consumir medições dos ambientes sem depender de Work.

### 6.5 Compatibilidade

- manter endpoints legados de Work durante migração;
- não apagar dados antigos;
- documentar depreciação.

## Não fazer

- não dropar tabela Work;
- não migrar todo histórico automaticamente sem regra validada;
- não alterar Financeiro.

## Testes

- criar ambiente no quote correto;
- impedir ambiente em quote de outro tenant;
- medição funciona sem Work;
- cálculo de materiais funciona com novo vínculo;
- dados legados continuam consultáveis.

## GOAL HERMES — ETAPA 6

```text
/goal draft
Implemente SOMENTE a ETAPA 6.

OBJETIVO DE NEGÓCIO
Eliminar Obra como passo obrigatório do novo orçamento, permitindo ambientes e medições diretamente dentro do Quote.

OBJETIVO TÉCNICO
Adicionar QuoteEnvironment e novo vínculo de Measurement sem remover Work nesta fase.

ALTERE
- prisma/schema.prisma
- módulos quotes, measurements e works quando necessário
- crie módulo/serviço de QuoteEnvironment
- adapte composição/material para o novo vínculo
- crie migrations compatíveis
- crie testes tenant e compatibilidade

REGRAS
1. Work continua existindo para legado.
2. workId não deve ser removido agora.
3. Todo novo endpoint valida companyId do contexto.
4. Não fazer destructive migration.
5. Documentar contrato que o Mobile deverá consumir.

CRITÉRIO
É possível criar Quote → Environment → Measurement → cálculo de materiais sem criar Work.
```

---

# ETAPA 7 — Financeiro orientado ao Serviço

## Objetivo de negócio

Responder com precisão: quanto foi contratado, recebido, falta receber, quanto custou e qual foi o resultado de cada Serviço.

## Objetivo técnico

Conectar despesas e recebimentos ao `ServiceOrder` e substituir `profit` manual por resumo calculado/rastreável.

## Arquivos principais

- `prisma/schema.prisma`
- `src/modules/payments/**`
- `src/modules/expenses/**`
- `src/modules/service-orders/**`
- inventory movements
- novo módulo/service financeiro de Serviço
- DTOs e testes financeiros

## Alterações obrigatórias

### 7.1 Vínculo de despesa

Adicionar `serviceOrderId?` em Expense.

- despesa direta → Serviço;
- despesa administrativa → sem Serviço.

### 7.2 Recebíveis

Curto prazo: vincular Payment/recebimentos ao Serviço com relação Prisma coerente.

Médio prazo recomendado: separar conceitos:

```text
Receivable
ReceivableInstallment
Receipt
```

Não executar migração destrutiva em um único deploy.

### 7.3 Resumo financeiro

Criar endpoint, por exemplo:

```text
GET /service-orders/:id/financial-summary
```

Resposta deve separar:

- valor contratado;
- aditivos aprovados;
- total contratado;
- recebido;
- a receber;
- custo previsto;
- custo realizado;
- resultado projetado;
- resultado realizado/caixa conforme semântica documentada;
- margem.

### 7.4 `profit`

Não aceitar `profit` como input confiável do cliente. Se mantido no schema, deve ser cache calculado pelo backend e possuir regra de atualização explícita.

### 7.5 Estoque

Evitar dupla contagem entre compra, entrada em estoque e consumo do Serviço.

## Testes

- despesa direta entra no Serviço correto;
- despesa geral não entra;
- recebimento parcial;
- parcelas somam exatamente o total;
- tenant isolation;
- permissão financeira;
- cálculo de margem;
- arredondamento.

## GOAL HERMES — ETAPA 7

```text
/goal draft
Implemente SOMENTE a ETAPA 7 do backend V4.

OBJETIVO
Transformar o ServiceOrder na unidade financeira central e tornar o resultado auditável a partir de lançamentos reais.

ANALISE
- schema Prisma
- payments
- expenses
- service-orders
- inventory movements

FAÇA
1. Adicione vínculo opcional ServiceOrder em Expense e recebimentos com migration compatível.
2. Corrija relações Prisma inconsistentes existentes.
3. Diferencie despesa direta de despesa geral.
4. Crie ServiceFinancialSummary com contrato explícito.
5. Pare de tratar profit digitado como fonte da verdade.
6. Documente claramente competência x caixa e previsto x realizado.
7. Garanta que compra/estoque/consumo não sejam contabilizados duas vezes.
8. Crie testes financeiros e tenant/permission.

NÃO FAÇA
- não remova Payment abruptamente;
- não quebre Mobile sem compatibilidade;
- não implemente Aditivos ainda, apenas deixe summary preparado para eles se necessário.

CRITÉRIO
O resultado de um Serviço deve ser derivável de dados relacionais rastreáveis, não de um número manual isolado.
```

---

# ETAPA 8 — Anexos privados e storage abstrato

## Objetivo de negócio

Proteger fotos de clientes, comprovantes, documentos de compra e evidências de Serviço.

## Objetivo técnico

Substituir `/uploads` público por entidade `Attachment` autorizada por tenant e provider de storage.

## Arquivos principais

- `src/modules/uploads/**`
- `src/main.ts` static assets
- `prisma/schema.prisma`
- novo módulo `attachments`
- storage provider
- guards/permissões

## Alterações obrigatórias

### 8.1 Attachment

Campos mínimos:

- companyId
- entityType/entityId
- category
- storageKey
- originalName
- mimeType
- size
- hash opcional
- createdBy
- timestamps/deletedAt

### 8.2 StorageProvider

Interface:

```text
upload
read/stream
delete
signedUrl opcional
```

Implementações:

- local privado para dev/transição;
- S3-compatible para produção quando configurado.

### 8.3 Segurança

- MIME real validado;
- limite de tamanho;
- UUID para storage key;
- sem path traversal;
- download exige autorização ou URL assinada curta;
- não servir diretório privado via `useStaticAssets`.

### 8.4 Migração

Manter compatibilidade temporária com URLs antigas se houver dados reais; definir migração separada.

## GOAL HERMES — ETAPA 8

```text
/goal draft
Implemente SOMENTE a ETAPA 8.

OBJETIVO
Eliminar exposição pública de arquivos privados e criar uma arquitetura de Attachment segura e escalável.

FAÇA
1. Audite uploads.service/controller e static assets.
2. Crie model Attachment tenant-scoped.
3. Crie StorageProvider desacoplado do controller.
4. Implemente provider local privado para dev e interface pronta para S3-compatible.
5. Crie upload/list/download/delete autorizados.
6. Valide MIME, tamanho, storage key e tenant.
7. Remova exposição estática dos novos arquivos.
8. Preserve estratégia de compatibilidade para arquivos antigos.
9. Teste tenant A tentando acessar arquivo de B.

NÃO FAÇA
- não migre todos os arquivos existentes de forma destrutiva nesta etapa;
- não altere financeiro;
- não altere Mobile.

CRITÉRIO
Conhecer a URL/storageKey de um arquivo não deve ser suficiente para acessá-lo.
```

---

# ETAPA 9 — Aditivos de Serviço

## Objetivo de negócio

Registrar mudanças de escopo depois da aprovação sem alterar o orçamento original aceito pelo cliente.

## Objetivo técnico

Criar `ServiceAdditional` com ciclo de status e impacto financeiro apenas quando aprovado.

## Modelo mínimo

- companyId
- serviceOrderId
- code
- description
- amount
- estimatedCost?
- status
- approvedAt/rejectedAt
- notes
- timestamps

Status:

```text
DRAFT → SENT → APPROVED/REJECTED
                    ↓
                 CANCELLED quando aplicável
```

## Regra

Somente `APPROVED` entra em `totalContracted`.

Orçamento aprovado original permanece imutável.

## GOAL HERMES — ETAPA 9

```text
/goal draft
Implemente SOMENTE a ETAPA 9.

OBJETIVO
Adicionar Aditivos de Serviço para mudanças de escopo pós-aprovação sem editar o Quote original.

FAÇA
- criar schema/migration ServiceAdditional;
- endpoints CRUD/status tenant-scoped;
- sequência própria se necessário;
- validação de transição de status;
- integrar somente adicionais APPROVED ao financial-summary;
- audit log nas aprovações/cancelamentos;
- testes de status, tenant e cálculo.

NÃO FAÇA
- não alterar Quote aprovado;
- não permitir edição silenciosa do total original;
- não implementar Compras nesta etapa.

CRITÉRIO
É possível demonstrar contrato original + aditivos aprovados separadamente e calcular total contratado corretamente.
```

---

# ETAPA 10 — Fornecedores, Compras e integração com Estoque

## Objetivo de negócio

Transformar a necessidade de material em compra rastreável e custo real.

## Objetivo técnico

Criar `Supplier`, `Purchase`, `PurchaseItem` e integração controlada com `InventoryMovement`.

## Fluxo alvo

```text
Serviço
→ necessidade de material
→ fornecedor
→ compra
→ recebimento
→ entrada estoque
→ consumo no Serviço
→ custo realizado
```

## Alterações obrigatórias

- Supplier tenant-scoped;
- Purchase com status;
- PurchaseItem;
- vínculo opcional com ServiceOrder;
- recebimento gera movimento de entrada;
- consumo do Serviço gera movimento de saída/consumo;
- regra explícita para não contar compra + consumo duas vezes no resultado.

## GOAL HERMES — ETAPA 10

```text
/goal draft
Implemente SOMENTE a ETAPA 10.

OBJETIVO
Adicionar Fornecedores e Compras e integrar ao estoque sem dupla contagem financeira.

FAÇA
1. Criar Supplier, Purchase e PurchaseItem com companyId.
2. Definir estados de compra e transições.
3. Permitir vínculo opcional a ServiceOrder.
4. Ao receber compra, gerar InventoryMovement de entrada de forma idempotente.
5. Ao consumir material, vincular movimento ao Serviço.
6. Documentar onde o custo passa a afetar o resultado para evitar compra+consumo duplicados.
7. Criar testes de idempotência, estoque, tenant e financeiro.

NÃO FAÇA
- não tornar Produção obrigatória;
- não criar módulo contábil completo;
- não alterar Aditivos além da integração de summary se necessária.

CRITÉRIO
Uma compra recebida atualiza estoque uma única vez e o consumo pode ser rastreado até o custo do Serviço.
```

---

# ETAPA 11 — Garantia e Retorno pós-serviço

## Objetivo de negócio

Registrar atendimento após conclusão sem destruir o histórico do Serviço original.

## Objetivo técnico

Criar entidade de retorno/garantia vinculada ao Serviço, com anexos, custos e status próprios.

## Alterações

Modelo sugerido:

```text
WarrantyReturn
- companyId
- serviceOrderId
- type: WARRANTY | RETURN | REWORK
- reason
- status
- openedAt
- scheduledAt
- closedAt
- cost
- notes
```

Regras:

- Serviço original continua concluído;
- retorno tem timeline própria;
- custo de retorno pode ser classificado como garantia ou serviço cobrado;
- anexos usam Attachment.

## GOAL HERMES — ETAPA 11

```text
/goal draft
Implemente SOMENTE a ETAPA 11.

OBJETIVO
Criar fluxo rastreável de garantia/retorno sem reabrir ou sobrescrever o Serviço original.

FAÇA
- schema/migration WarrantyReturn;
- endpoints tenant-scoped;
- transições de status;
- integração com Attachment;
- custo do retorno com semântica documentada;
- testes.

NÃO FAÇA
- não alterar status do Serviço concluído automaticamente;
- não misturar retorno com Aditivo.

CRITÉRIO
O histórico mostra claramente Serviço concluído e eventos posteriores de garantia/retorno separados.
```

---

# ETAPA 12 — Follow-up comercial e motivos de perda

## Objetivo de negócio

Aumentar conversão e permitir entender por que orçamentos são perdidos.

## Objetivo técnico

Adicionar follow-ups estruturados e motivos de perda vinculados ao Quote.

## Alterações

- `QuoteFollowUp`;
- motivo estruturado na rejeição/perda;
- próxima data de contato;
- responsável quando aplicável;
- timeline;
- métricas futuras.

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

## GOAL HERMES — ETAPA 12

```text
/goal draft
Implemente SOMENTE a ETAPA 12.

OBJETIVO
Transformar Quotes enviados em funil comercial mensurável com follow-up e motivo de perda.

FAÇA
- criar QuoteFollowUp e estrutura de loss reason;
- endpoints para agendar/registrar contato;
- adaptar reject sem perder observação livre;
- gerar dados para métricas de conversão;
- tenant/permission/audit tests.

NÃO FAÇA
- não alterar lógica de aprovação já estabilizada;
- não criar CRM genérico fora do escopo.

CRITÉRIO
É possível saber quais propostas precisam de contato e por que propostas foram perdidas.
```

---

# ETAPA 13 — Feature flags e capacidades por empresa/plano

## Objetivo de negócio

Permitir que o SmartGesso atenda tanto autônomos quanto empresas com estoque, produção, equipe e financeiro avançado sem poluir todos os usuários com todos os módulos.

## Objetivo técnico

Fornecer capabilities efetivas calculadas a partir do plano e configurações permitidas.

## Alterações

Definir regra única, por exemplo:

```text
EffectiveFeatures = features permitidas pelo Plan + overrides/configuração válida da Company
```

Features iniciais:

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

Endpoint:

```text
GET /companies/current/features
```

Backend também deve bloquear endpoint de feature desabilitada; esconder no Mobile não é segurança.

## GOAL HERMES — ETAPA 13

```text
/goal draft
Implemente SOMENTE a ETAPA 13.

OBJETIVO
Criar capabilities efetivas por empresa/plano sem duplicar fontes de verdade.

FAÇA
1. Audite Plan.features e configurações existentes.
2. Defina uma regra única de resolução de feature.
3. Crie service/hook backend para consultar feature efetiva.
4. Exponha GET /companies/current/features.
5. Proteja endpoints de módulos opcionais quando feature estiver desabilitada.
6. Crie testes de combinação plano x company override x permission.

NÃO FAÇA
- não alterar UI Mobile;
- não criar novo sistema de billing;
- não duplicar feature config em vários lugares.

CRITÉRIO
Uma feature possui uma fonte de resolução clara e o backend não permite uso quando desabilitada.
```

---

# ETAPA 14 — Limpeza de legado e responsabilidades

## Objetivo de negócio

Reduzir custo de manutenção sem remover compatibilidade prematuramente.

## Objetivo técnico

Eliminar sobreposição como `BusinessService`, reduzir `any` e consolidar responsabilidades após as novas estruturas estarem estabilizadas.

## Arquivos principais

- `src/business.service.ts`
- `src/modules/core/core.module.ts`
- módulos companies/plans/subscriptions
- decorators/request context
- código legado `convert-to-service`, Works quando Mobile já estiver migrado

## Alterações obrigatórias

- mapear cada método de `BusinessService` e consumidor;
- mover para módulo responsável;
- remover somente depois de zerar imports;
- criar tipos/decorators como `CurrentCompany`/request typed quando útil;
- remover endpoint legado apenas após Mobile não usá-lo;
- iniciar depreciação real de Work somente depois do backfill/compatibilidade.

## GOAL HERMES — ETAPA 14

```text
/goal draft
Implemente SOMENTE a ETAPA 14.

OBJETIVO
Remover legado e sobreposição de responsabilidades depois que os fluxos novos estiverem comprovadamente em uso.

FAÇA
- audite BusinessService e CoreModule;
- mova responsabilidades para módulos donos;
- reduza any em contexto/request/responses;
- remova código deprecated apenas se busca no repositório provar ausência de consumidores;
- preserve migrations/dados legados necessários;
- rode suíte completa.

NÃO FAÇA
- não remova Work se Mobile/produção ainda depender;
- não remova convert-to-service se versão ativa do Mobile ainda usar;
- não faça limpeza estética fora do escopo.

CRITÉRIO
Menos duplicação, mesmos comportamentos suportados e nenhum consumidor quebrado.
```

---

# ETAPA 15 — Precisão monetária, contratos tipados e OpenAPI

## Objetivo de negócio

Evitar divergência de centavos e bugs de contrato entre API e Mobile.

## Objetivo técnico

Padronizar `Decimal`, arredondamento, responses e geração de client/tipos via OpenAPI.

## Alterações obrigatórias

### Dinheiro

- manter Decimal no banco;
- usar `Prisma.Decimal` ou centavos inteiros nas regras críticas;
- converter para number/string somente na borda com contrato definido;
- padronizar arredondamento.

Revisar:

- orçamento;
- desconto;
- margem;
- parcelamento;
- aditivos;
- compras;
- estoque;
- financeiro.

### OpenAPI

- estabilizar DTOs/responses;
- exportar spec;
- padronizar lista/paginação;
- permitir geração de client no Mobile.

Contrato sugerido de paginação:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

## GOAL HERMES — ETAPA 15

```text
/goal draft
Implemente SOMENTE a ETAPA 15.

OBJETIVO
Padronizar precisão monetária e contratos API para reduzir divergências com o Mobile.

FAÇA
- audite cálculos monetários com JS number;
- use Decimal/centavos de forma consistente;
- documente arredondamento;
- padronize responses/paginação nos módulos definidos;
- gere/exporte OpenAPI de forma reproduzível;
- prepare contrato para client gerado no Mobile;
- teste valores de borda e arredondamento.

NÃO FAÇA
- não reescreva todos os endpoints sem necessidade;
- não mude semântica financeira já definida na Etapa 7.

CRITÉRIO
Cálculos críticos são determinísticos e o contrato publicado representa o response real.
```

---

# ETAPA 16 — Testes completos, observabilidade e CI

## Objetivo de negócio

Tornar o sistema confiável para produção e reduzir regressões futuras.

## Objetivo técnico

Cobrir fluxos críticos E2E/integration, logging estruturado, audit log e pipeline automático.

## Testes críticos

```text
login
→ selecionar empresa
→ criar cliente
→ criar orçamento
→ aprovar
→ Serviço criado uma única vez
→ registrar despesa
→ registrar recebimento
→ consultar resultado
→ concluir Serviço
→ registrar retorno
```

Casos obrigatórios:

- tenant isolation;
- assinatura suspensa;
- role sem permissão;
- transaction rollback;
- sequence concorrente;
- approval idempotente;
- upload privado;
- parcelas e arredondamento.

## Observabilidade

Logger estruturado com:

- requestId
- userId
- companyId
- route
- method
- statusCode
- durationMs
- errorCode
- entityId quando aplicável

Nunca logar senha/token/refresh token.

## AuditLog

Registrar ações sensíveis:

- aprovação/rejeição;
- alterações financeiras;
- baixa de parcela;
- permissão;
- suspensão;
- anexos;
- aditivos;
- garantias.

## CI

Em PR:

```text
install
→ lint
→ typecheck
→ prisma validate
→ tests
→ build
```

## GOAL HERMES — ETAPA 16

```text
/goal draft
Implemente SOMENTE a ETAPA 16.

OBJETIVO
Consolidar a V4 com testes completos, observabilidade segura e CI reproduzível.

FAÇA
1. Levante lacunas de testes nos fluxos críticos do documento.
2. Adicione integration/E2E para tenant, approval, finance, permissions, attachments e concorrência.
3. Substitua console.error relevantes por logger estruturado.
4. Integre AuditLog às ações sensíveis.
5. Configure CI com install/lint/typecheck/prisma validate/tests/build.
6. Garanta que logs não exponham segredo.

NÃO FAÇA
- não adicionar novas features de produto;
- não refatorar arquitetura funcional fora do necessário para teste/observabilidade.

CRITÉRIO
PRs futuras falham automaticamente quando quebram contratos ou fluxos críticos protegidos.
```

---

# 5. Ordem obrigatória recomendada

```text
FASE A — ESTABILIZAÇÃO
Etapa 0  Baseline
Etapa 1  Aprovação → Serviço
Etapa 2  Transactions
Etapa 3  Versionamento
Etapa 4  Sequências

FASE B — SEGURANÇA E DOMÍNIO
Etapa 5  Guards/permissões/assinatura
Etapa 6  Ambientes e retirada progressiva de Obra

FASE C — GESTÃO OPERACIONAL E FINANCEIRA
Etapa 7  Financeiro por Serviço
Etapa 8  Anexos privados
Etapa 9  Aditivos
Etapa 10 Compras/Fornecedores
Etapa 11 Garantia/Retorno
Etapa 12 Follow-up

FASE D — PRODUTO CONFIGURÁVEL E CONSOLIDAÇÃO
Etapa 13 Feature flags
Etapa 14 Limpeza de legado
Etapa 15 Dinheiro/OpenAPI
Etapa 16 Testes/observabilidade/CI
```

Dependências importantes:

```text
Backend Etapa 1
→ Mobile Etapa 1

Backend Etapa 6
→ Mobile migração de Work para Environment

Backend Etapa 7
→ Mobile Financeiro por Serviço

Backend Etapa 8
→ Mobile Anexos privados

Backend Etapas 9-13
→ telas correspondentes no Mobile
```

---

# 6. Definição de pronto global para qualquer etapa

Uma etapa NÃO está concluída somente porque compila.

Obrigatório quando aplicável:

- [ ] comportamento alvo implementado;
- [ ] schema/migration compatível;
- [ ] sem destructive migration prematura;
- [ ] tenant isolation comprovado;
- [ ] permissions comprovadas;
- [ ] DTO/response documentado;
- [ ] testes de caminho feliz;
- [ ] testes de erro;
- [ ] testes de idempotência/rollback/concorrência quando aplicável;
- [ ] lint verde;
- [ ] typecheck verde;
- [ ] testes verdes;
- [ ] build verde;
- [ ] prisma validate/generate verdes quando schema mudou;
- [ ] OpenAPI atualizado se contrato mudou;
- [ ] compatibilidade com Mobile descrita;
- [ ] nenhum segredo/versionamento indevido;
- [ ] nenhuma alteração fora do escopo.

---

# 7. Prompt mestre para qualquer etapa

Use este bloco junto com o `/goal` específico da etapa se quiser reforçar o comportamento do Hermes:

```text
Você é o engenheiro backend sênior responsável pelo SmartGesso-API.

REGRAS GERAIS
- leia integralmente docs/PLANO_REFATORACAO_BACKEND_V4.md;
- execute somente a etapa informada;
- antes de codificar, inspecione a implementação atual e descreva resumidamente o comportamento existente;
- não programe por suposição se puder verificar o código;
- preserve NestJS + Prisma + MySQL;
- companyId vem do contexto autenticado;
- preserve compatibilidade de dados;
- qualquer migration destrutiva exige fase de backfill/compatibilidade anterior;
- operações compostas críticas devem ser transacionais;
- idempotência deve existir quando a operação puder ser repetida;
- não duplique regras já existentes;
- não faça limpeza cosmética fora da etapa;
- não comece a próxima etapa automaticamente.

ANTES DE ALTERAR
1. Liste arquivos que serão tocados.
2. Identifique contrato atual.
3. Identifique dependências de schema, DTO, service, controller, guard e testes.
4. Identifique impacto no Mobile.

VALIDAÇÃO FINAL
Execute os comandos reais disponíveis equivalentes a:
- lint
- typecheck
- tests
- build
- prisma validate
- prisma generate

SAÍDA FINAL
Informe:
1. arquivos alterados;
2. comportamento anterior;
3. comportamento novo;
4. migration/contrato;
5. testes executados;
6. riscos residuais;
7. dependência para o Mobile;
8. por que a etapa pode ser considerada concluída.
```

---

# 8. Sugestões finais de engenharia e produto

## 8.1 Não trocar NestJS/Prisma

Os principais problemas atuais são de domínio, contrato e consistência, não de framework.

## 8.2 Manter monólito modular

Microserviços agora aumentariam custo operacional sem resolver as dores atuais.

## 8.3 Serviço como hub

Depois da aprovação, tudo operacional deve convergir para o Serviço:

```text
agenda
execução
materiais
compras
estoque
fotos
aditivos
despesas
recebimentos
resultado
garantia
```

## 8.4 Orçamento aprovado é snapshot

Não editar silenciosamente o que o cliente aprovou. Antes da aprovação use versão; depois da aprovação use Aditivo.

## 8.5 Work deve desaparecer da experiência, não necessariamente do banco no primeiro dia

A migração precisa preservar histórico e compatibilidade.

## 8.6 Financeiro precisa separar conceitos

No mínimo:

```text
valor contratado
valor recebido
a receber
custo previsto
custo realizado
resultado projetado
resultado realizado/caixa
margem
```

## 8.7 Produção deve ser opcional

Capacidade por empresa/plano, não módulo obrigatório para todo cliente.

## 8.8 Compras são mais importantes que um estoque excessivamente sofisticado

A ponte real é:

```text
necessidade → fornecedor → compra → estoque → consumo → custo
```

## 8.9 OpenAPI deve virar contrato real entre API e Mobile

Eliminar adapters improvisados no frontend.

## 8.10 Segurança de anexos é requisito de produção

Fotos de residência, comprovantes e documentos não devem ser públicos.

## 8.11 Idempotência além de aprovação

Avaliar também em:

- baixa de parcela;
- recebimento de compra;
- upload finalizado;
- ações offline reenviáveis.

## 8.12 Health checks

Separar liveness, readiness e conectividade com banco quando operacionalmente útil.

## 8.13 Política de backup e restore

Antes de mudanças financeiras e anexos, ter:

- backup automático;
- retenção;
- teste de restore;
- `prisma migrate deploy` em produção;
- rollback de aplicação documentado.

---

# 9. Resultado esperado ao final da V4

A API deve conseguir responder, com dados rastreáveis:

```text
Qual cliente?
Qual orçamento?
Qual versão foi aprovada?
Qual Serviço nasceu dele?
Qual era o valor contratado?
Quais aditivos foram aprovados?
Quanto foi recebido?
Quanto falta receber?
Quais despesas pertencem ao Serviço?
Quais materiais foram consumidos?
Quais compras abasteceram o estoque?
Qual foi o custo real?
Qual o resultado e a margem?
Quais anexos pertencem a cada etapa?
Houve garantia/retorno?
Quem executou cada ação?
```

O critério final da refatoração é: **dados consistentes, regras simples para o usuário, rastreabilidade completa e nenhuma duplicidade de fonte de verdade desnecessária**.
