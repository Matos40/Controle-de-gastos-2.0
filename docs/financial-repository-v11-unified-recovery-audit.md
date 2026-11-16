# Auditoria de integridade e recuperacao do envelope unificado

Escopo: prototipo experimental isolado, sem imports na producao.

## Evidencia anterior
GitHub Actions #388, commit bc20029: 127 testes aprovados, 0 falhas, 0 ignorados.

## Propriedades cobertas
- Envelope com snapshot financeiro, revisao, recibos ativos, arquivos e indice na mesma chave IndexedDB.
- CAS em transacao readwrite, rejeitando mudancas concorrentes.
- Digest do envelope, digest de cada arquivo, igualdade do indice com recibos e sequencia de revisoes.
- Digest do snapshot atual associado ao recibo da ultima revisao.
- Replay de operacao identica e rejeicao de reutilizacao divergente.
- Backup integral verificado antes de restauracao em banco isolado.
- Testes adicionais de corrupcao, truncamento e imutabilidade apos conflito.

## Limites e riscos ainda abertos
- O prototipo nao reconstrói snapshots historicos nem verifica digest de cada snapshot passado: verifica apenas o ultimo contra o estado atual. Portanto, a cadeia historica nao e prova criptografica completa.
- A assinatura e fornecida pelo chamador; nao e autenticacao criptografica de identidade.
- A restauracao testada escreve um envelope ja validado em banco de testes; nao existe fluxo de migracao reversivel ou rollback integrado ao aplicativo.
- Nao foram comprovados QuotaExceededError, queda de energia real, concorrencia entre abas com exclusao do banco, nem interoperabilidade com backup legado no novo envelope.
- O checksum detecta corrupcao acidental, mas nao protege contra agente capaz de recalcular todos os hashes.

## Gate para futura integracao
Nao integrar ate haver testes de falha de quota, migracao reversivel, compatibilidade de backups legados, auditoria de revisoes e validacao dos invariantes com snapshots financeiros reais. Manter main, Firebase e producao intocados.
