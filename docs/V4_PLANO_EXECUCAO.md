# SmartGesso V4 — Plano de Execução

## Sequência Obrigatória (respeitando dependências)

### FASE A — ESTABILIZAÇÃO
| Etapa | Backend | Mobile | Dependência |
|-------|---------|--------|-------------|
| 0 | Baseline API | Baseline Mobile | Nenhuma |
| 1 | Aprovação idempotente | Corrigir fluxo approve→Service | Backend 1 |

### FASE B — DOMÍNIO E SEGURANÇA
| Etapa | Backend | Mobile | Dependência |
|-------|---------|--------|-------------|
| 2 | Transactions | — | Backend 2 |
| 3 | Versionamento | — | Backend 3 |
| 4 | Numeração concorrente | — | Backend 4 |
| 5 | Guards/permissões | Erros centralizados | Backend 5 |

### FASE C — FLUXO NOVO
| Etapa | Backend | Mobile | Dependência |
|-------|---------|--------|-------------|
| 6 | QuoteEnvironment | Ambientes sem Obra | Backend 6 |
| — | — | Refatorar wizard | Backend 6 |
| 7 | Financeiro por Serviço | — | Backend 7 |
| — | — | Contratos API tipados | Backend 7 |
| — | — | Menu simplificado | Backend 7 |

### FASE D — GESTÃO OPERACIONAL
| Etapa | Backend | Mobile | Dependência |
|-------|---------|--------|-------------|
| 8 | Anexos privados | Anexos privados | Backend 8 |
| 9 | Aditivos | Aditivos | Backend 9 |
| 10 | Fornecedores/Compras | Fornecedores/Compras | Backend 10 |
| 11 | Garantia/Retorno | Garantia/Retorno | Backend 11 |
| 12 | Follow-up | Follow-up | Backend 12 |
| 13 | Feature flags | Feature flags UX | Backend 13 |

### FASE E — CONSOLIDAÇÃO
| Etapa | Backend | Mobile | Dependência |
|-------|---------|--------|-------------|
| 14 | Limpeza legado | — | Backend 14 |
| 15 | Dinheiro/OpenAPI | Home acionável | Backend 15 |
| 16 | Testes/CI | Offline/A11y/Testes | Backend 16 |
| — | — | Financeiro por Serviço | Backend 7+ |
| — | — | Anexos privados | Backend 8+ |
| — | — | Aditivos | Backend 9+ |
| — | — | Compras | Backend 10+ |
| — | — | Garantia | Backend 11+ |
| — | — | Follow-up | Backend 12+ |

## Ordem de Execução (respeitando dependências)

1. **E0 Backend** (baseline)
2. **E0 Mobile** (baseline) — paralelo
3. **E1 Backend** (aprovação idempotente)
4. **E2 Backend** (transactions)
5. **E3 Backend** (versionamento)
6. **E4 Backend** (numeração)
7. **E1 Mobile** (fluxo approve — depende E1 backend)
8. **E2 Mobile** (remover criação manual OS)
9. **E5 Backend** (guards)
10. **E5 Mobile** (erros centralizados)
11. **E6 Backend** (QuoteEnvironment)
12. **E6 Mobile** (ambientes + refatorar wizard)
13. **E7 Backend** (financeiro)
14. **E5 Mobile** (contratos API) — equivalente Etapa 5 frontend
15. **E7 Mobile** (menu simplificado)
16. **E8 Backend** (anexos)
17. **E8 Mobile** (feature flags) — depende E13 backend
18. **E8 Mobile** (anexos)
19. **E9 Backend** (aditivos)
20. **E9 Mobile** (financeiro por serviço) — depende E7 backend
21. **E10 Backend** (compras)
22. **E10 Mobile** (anexos privados)
23. **E11 Backend** (garantia)
24. **E11 Mobile** (aditivos)
25. **E12 Backend** (follow-up)
26. **E12 Mobile** (compras)
27. **E13 Backend** (feature flags)
28. **E13 Mobile** (garantia)
29. **E14 Backend** (limpeza)
30. **E14 Mobile** (follow-up)
31. **E15 Backend** (dinheiro/OpenAPI)
32. **E15 Mobile** (home acionável)
33. **E16 Backend** (testes/CI)
34. **E16 Mobile** (offline/A11y)
35. **Relatório final**

## Regras
- Cada etapa: implementar → testar → commit → próximo
- Backend estabiliza contrato ANTES do Mobile
- Não pular etapas
- Não forçar push
- Commits pequenos e semânticos
- lint/typecheck/test/build antes de cada commit
