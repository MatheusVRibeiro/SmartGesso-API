---
name: spec-a23
description: Workflow sistemático de implementação em 4 fases (Investigação, Especificação, Implementação e Verificação) para tarefas de desenvolvimento no backend.
---

# Spec-A23 Implementation Workflow Skill

O workflow Spec-A23 é uma metodologia orientada a especificações para garantir que qualquer modificação ou nova funcionalidade no backend seja entregue com precisão, previsibilidade e sem regressões.

---

## 🔄 As 4 Fases do Spec-A23

```
[1. Investigação & Contexto] ➔ [2. Especificação & Contrato] ➔ [3. Implementação Guiada] ➔ [4. Verificação & Health-Check]
```

---

### Fase 1: Investigação & Contexto
- **Ler o código existente:** Localizar controllers, services, schemas e DTOs relacionados antes de planejar alterações.
- **Checar regras de negócio e tenants:** Identificar quais empresas, permissões e guards estão envolvidos.
- **Identificar dependências:** Módulos que serão afetados direta ou indiretamente.

### Fase 2: Especificação & Contrato
- Definir com clareza o contrato de entrada e saída da API (rotas, verbos HTTP, DTOs de request e response).
- Definir o impacto no banco de dados (novas tabelas, novas colunas, migrações necessárias).
- Levantar cenários de borda (ex: registro não encontrado, valores nulos, tentativa de acesso entre empresas diferentes).

### Fase 3: Implementação Guiada
- **Passo 1:** Se houver mudanças de banco, atualizar `schema.prisma` e gerar migração (ver skill `sql-data-migrations`).
- **Passo 2:** Criar ou atualizar DTOs com validações estritas (`class-validator`).
- **Passo 3:** Implementar a lógica de negócio no Service, garantindo isolamento multi-tenant (`companyId`).
- **Passo 4:** Expor e proteger a rota no Controller com decorators e guards adequados.

### Fase 4: Verificação & Health-Check
- Executar os testes unitários daquele módulo.
- Executar o checklist completo da skill `codebase-health-check`:
  - `npm run lint`
  - `npm run build`
  - `npm test`
- Revisar o diff final antes de commitar ou concluir a tarefa.
