# ESP-DIFF03-001 v1.1 — Fase 1 experimental isolada

Especificação reconstruída e integralmente aprovada na conversa de autorização.
Baseline do PR #7: `4a588db4f0a4d9778ce7a2b8cbd7ae11d4ae7e99` (271 testes aprovados).
Esta documentação registra o escopo e as decisões desta implementação, não afirma
que a redação seja literalmente igual à especificação histórica não recuperada.

## Escopo e fronteiras

DIFF-03: o legado pode herdar dados do último mês existente mesmo com uma
lacuna; o núcleo v1.1 usa o antecessor imediato. O laboratório representa essa
incerteza sem inventar movimentos nem alterar o núcleo atual. Toda informação
usada nesta fase é sintética. Não há integração, persistência, XLSX, anonimização,
migração, Firebase, IndexedDB, acesso a backups reais ou operação de produção.
A pasta experimental/diff03 não é importada pelo aplicativo. A suíte existente
node --test tests/*.test.cjs descobre os seis novos arquivos sem modificar CI.

## Requisitos normativos
| ID | Regra |
|---|---|
| REC-01 | Detectar meses ausentes sem criá-los automaticamente. |
| REC-02 | Não fabricar receitas, despesas ou parcelas. |
| REC-03 | Não incluir pendências em saldos financeiros. |
| REC-04 | Preservar origem e identificadores. |
| REC-05 | Não presumir pagamento, quitação ou numeração de parcelas. |
| REC-06 | Evitar duplicidade e garantir replay idempotente. |
| REC-07 | Respeitar marcadores de exclusão; nunca reativar origem excluída. |
| REC-08 | Exigir confirmação explícita para escrita simulada. |
| REC-09 | Preservar decisões e registros anteriores. |
| REC-10 | Vincular prévia à revisão e digest canônico do snapshot. |
| REC-11 | Rejeitar uma segunda escrita inédita na mesma revisão. |
| REC-12 | Cancelar sem modificar snapshot. |
| REC-13 | Exigir motivo não vazio de decisão confirmável. |
| REC-14 | Trocar snapshot integral somente após validar o estado preparado. |
| REC-15 | Manter semântica de saldo acumulado interrompido por lacuna. |

## Interfaces
A interface pública do laboratório é createLab(snapshot), de shared/snapshotLab.cjs.
O snapshot possui contractVersion "1.1", revision inteira não negativa,
financialState {selectedMonth,months}, reconciliation {pending,history},
operationReceipts. Entradas e saídas são JSON defensivo; não há dependências
operacionais, armazenamento ou I/O. Os IDs de prévia, pendência, histórico e
recibo são derivados de SHA-256 sobre projeções canônicas. SHA-256 aqui não
autentica autoria. As prévias ficam em cache volátil privado, não persistem no
snapshot; só a escrita confirmada incrementa a revisão.
As seis operações usam contractVersion "1.1":

| Operação | Argumentos além da versão | Resultado de sucesso |
|---|---|---|
| PREVIEW_MONTH_CREATION | targetMonth, expectedRevision | status preview, previewId, baseRevision, targetMonth, referenceMonth, missingMonths, requiresReconciliation, proposedPending, snapshotDigest |
| CONFIRM_MONTH_CREATION | operationId, actorId, previewId, expectedRevision, confirmation true | committed, revision, createdMonth, pendingIds, receiptId |
| DETECT_RECONCILIATION_PENDING | targetMonth, expectedRevision | detected, baseRevision, pending |
| PREVIEW_RECONCILIATION | pendingId, expectedRevision, decision {action,reason} | preview, previewId, baseRevision, pendingId, proposedDecision, reason, financialImpact 0, snapshotDigest; CANCEL retorna cancelled sem previewId |
| RESOLVE_RECONCILIATION | operationId, actorId, previewId, expectedRevision, confirmation true | committed, revision, pendingId, resolutionStatus, financialImpact 0, historyId, receiptId |
| READ_RECONCILIATION_HISTORY | filters opcionais {targetMonth,pendingId,status} | success, revision, entries |

SALARY_GAP, FIXED_EXPENSE_GAP, INSTALLMENT_GAP, DELETION_CONFLICT e
SOURCE_AMBIGUITY são tipos de pendência. A identidade inclui type, originMonth,
targetMonth e sourceId. OPEN pode permanecer OPEN (KEEP_PENDING), tornar-se
DISMISSED (DISMISS) ou RESOLVED (CONFIRM_CONTINUITY, apenas decisão sem lançamento).
CANCEL não gera recibo ou histórico; as duas condições terminais não reabrem.
Continuidade de origem excluída ou ambígua não é confirmável. As operações de
resolução nunca mudam o financialState. Histórico inclui identificação, autor,
origem, motivo, decisão, status e revisões anterior/resultante.

## Decisões de implementação conservadoras
- Criação experimental inicializa exclusivamente o mês solicitado com valores
  zero e coleções vazias, inclusive em cenário consecutivo. Não simula a
  herança financeira real. O mês passa a selecionado apenas no laboratório.
- A inserção que conectaria saldos acumulados de meses já existentes é
  rejeitada por INVARIANT_VIOLATION. Um mês intermediário de valor zero
  pode alterar a soma acumulada do mês posterior; não é seguro assumir o contrário.
- Detecção pesquisa o mês anterior existente, considera marcadores de exclusão
  até o mês-alvo e identifica origem ausente/duplicada como ambígua. Não calcula
  valores nem avança a numeração de parcelas. Mantém pendências já registradas.
- KEEP_PENDING confirmado gera registro auditável OPEN, CANCEL não escreve.
  A razão é aparada e limitada a 2048 caracteres; IDs têm limite de 128.
- Replay de mesma operação e conteúdo retorna o recibo original mesmo depois
  de reconstruir o laboratório a partir de snapshot sintético. Uma operação
  nova depende de prévia presente no cache desta instância.
- Validação rejeita objetos não JSON, chaves perigosas, revisões inválidas,
  inconsistente proveniência, duplicações e históricos/recibos incoerentes.
  A simulação não demonstra durabilidade física, autenticação de ator,
  concorrência entre processos/abas, segurança de backup ou prontidão de produção.

## Erros
Formato {status:"rejected",code,revision,details}. Códigos catalogados:
INVALID_CONTRACT_VERSION, INVALID_PAYLOAD, INVALID_MONTH, MONTH_ALREADY_EXISTS,
INVALID_SNAPSHOT, INVALID_REVISION, REVISION_CONFLICT, PREVIEW_NOT_FOUND,
PREVIEW_STALE, PREVIEW_MISMATCH, CONFIRMATION_REQUIRED, INVALID_OPERATION_ID,
IDEMPOTENCY_CONFLICT, PENDING_NOT_FOUND, PENDING_ALREADY_RESOLVED, INVALID_DECISION,
REASON_REQUIRED, SOURCE_NOT_FOUND, SOURCE_DELETED, INVARIANT_VIOLATION,
ATOMIC_COMMIT_FAILED. Snapshot inicial inválido lança ContractError antes de
criar a instância, uma vez que ainda não existe revisão válida para responder.
Falhas determinísticas antes de aplicar, após aplicar à cópia e antes da troca
integral demonstram rollback no laboratório. Erros não previstos propagam
a exceção em vez de fingir uma rejeição de negócio.

## Fixtures sintéticas
F01 vazio; F02 consecutivos; F03 lacuna simples; F04 múltiplas lacunas; F05
virada de ano; F06 salário/fixas; F07 parcelamentos; F08 origens excluídas;
F09 histórico e pendências; F10 revisões concorrentes; F11 falhas; F12 inválido.

## Matriz T01–T60
| ID | Aceitação |
|---|---|
| T01 | Vazio sem inventar histórico |
| T02 | Consecutivo sem lacuna |
| T03 | Uma lacuna exata |
| T04 | Várias lacunas ordenadas |
| T05 | Virada de ano |
| T06 | Mês inválido |
| T07 | Mês existente |
| T08 | Revisão divergente |
| T09 | Imutabilidade |
| T10 | Prévias determinísticas |
| T11 | Criação só do mês solicitado |
| T12 | Confirmação ausente |
| T13 | Prévia inexistente |
| T14 | Prévia obsoleta |
| T15 | Contrato de prévia incorreto |
| T16 | Lacunas e saldos preservados |
| T17 | Replay de criação |
| T18 | Colisão de ID |
| T19 | Escritas concorrentes |
| T20 | Falha atômica |
| T21 | Consecutivos sem pendência |
| T22 | Salário incerto |
| T23 | Despesas fixas |
| T24 | Parcelas sem numeração presumida |
| T25 | Sem inferência de quitação |
| T26 | Origem excluída |
| T27 | Origem ambígua |
| T28 | Proveniência |
| T29 | Detecção repetível |
| T30 | Isolamento financeiro |
| T31 | Prévia válida de reconciliação |
| T32 | Pendência desconhecida |
| T33 | Pendência terminal |
| T34 | Decisão inválida |
| T35 | Motivo obrigatório |
| T36 | KEEP_PENDING |
| T37 | CANCEL |
| T38 | Descarte sem efeito financeiro |
| T39 | Continuidade sem lançamento |
| T40 | Vínculo à revisão e digest |
| T41 | Resolução válida |
| T42 | Descarte confirmado |
| T43 | Sem confirmação |
| T44 | Prévia obsoleta |
| T45 | Dupla resolução |
| T46 | Replay de resolução |
| T47 | Colisão de operação |
| T48 | Resoluções concorrentes |
| T49 | Rollback integral |
| T50 | Valores e história preservados |
| T51 | História vazia |
| T52 | História completa |
| T53 | Filtro por mês |
| T54 | Filtro por pendência |
| T55 | Filtro por status |
| T56 | Ordem determinística |
| T57 | Cópias defensivas |
| T58 | Rastreabilidade |
| T59 | Rejeição sem sucesso fictício |
| T60 | Invariantes e isolamento globais |

## Aceitação e evidências
Executar node --test tests/*.test.cjs e confirmar exatamente 331 testes,
331 aprovados, zero falhas, cancelados, skips e todos. Conferir T01–T60
individualmente, o diff com 4a588db, SHA completo e execução CI do novo head.
Nenhum teste anterior pode ser modificado. Até a confirmação de logs reais,
não declarar aprovação. PR #7 deve permanecer aberto e sem merge.
