# SmartGesso API Agent Guide

## ⚠️ REGRA ABSOLUTA #1: CARREGAR SKILLS ANTES DE QUALQUER TAREFA

Antes de escrever qualquer código ou fazer qualquer alteração:
1. Rode `skills_list()` para ver skills disponíveis
2. Identifique skills relevantes para a tarefa
3. Carregue com `skill_view()` — NUNCA pule

Skills obrigatórias para este projeto:
- `nestjs-development` — padrões NestJS (DTOs, controllers, módulos)
- `backend-security-audit` — análise de segurança
- `spec-a23` — workflow de implementação
- `codebase-health-check` — validação pré-finalização
- `database-indexing` — para queries e migrations
- `sql-data-migrations` — para migrations SQL

## Regras do Projeto

- Projeto backend independente NestJS + Prisma + MySQL; não converter para monorepo.
- Mantenha TypeScript em modo estrito e valores financeiros como `Decimal(15,2)` no Prisma.
- Nunca misture tokens, guards ou rotas de administradores da plataforma com usuários das empresas.
- Em rotas mobile, nunca confie em `companyId` do corpo da requisição para dados empresariais; use a empresa autenticada/selecionada.
- Não versionar `.env`, segredos, tokens ou credenciais reais.
- Antes de concluir alterações, execute lint, typecheck, testes, e build quando possível.
