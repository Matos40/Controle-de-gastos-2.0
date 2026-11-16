# Matriz final de compatibilidade de backups financeiros

**Escopo:** PR #7, prototipo isolado. Nenhuma migracao ou rollback automatico ativado.

| Formato / cenario | Verificacao | Evidencia e limite | Decisao |
| --- | --- | --- | --- |
| Snapshot legado simples | Validacao estrutural, digest calculado e copia sem mutacao | Testes Node e Chromium; sem autenticidade do arquivo original | Planejamento permitido |
| Backup selado v1 | Validacao estrutural e verificacao SHA-256 | Testes Node e Chromium; SHA-256 nao autentica emissor | Planejamento permitido |
| Backup selado adulterado | Rejeicao antes de iniciar copia | Teste Chromium e Node | Bloquear |
| Formato desconhecido | Rejeicao fail-closed | Teste Node | Bloquear |
| Campos financeiros adicionais | Preservacao estrutural e digest | Fixtures com investimentos, parcelas, exclusoes, despesas fixas, rendas extras, metadados | Planejamento permitido |
| Inicializacao em IndexedDB isolado | Snapshot identico, revisao zero, sem recibos ficticios | Chromium com reabertura | Somente ambiente isolado |
| Falha antes de inicializacao | Transacao abortada e copia vazia | Chromium com falha simulada | Reversao manual |
| Rollback apos operacao isolada | Excluir apenas banco de teste; preservar origem | Chromium | Reversao manual |
| Rollback bloqueado por conexao | Evento blocked, fechamento da conexao e conclusao | Novo teste Chromium, sujeito a CI | Nunca presumir exclusao |
| Backup unificado v1 | Validacao de envelope, recibos, indice e arquivo | Testes de memoria e Chromium | Sem importacao automatica |
| Backup real exportado em producao | Nao avaliado com fixtures anonimizadas de todas as versoes | Lacuna | Nao ativar |
| QuotaExceededError real | Apenas simulacao em driver | Lacuna | Nao ativar |
| Falha fisica de energia e varias abas | Nao comprovado | Lacuna | Nao ativar |

## Procedimento seguro de reversao proposto

1. Preservar origem e arquivo de backup fora do banco experimental.
2. Validar hash e estrutura; nao inventar historico anterior.
3. Criar banco de nome exclusivo, verificar digest apos reabertura.
4. Em rollback, fechar conexoes do banco experimental e solicitar exclusao apenas desse banco.
5. Se deleteDatabase emitir blocked, manter estado PENDENTE, sem alegar sucesso nem apagar origem.
6. Somente apos onsuccess, reabrir e confirmar banco vazio.
7. Exigir autorizacao separada antes de qualquer ativacao futura.

**CI:** resultados anteriores nao devem ser extrapolados a novos commits. O teste de conexao bloqueadora precisa de validacao GitHub Actions.
