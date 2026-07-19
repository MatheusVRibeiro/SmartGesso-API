# SECURITY

Documentação da fase 1 do SmartGesso API.

- Plataforma e operação das empresas são contextos separados.
- MySQL 8.4 LTS usa `utf8mb4`, datas em UTC, timezone padrão `America/Sao_Paulo`, moeda BRL e `Decimal(15,2)` para dinheiro.
- Multiempresa é aplicado por guards e por consultas com `companyId` do contexto autenticado.
- Módulos operacionais futuros: clientes, catálogo, medições, composições, cálculo de materiais, orçamentos/PDF com snapshot imutável, produção, serviços, financeiro da empresa, despesas e estoque.
