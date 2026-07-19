# Etapa 2 - Modularizacao e persistencia real

A etapa 2 comeca apos o scaffold inicial. O objetivo e transformar o rascunho em uma API NestJS organizada por modulos e trocar gradualmente a `MemoryStore` por Prisma/MySQL real.

## Escopo iniciado

- `CoreModule`: centraliza servicos e guards compartilhados.
- `HealthModule`: health check.
- `PlatformAuthModule`: autenticacao dos administradores da plataforma.
- `PlatformCompaniesModule`: cadastro, edicao, suspensao, reativacao, bloqueio e convite de proprietario.
- `PlansModule`: planos comerciais do SmartGesso.
- `SubscriptionsModule`: contratos, renovacoes, suspensoes, mensalidades e pagamentos.
- `AuthModule`: autenticacao mobile, aceite de convite e troca de empresa.
- `CompaniesModule`: perfil, branding, permissoes e status de acesso da empresa atual.
- `PrismaRepositoryService`: helpers para escopo multiempresa e conversao segura de dinheiro com `Prisma.Decimal`.

## Concluido nesta etapa

- `BusinessService` deixou de depender da `MemoryStore` para empresas, branding, planos, assinaturas, mensalidades e pagamentos.
- Controllers administrativos deixaram de acessar `biz['store']` e passaram a chamar metodos explicitos do service.
- Operacoes com mais de uma tabela usam transacoes Prisma, incluindo empresa + branding, assinatura + historico, renovacao e pagamento de mensalidade.
- Valores financeiros passam por `PrismaRepositoryService.money()` antes de gravar campos `Decimal(15,2)`.
- `schema.prisma` foi normalizado para sintaxe Prisma valida e o Prisma Client foi gerado com sucesso.
- `CoreModule` passou a importar/exportar `JwtModule`, corrigindo a injecao dos guards e services compartilhados.

## Proxima refatoracao obrigatoria

1. Migrar `AuthService` e guards de `MemoryStore` para Prisma, mantendo tokens de plataforma separados dos tokens de usuarios das empresas.
2. Adicionar campos persistentes de sessao no schema, como hash de refresh token e empresa ativa do usuario, ou criar uma tabela propria de sessoes.
3. Persistir convites com `tokenHash` real, nunca token puro, e validar aceite por hash.
4. Criar controllers e services proprios dentro de cada modulo, deixando de importar classes do arquivo legado `src/controllers.ts`.
5. Criar DTOs por modulo com `class-validator` e `class-transformer`.
6. Criar testes de integracao contra banco de teste ou schema isolado.
7. Implementar rotina diaria idempotente de contratos vencidos e suspensao automatica.

## Regra multiempresa

Todo servico de dados empresariais deve receber `companyId` do contexto autenticado e aplicar filtro obrigatorio usando helpers como:

```ts
this.repository.tenantScope(context.companyId, { id });
```

Nunca usar `companyId` enviado pelo corpo da requisicao mobile para buscar/alterar dados empresariais.

## Observacao de testes

Os testes atuais ainda usam `MemoryStore` e carregam `DATABASE_URL` do ambiente local. Com a migracao parcial para Prisma, eles precisam de um banco de teste com credenciais validas ou de override explicito do `PrismaService` nos testes.
