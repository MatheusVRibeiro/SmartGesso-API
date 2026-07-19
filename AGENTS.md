# SmartGesso API Agent Guide

- Projeto backend independente NestJS + Prisma + MySQL; não converter para monorepo.
- Mantenha TypeScript em modo estrito e valores financeiros como `Decimal(15,2)` no Prisma.
- Nunca misture tokens, guards ou rotas de administradores da plataforma com usuários das empresas.
- Em rotas mobile, nunca confie em `companyId` do corpo da requisição para dados empresariais; use a empresa autenticada/selecionada.
- Não versionar `.env`, segredos, tokens ou credenciais reais.
- Antes de concluir alterações, execute lint, typecheck, testes, e build quando possível.
