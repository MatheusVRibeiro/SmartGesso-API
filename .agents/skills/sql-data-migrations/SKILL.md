---
name: sql-data-migrations
description: Guia para planejamento, execução e validação de migrações de banco de dados com Prisma Migrate e SQL no MySQL, garantindo migrações seguras sem downtime e preservação de dados.
---

# SQL Data Migrations Skill

Esta skill estabelece o workflow seguro para alterações de esquema e migrações de dados em bancos de dados relacionais MySQL gerenciados pelo Prisma ORM.

---

## 🧭 Princípios de Migração Segura

1. **Migrações Não-Destrutivas:**
   - Evite remover colunas ou tabelas que ainda estão sendo consumidas pelo código em execução.
   - Para renomear colunas: adicione a nova coluna primeiro, sincronize os dados, atualize a aplicação e só depois remova a coluna antiga.

2. **Cuidado com Alterações de Tipo e Constraints:**
   - Adicionar uma coluna com `NOT NULL` sem valor `DEFAULT` em uma tabela populada vai quebrar a migração. Sempre forneça um `DEFAULT` ou execute a migração em etapas.
   - Mudanças para `Decimal(15,2)` devem garantir que nenhum dado existente sofra truncamento inesperado.

---

## 🛠️ Procedimento Padrão com Prisma

### 1. Atualizar o `schema.prisma`
Adicione os modelos, relações, índices ou campos necessários no [schema.prisma](file:///c:/Users/xmath/OneDrive/Documentos/Projetos%20SaaS/SmartGesso-API/prisma/schema.prisma).

### 2. Gerar a Migração em Modo Criação
```bash
npx prisma migrate dev --name <descricao_curta_da_mudanca> --create-only
```
O `--create-only` gera o arquivo `.sql` na pasta `prisma/migrations/` sem executá-lo imediatamente, permitindo inspecionar o SQL gerado.

### 3. Inspecionar o SQL Gerado
- Abra o arquivo `migration.sql` recém-criado.
- Verifique se o Prisma gerou instruções `DROP COLUMN` ou `DROP TABLE` acidentais.
- Se for necessário migrar dados existentes (ex: preencher a nova coluna com base em valores de outra), escreva os comandos `UPDATE` diretamente no arquivo `migration.sql`.

### 4. Aplicar e Testar a Migração Localmente
```bash
npx prisma migrate dev
```

### 5. Regenerar o Prisma Client
```bash
npx prisma generate
```
Valide que a tipagem gerada no `@prisma/client` está sincronizada rodando `npx tsc --noEmit`.
