# Plano de homologacao controlada: backups reais anonimizados

**Projeto:** Raytech CG / FinancialRepository v1.1, PR #7.  
**Natureza:** documento de planejamento; nao autoriza coleta, importacao, integracao, deploy ou alteracao de dados.  
**Baseline verificado:** f6382a2671049d297aa58941bff1dda7b48b4c83; GitHub Actions #404 (run 43543628010): 150/150 testes aprovados, 0 falhas e 0 ignorados.

## 1. Pre-condicoes e privacidade
- Solicitar autorizacao expressa para usar arquivos de backup, mesmo anonimizados. Nao coletar automaticamente arquivos ou credenciais.
- Preparar copias anonimizadas **fora da producao**, sem nomes, descricoes livres identificaveis, emails, IDs pessoais, tokens, chaves, extratos, dados bancarios ou identificadores de dispositivos.
- Preservar somente relacoes e invariantes relevantes (meses, IDs substitutos estaveis, categorias, valores ficticios, datas, parcelas, exclusoes e vinculos); evitar alterar o formato estrutural original.
- Nunca armazenar dados pessoais reais no repositorio, fixtures ou logs de CI. Substituir valores reais por dados sinteticos coerentes, registrando a versao e o formato do exportador.
- Conservar o arquivo original sob controle do titular, sem edicao, e comparar somente copias autorizadas. Anonimizacao deve ser revisada antes de qualquer compartilhamento.

## 2. Inventario de formatos e fixtures
| ID | Origem | Fixture requerida | Criterio |
| --- | --- | --- | --- |
| JSON-01 | Backup JSON legado simples | Copia anonima com meses multiplos | Todos os meses e campos preservados |
| JSON-02 | Backup JSON selado v1 | Copia anonima com digest valido | Digest verificado antes da copia |
| JSON-03 | Backup JSON adulterado | Fixture sintetica propositalmente corrompida | Rejeitar sem escrita |
| XLSX-01 | Exportacao Excel reimportavel | Fixture sintetica equivalente ao layout real | Sem perda de linhas, parcelas e categorias |
| XLSX-02 | Excel com duplicidades legitimas | Duas despesas iguais com IDs distintos | Preservar ambas; reimportacao idempotente |
| JSON-04 | Exclusoes de parcelas e fixas | Fixture anonima com marcadores de exclusao | Nao ressuscitar lancamentos |
| JSON-05 | Renda extra e investimentos | Fixture anonima com destinos e receitas | Totais e classificacoes consistentes |
| JSON-06 | Campos adicionais desconhecidos | Fixture com metadados extensivos | Preservar sem reinterpretacao silenciosa |
| JSON-07 | Backup truncado e schema desconhecido | Fixtures sinteticas | Rejeitar com diagnostico |
| IDB-01 | Copia isolada IndexedDB | Banco de nome exclusivo | Digest igual apos reabertura |
| IDB-02 | Rollback com conexao aberta | Duas conexoes de teste | Estado bloqueado ate fechar conexoes |
| IDB-03 | Falha durante escrita | Driver de falha em banco experimental | Sem escrita parcial; origem intacta |

**Observacao:** o plano atual de LegacyPlan aceita JSON simples/selado v1; **nao aceita XLSX diretamente**. A validacao XLSX exige uma etapa futura de leitura/transformacao explicitamente especificada e aprovada, nunca presumir suporte.

## 3. Criterios de aceite (gate tecnico)
1. Arquivo de origem permanece bit a bit inalterado; copia anonima validada e versionada.
2. Cada mes, salario, orcamento, despesa, cartao, parcela, exclusao, renda extra, investimento e campo adicional mantem estrutura e significado.
3. Para JSON, igualdade estrutural canonica e digest verificado apos gravacao, fechamento e reabertura.
4. Totais e saldos calculados por regras financeiras de referencia concordam antes e depois da copia; tolerancia monetaria zero na representacao utilizada.
5. Backups adulterados, schemas desconhecidos e entradas invalidas sao rejeitados antes de qualquer escrita.
6. Reimportacao nao cria duplicidades; duplicidades legitimas sao preservadas.
7. Operacoes isoladas e rollback nunca alteram fonte; deleteDatabase bloqueado permanece pendente ate onsuccess.
8. Todos os testes automatizados passam, com logs sem dados sensiveis, e casos manuais sao registrados com evidencias anonimizadas.
9. Qualquer incompatibilidade impede avancar para integracao; nao ha migracao automatica nem mudanca de producao.

## 4. Plano de rollback e recuperacao
- Antes do ensaio: manter origem fora do IndexedDB experimental e registrar identificador nao sensivel, versao e digest da copia autorizada.
- Executar apenas em banco de teste com nome unico e namespace reservado, nunca nomes da aplicacao em producao.
- Ao falhar validacao, abortar antes da escrita. Ao falhar transacao, exigir ausencia de estado parcial e preservar origem.
- Ao reverter, fechar todas as conexoes de teste; solicitar deleteDatabase exclusivamente do banco experimental. Se houver blocked, nao declarar sucesso.
- Confirmar onsuccess e verificar que uma nova abertura nao encontra estado financeiro persistido; conservar o arquivo de origem.
- Se nao houver exclusao confirmada, registrar estado PENDENTE e bloquear nova tentativa de migracao ate resolucao manual.

## 5. Evidencias e decisao
Registrar para cada fixture: ID, schema, origem da versao, hash da copia anonima, contagem de meses e registros, resultado da validacao, hash do destino, verificacao apos reabertura, resultado de rollback e referencia de teste/CI. Nunca registrar conteudo financeiro identificavel.

**Situacao:** planejamento pronto, homologacao real nao iniciada. Qualquer implementacao de importador XLSX, coleta de backups, migracao, merge, Firebase, deploy ou integracao depende de nova autorizacao explicita.
