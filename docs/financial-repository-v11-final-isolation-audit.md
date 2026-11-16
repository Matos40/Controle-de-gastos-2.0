# Auditoria final preliminar: migracao reversivel e isolamento IndexedDB

Escopo: PR #7, branch feature/financial-repository-v11-foundation. Documento de auditoria, sem ativacao ou escrita em dados de producao.

## Evidencia de implementacao
- LegacyPlan.inspect valida snapshot legado simples ou backup selado v1 e calcula digest do snapshot; LegacyPlan.plan retorna apenas plano DRY_RUN_ONLY, writes=0.
- UnifiedPreview.initialize cria envelope na revisao zero, sem fabricar recibos de operacoes historicas.
- Testes Chromium cobrem reabertura de IndexedDB, rejeicao de backup selado adulterado, exclusao do banco isolado, interrupcao simulada na inicializacao e rollback depois de commit.
- Testes Node cobrem preservacao estrutural de meses, despesas, cartoes, parcelas, exclusoes, rendas extras, investimentos e campos adicionais.
- A execucao GitHub Actions #400 para 58cb9e1 estava em andamento na consulta inicial; resultado final nao presumido.

## Achados e limites de seguranca
1. O plano de rollback nao executa exclusao automatica: os testes fazem deleteDatabase explicitamente sobre nomes de bancos de teste. Uma rotina futura precisaria exigir confirmacao do usuario e impedir selecao de banco de producao.
2. Os testes de preservacao comparam estruturas completas e digests dos dados de exemplo. Nao demonstram compatibilidade com todos os formatos de exportacao reais nem com arquivos de usuarios.
3. O backup simples nao possui checksum original autenticado: um hash calculado na leitura apenas registra o conteudo recebido, nao prova sua autenticidade ou integridade anterior.
4. O checksum SHA-256 nao e autenticacao criptografica. Um agente que altera conteudo e hashes pode produzir backup aparentemente consistente.
5. A cadeia de revisoes comeca do zero apos importacao: operacoes anteriores nao sao reconstruidas.
6. A reversao via deleteDatabase pode ficar bloqueada por conexoes abertas; nao existe orquestracao de fechamento de todas as abas, timeout, retry ou restauracao automatica.
7. Falha de quota foi simulada em driver; queda real de energia, disco cheio, indisponibilidade de armazenamento e recuperacao entre dispositivos permanecem sem comprovacao.
8. A validacao financeira permite campos adicionais, mas nao comprova semantica ou compatibilidade de cada campo legado com regras futuras.

## Gate recomendado
Manter PR #7 experimental e sem imports de producao. Antes de propor integracao, testar fixtures reais anonimizadas de exportacao JSON e Excel, documentar versoes de schema, implementar importacao explicitamente autorizada com verificacao de hash apos reabertura, rollback bloqueado/concorrente, backup original imutavel e restauracao testada em dispositivo separado. Exigir nova aprovacao antes de merge, Firebase ou publicacao.
