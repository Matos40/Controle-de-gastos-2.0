# Proposta de arquivamento duravel de recibos FinancialRepository v1.1

**Status: PROPOSTA, nao implementada nem ativada.** A main, a producao e o login Google permanecem inalterados.

## Problema
Cada operacao precisa manter identidade imutavel para impedir replay e reaplicacao de despesas.
Os recibos compactos atuais armazenam operationId, expectedRevision, nextRevision, signature e databaseDigest.
O limite de 10.000 e fail-closed: bloqueia nova escrita sem eliminar recibos.

## Estrategia recomendada
1. Usar duas estruturas locais: `state/current` com snapshot e cursor de revisao; `receipts` com indice unico por operationId.
2. Ao atingir limiar de arquivamento, criar lote imutavel em object store `receiptArchives`, incluindo range de revisoes, count, digest canonico e versionamento de formato.
3. Manter indice de deduplicacao **duravel e consultavel para todos os IDs antigos**, inclusive os arquivados. Nao confiar somente em Bloom filter (falso positivo).
4. Gravar snapshot, indice e arquivos em uma unica transacao IndexedDB readwrite, ou usar protocolo de duas fases com journal verificavel quando o tamanho exceder uma transacao.
5. Nunca eliminar indice de operationId; compactar somente payload nao necessario, preservando digest, assinatura e resultado/revisao suficientes para verificar replay.
6. Fazer verificacao de checksum de arquivo, contagem, continuidade das revisoes e restauracao de backup antes de liberar novas escritas.
7. Limitar tamanho por lote e prever quota: diante de QuotaExceededError ou abort, manter o estado anterior e retornar resultado incerto/erro seguro, sem anunciar sucesso.
8. Exportar backup versionado que inclua snapshot, recibos ativos, arquivos, indice e checksums; importacao so apos dry run e consentimento.
9. Migrar recibos antigos com database embutido por copia isolada; nao alterar original ate comprovacao de equivalencia e aprovacao.
10. Futuro Firestore: indice de idempotencia por UID/operationId em backend transacional, sem TTL que permita reutilizacao perigosa; reavaliar custos e retencao.

## Casos de teste obrigatorios antes de implementar
- 9.999 -> 10.000 -> 10.001 operacoes, replay de IDs antigos e rejeicao de mesmo ID com payload diferente.
- Reabertura do IndexedDB, duas abas concorrentes e abort durante criacao de arquivo.
- Arquivo adulterado, indice ausente, duplicidade de IDs e hash invalido.
- Backup completo, restauracao em dispositivo novo, rollback de migracao e perda de energia simulada.
- Testes de carga/latencia e quota em Chromium, Android e Safari/iOS.

## Criterios de ativacao
Somente depois de suite verde, revisao de seguranca, homologacao manual e autorizacao explicita.
