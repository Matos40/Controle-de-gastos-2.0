# Plano reversivel de compatibilidade de backups legados

**Status: somente proposta e verificacao isolada. Nenhuma migracao automatica.**

## Formatos aceitos para analise
1. Snapshot financeiro legado com selectedMonth e months.
2. Backup selado v1 com schemaVersion=1, algorithm SHA-256, database e digest.

Ambos passam pela validacao estrutural financeira. Backup selado tambem exige verificacao do hash. Formatos desconhecidos e dados corrompidos devem ser rejeitados sem escrita.

## Migracao em duas fases, sujeita a autorizacao futura
1. Guardar copia imutavel do backup original e seu hash.
2. Validar o backup, contabilizar meses e preservar campos desconhecidos aceitos pela validacao.
3. Criar **novo banco isolado** e envelope unificado com revisao zero, recibos e indice vazios.
4. Comparar digest do snapshot no destino com digest do backup original.
5. Testar operacoes posteriores e backup do novo envelope.
6. Reversao: descartar exclusivamente a copia isolada; manter a origem e o backup original inalterados.

## Limite historico
Backup legado nao contem necessariamente recibos autenticados de todas as operacoes anteriores. Nao reconstruir ou inventar historico de revisoes: o envelope comecaria na revisao zero como nova linha de base, com trilha de proveniencia documentada em futura versao.

## Bloqueios para ativacao
Faltam testes reais de migracao entre dispositivos, formatos completos exportados em producao, restauracao apos falha, limites de quota e consentimento explicito. Nao conectar ao aplicativo, Firebase, main ou producao.
