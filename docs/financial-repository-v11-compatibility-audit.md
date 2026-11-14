# Auditoria de compatibilidade e recuperacao FinancialRepository v1.1

Escopo: codigo isolado do PR #7; nao homologado para producao.

## Verificacoes estaticas
- O driver IndexedDB usa banco isolado e object store state/current. Nenhuma referencia a localStorage no modulo de armazenamento.
- A verificacao de integridade usa SHA-256 e valida estrutura do banco antes de leitura confiavel.
- A escrita faz leitura verificada e compara estado completo dentro de transacao de escrita para evitar sobrescrever concorrentes.
- IDs de operacao sao retidos nos recibos e repeticoes sao reconhecidas; sem politica de compactacao aprovada.
- Recovery.inspect somente avalia copias verificadas e sinaliza necessidade de aprovacao; nao restaura automaticamente.
- O modulo GoogleAuthPreview nao e importado pela interface e inicia desativado.

## Riscos que impedem homologacao final
1. O formato atual dos recibos armazena snapshot financeiro completo a cada operacao: crescimento quadratico de armazenamento; definir recibos compactos e politica duravel antes da ativacao.
2. O selo e checksum nao autenticado: nao protege contra adulteracao maliciosa com recalcualo de hash.
3. A recuperacao de perda de confirmacao depende da ponte async e de releitura; falhas de leitura deixam resultado incerto corretamente, mas exigem fluxo de UX antes de ativar.
4. O codigo nao implementa migracao de envelopes IndexedDB anteriores sem selo: falha fechada. Precisara de procedimento explicito, reversivel, com backup e aprovacao.
5. A validacao de revision/receiptsDigest existe fora do digest do banco e depende de checks adicionais; evoluir para envelope canonico versionado com digest unico antes de producao.
6. Testes de armazenamento e Chromium nao substituem testes Android/iOS, quota, encerramento inesperado, navegacao privada e recuperacao manual de backup.
7. Auth preview com enabled:true e SDK injetado e somente demonstrativo; nao e autorizacao para ligar login em producao.

## Condicoes de aceite
- CI verde no ultimo commit, sem falhas ou testes ignorados.
- Testes de replay antigo, corrupcao de recibos, concorrencia entre conexoes, abortos e falha de leitura.
- Testes de migracao e rollback sem alterar a chave legado controle_gastos_multimonth_v3.
- Politica de recibos compactos com retencao duravel e protecao de replay.
- Revisao de seguranca Firestore Rules no Emulator Suite antes de qualquer ativacao.
