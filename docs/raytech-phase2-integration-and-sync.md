# Raytech CG — Fase 2 experimental consolidada

Base: fb021b6c54ff779aff1203050a5ba56280831ddc, PR #7, 331 testes.
Autorização: integrar experimentalmente, preparar migração reversível e
priorizar conta Google e sincronização; sem merge, deploy, main ou produção.

## Entrega
- experimental/phase2/repository.cjs: composição do núcleo financeiro existente,
  inspeção de backup legado e detecção DIFF-03; snapshot, pendências,
  histórico e recibos em uma transação simulada por UID.
- experimental/phase2/sync.cjs: sessão Google com SDK injetado e desativada
  por padrão, cache de sessão, fila offline em memória segregada por UID,
  replay, conflito explícito e recuperação de confirmação perdida.
- 38 novos testes P2-01 a P2-38, somente dados artificiais. Total esperado: 369.

## Decisões e limites
O núcleo operacional continua inalterado. Criação consecutiva usa a
herança existente; criação com lacuna usa o núcleo sem fabricar meses
intermediários e registra pendências do laboratório. CONFIRM_CONTINUITY
registra decisão, não cria movimento financeiro. ADVANCE_MONTH e
SYNC_PREVIOUS_MONTH ficam bloqueados no wrapper até receberem fluxo
específico de prévia. A seleção do mês não muda pelo comando de dados.
Os marcadores reais installmentOriginId e origin:number são traduzidos
para uma projeção conservadora de detecção, sem editar a origem.
A criação que altera saldo acumulado de mês já existente é rejeitada.

A migração aceita objeto financeiro legado ou envelope SHA-256 v1
verificado, preserva todos os campos e começa em revisão zero, sem
inventar recibos. A ativação exige consentimento e destino vazio.
Rollback só remove a cópia isolada idêntica em revisão zero; se já houve
escritas, bloqueia para evitar perda. O objeto original fica intacto;
não há acesso a localStorage, arquivos de usuário ou IndexedDB.

A camada de sincronização usa armazenamento transacional em memória,
não Firestore. UID e actorId são vinculados à sessão simulada; isso não
substitui autenticação, autorização ou regras no servidor. A fila não é
durável após fechar a instância. Conflito interrompe a fila, sem merge
automático. Não são feitas tentativas automáticas de sobrescrita. Cache
é limpo na troca de conta e logout; fila segregada permanece somente na
memória desta instância. Um commit já enviado pode terminar após logout;
a resposta e o cache da sessão anterior são descartados.

Os digests SHA-256 são verificações de integridade e vínculo de prévia,
não assinatura nem autorização. Prévia é recalculada deterministicamente
no commit, permitindo reconexão entre instâncias. Os recibos são mantidos
integralmente neste laboratório, sem política de compactação ativa.
O armazenamento e a implementação são Node/CommonJS para testes, não um
bundle para navegador. Não há configuração real do Firebase, SDK
adicionado à aplicação, chamadas de rede, login real ou upload.

## Próxima entrega funcional
Construir porta de autenticação com SDK oficial em ambiente de
homologação, configurar projeto Firebase de teste e domínios autorizados,
implementar backend transacional validando token/UID e comandos;
regras Firestore devem negar escrita direta do cliente nos registros
financeiros controlados pelo backend. Testar Emulator Suite, isolamento
entre contas, persistência da fila IndexedDB, revogação e concorrência
entre dispositivos. Separar mês selecionado por dispositivo. Definir
limites de documento, retenção de recibos e backup antes de ativar
migração real. Só então habilitar login e sync na interface de
homologação, nunca em produção sem autorização.

Critérios: 369 testes aprovados, zero falhas/cancelamentos/skips/todo;
preservação dos 331 anteriores e de todos os arquivos operacionais.
