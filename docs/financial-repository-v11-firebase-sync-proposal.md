# Raytech CG: proposta de autenticacao e sincronizacao (NAO ATIVADA)

Status: desenho tecnico isolado no PR #7. Nenhuma alteracao na interface, localStorage legado, Firebase ou producao.

## Objetivo e limites
- Autenticacao opcional por Google usando Firebase Authentication (Google provider).
- Firestore segregado por UID autenticado, sem dados compartilhados entre usuarios.
- IndexedDB local como cache e fila offline apenas apos homologacao.
- Nenhum upload automatico do localStorage legado. Migracao exige consentimento, backup verificado e dry run.
- Nenhuma chave administrativa ou credencial secreta embutida no cliente.

## Modelo proposto
- users/{uid}/metadata/profile: configuracoes nao financeiras e versao de protocolo.
- users/{uid}/snapshots/{snapshotId}: envelope canonico, revision, checksum, schemaVersion, createdAt, actorId.
- users/{uid}/operations/{operationId}: operacao imutavel, actorId, expectedRevision, payload hash, resultado e timestamp.
- users/{uid}/devices/{deviceId}: cursor de sincronizacao e ultima confirmacao, sem credenciais sensiveis.
- A politica de retencao de recibos deve preservar identificadores de operacoes processadas e impedir replay antigo; nao apagar recibos sem mecanismo duravel equivalente.

## Protocolo
1. Entrar com Google; confirmar UID e regras de autorizacao.
2. Ler metadados e versao remota; validar integridade e compatibilidade.
3. Submeter comandos com IDs estaveis e precondicoes de revisao.
4. Confirmar atomicamente operacao, revisao e snapshot em transacao confiavel (Firestore transaction ou backend).
5. Diante de conflito, baixar versao atual, revalidar e solicitar resolucao quando nao houver merge deterministico seguro.
6. Em modo offline, registrar fila duravel; ao reconectar, reconciliar sem duplicar despesas, parcelas ou exclusoes.
7. Em resultado incerto, consultar operationId antes de tentar novamente. Nunca interpretar timeout como falha definitiva.
8. Se hash divergir ou a copia estiver corrompida, bloquear sincronizacao e oferecer recuperacao verificada com aprovacao explicita.

## Regras de seguranca
- Firestore Security Rules: request.auth != null e request.auth.uid == uid no caminho de cada usuario.
- Bloquear acesso cruzado entre UIDs, limitar tamanhos e formatos, rejeitar escrita em campos imutaveis.
- Avaliar operacoes criticas em backend confiavel; regras sozinhas nao validam toda a semantica financeira.
- App Check, monitoramento de erros, limites de custo, indices e testes no Emulator Suite.
- Separar contas de usuario; dispositivos de uma mesma conta compartilham dados somente apos opt-in.

## Homologacao obrigatoria
- Testes de login/logout e troca de conta, isolamento por UID, revogacao de acesso e regras Firestore.
- Dois dispositivos concorrentes, reconexao offline, retries, recibos antigos, conflito de parcelas e tombstones.
- Backup completo e restauracao com checksum; testes Chromium, Android e Safari/iOS.
- Rollback reversivel: desligar sincronizacao e continuar usando origem preservada; jamais sobrescrever localStorage legado.
- Feature flag desligada por padrao, ativacao e publicacao apenas com autorizacao expressa.

## Dependencias antes de implementar
- Finalizar FinancialRepository v1.1 com CI verde.
- Definir politica duravel de recibos e limites de armazenamento.
- Decidir estrategia de migracao com consentimento e separacao de selectedMonth por dispositivo.
- Aprovar projeto Firebase, custos, dominio autorizado e politica de privacidade.

## Portoes adicionais de seguranca (revisao)
- Nao confiar em UID, revision, checksum ou actorId fornecidos pelo cliente sem validacao em backend ou regras.
- Proibir update/delete de operations/{operationId}; usar create-only e validar propriedade do UID. Para garantias financeiras, preferir backend transacional que confira idempotencia e estado.
- Uma transacao Firestore requer conexao; nao depender de transacoes offline para confirmar commits. Enfileirar localmente e reconciliar quando online.
- Definir limite de documento (Firestore 1 MiB), particionamento de snapshots, tamanho de lote e quota antes de migrar.
- Regras devem validar tipos, campos permitidos e imutabilidade; usar Emulator Suite para ataques de acesso cruzado, falsificacao de revisao e replay.
- Login/logout e troca de conta devem limpar cache sensivel em memoria, cancelar listeners e separar filas locais por UID; nunca enviar dados de uma conta para outra.
- A verificacao SHA-256 e integridade acidental, nao autenticacao criptografica. TLS, Security Rules e controle de acesso continuam obrigatorios.
- Nao guardar token OAuth manualmente no Firestore; usar SDK oficial e persistencia de sessao apropriada.
- Testar indisponibilidade, quota, revogacao de acesso, multiplas abas, clock skew e conflitos com operacoes excluidas.
