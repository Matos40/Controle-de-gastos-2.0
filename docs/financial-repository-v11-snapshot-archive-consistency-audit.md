# Auditoria de consistencia entre snapshot e arquivo de recibos (isolada)

Status: auditoria de arquitetura, sem ativacao.

## Garantias verificadas no prototipo
- Arquivos possuem checksum, contagem e verificacao de IDs unicos.
- Indice de operacoes e confrontado com a uniao de recibos ativos e arquivados.
- Operacoes concorrentes usam comparacao de estado em transacao IndexedDB readwrite.
- Backup exportado e validado antes de uso; checksum sozinho nao basta se o indice nao corresponde aos recibos.

## Lacuna bloqueante
O prototipo ArchivePreview **nao esta integrado** ao FinancialRepositoryV11Storage.
Portanto, nao existe ainda transacao atomica unica entre snapshot financeiro, revisao, recibos ativos, arquivos e indice. Nao declarar esta propriedade como implementada.
O campo databaseDigest do recibo e tratado como dado opaco pelo prototipo; ele ainda nao prova que a revisao ou snapshot financeiro correspondente foi realmente persistido.
O indice guarda somente booleano; antes de integracao devera guardar assinatura da operacao, revisao e digest para distinguir replay identico de reutilizacao maliciosa de ID.

## Proxima etapa recomendada
Projetar envelope versionado de snapshot + indice + recibos e migracao por copia, com validacao de digest e cadeia de revisoes. Testar recuperacao atomica apos falha de energia simulada, QuotaExceededError, corrupcao de arquivo e backup legado. Preservar o bloqueio de novas escritas quando a integridade nao puder ser demonstrada.

Nao modificar main, producao, Firebase Authentication ou Firestore.
