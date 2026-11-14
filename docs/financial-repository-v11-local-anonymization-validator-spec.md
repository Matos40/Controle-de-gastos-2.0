# Especificacao tecnica: validador local de anonimizacao JSON e XLSX

**Projeto:** Raytech CG / FinancialRepository v1.1 — PR #7
**Status:** somente especificacao, sem implementacao ou execucao.
**Autorizacao vigente:** G0 documental. G1 (recebimento de copias), G2 (homologacao), G3 (integracao) e G4 (merge/Firebase/publicacao) nao autorizados.

## 1. Objetivo e fronteiras
Propor um validador local e somente de leitura para **copias previamente anonimizadas**, capaz de emitir um parecer de privacidade e conformidade estrutural sem revelar valores. O validador nao anonimiza, nao corrige, nao regrava arquivos, nao executa migracoes e nao carrega o aplicativo. O resultado `PASS` indica somente que as regras automaticas conhecidas foram satisfeitas; **nao prova anonimato** e nao substitui revisao humana.

- Sem conexao de rede, telemetria, Firebase, GitHub API, IndexedDB de producao ou servicos externos.
- Processamento local em memoria, sem persistir conteudo, nomes originais de arquivo, caminhos completos ou amostras de dados em logs.
- Entrada somente por caminho explicitamente escolhido pelo operador, nunca varredura de diretorios.
- Nao aceitar arquivos reais na fase atual: especificacao e exemplos inteiramente sinteticos.
- Limites de tamanho, profundidade JSON, linhas/colunas XLSX e tempo; exceder limites resulta em `BLOCKED` sem processar parcialmente como aprovado.

## 2. Contrato conceitual
**Entrada futura:** `{ format: 'json'|'xlsx', file: <copia local explicitamente autorizada>, profile: <versao do exportador>, policyVersion }`.
**Saida proposta:** `{ decision: 'PASS'|'REVIEW'|'BLOCKED', policyVersion, format, schemaProfile, checks: [{ code, severity, status, count? }], structuralSummary: { monthCount?, sheetCount?, recordCounts? }, reviewedByHuman: false }`.
Nunca incluir valores de celulas, campos livres, hashes de conteudo sensivel, caminhos ou IDs originais no relatorio. Contagens agregadas so se nao puderem identificar pessoas; caso contrario, omitir. A decisao automatica nunca muda `reviewedByHuman` para true.

## 3. Regras comuns de privacidade
- Bloquear credenciais, tokens, chaves API, cookies, segredos, CPF/CNPJ, email, telefone, dados bancarios e identificadores pessoais detectaveis em valores, chaves adicionais e metadados.
- Marcar para revisao humana campos de texto livre, nomes de estabelecimentos, historicos, observacoes, datas precisas, valores reais e padroes raros; regex isolada nao garante anonimato.
- IDs substitutos devem ser sinteticos, estaveis dentro da fixture e preservar referencias cruzadas, sem reutilizar IDs originais.
- Detectar objetos/campos desconhecidos e emitir `REVIEW`, sem descarta-los silenciosamente.
- Valores financeiros ficticios devem manter consistencia matematica; preservar duplicidades legitimas, marcadores de exclusao e relacoes de parcelas.
- Nunca colocar exemplos de dados reais no repositorio, relatorios ou CI.

## 4. JSON
- Parse seguro e validacao de formato antes de qualquer interpretacao; rejeitar JSON truncado, tipos inesperados, profundidade excessiva e estrutura invalida.
- Perfis distintos: backup legado simples e envelope selado v1. Envelope selado com digest antigo apos modificacao nao e valido; a preparacao de uma nova fixture selada requer processo separado e autorizado. O validador **nao recalcula nem repara** digests.
- Verificar existencia e tipo de `selectedMonth`, `months`, colecoes financeiras, campos adicionais e relacionamentos conhecidos; manter a diferenca entre campo ausente e campo vazio.
- Checar coerencia de meses, categorias, despesas, cartoes, parcelas, exclusoes, renda extra, investimentos e metadados, conforme o perfil selecionado.
- `LegacyPlan` aceita apenas JSON legado simples ou selado v1 em planejamento; esta especificacao nao amplia suporte.

## 5. XLSX
- Leitura local planejada, sem executar formulas, macros, conexoes externas, consultas, hyperlinks ou atualizacoes remotas.
- Verificar assinaturas e estrutura ZIP/OOXML, tamanho descompactado e razao de compressao; bloquear arquivos malformados ou potencialmente expansivos.
- Inventariar abas visiveis/ocultas, cabecalhos, tipos, formulas, comentarios, notas, hyperlinks, propriedades, nomes definidos, objetos e referencias externas.
- Bloquear ou exigir revisao conforme politica para links externos, conexoes, macros, propriedades pessoais e texto residual; nao considerar aba oculta como anonima.
- Verificar linhas, tipos e referencias entre abas contra um perfil versionado do exportador, sem supor layout universal.
- Excel nao e importado diretamente pelo FinancialRepository v1.1. O validador nao se converte em importador.

## 6. Severidades e decisao
- `BLOCKED`: segredo/identificador sensivel detectado, formato invalido, integridade quebrada, referencia estrutural essencial inconsistente, limite excedido, perfil desconhecido sem avaliacao.
- `REVIEW`: texto livre, campo desconhecido, risco de reidentificacao, metadado ambiguo, data/valor com possivel unicidade ou regra dependente do exportador.
- `PASS`: nenhuma regra automatica conhecida acusou risco e perfil estrutural passou; ainda exige revisao humana antes de qualquer uso.
- Falha na leitura, parse ou regra implica `BLOCKED` (fail-closed). Nunca aprovar parcialmente.

## 7. Exemplos exclusivamente sinteticos (nao sao arquivos de teste)
- `JSON-SYN-01`: dois meses, despesas ficticias, IDs `syn-001`, parcela 2/3, exclusao e investimento, sem dados pessoais: esperado `PASS` automatico sujeito a revisao.
- `JSON-SYN-02`: mesmo esquema com `apiKey: 'FAKE-SECRET-EXAMPLE'`: esperado `BLOCKED`.
- `JSON-SYN-03`: campo adicional `customNote` de texto livre: esperado `REVIEW`.
- `JSON-SYN-04`: envelope selado com digest incompativel: esperado `BLOCKED`.
- `XLSX-SYN-01`: abas esperadas, linhas sinteticas, sem propriedades pessoais: esperado `PASS` automatico sujeito a revisao.
- `XLSX-SYN-02`: aba oculta com email ficticio de teste: esperado `BLOCKED`.
- `XLSX-SYN-03`: formula com referencia externa: esperado `BLOCKED`.
Esses resultados sao **requisitos propostos**, nao testes executados.

## 8. Evidencias futuras e criterio de aceite
1. Testes unitarios de cada regra, com fixtures inventadas e expectativas de PASS/REVIEW/BLOCKED.
2. Testes de leitura local sem escrita, sem rede e sem exposicao de conteudo nos logs.
3. Testes de limites de recursos, entradas corrompidas, referencias inconsistentes e metadados ocultos.
4. Comparacao com o perfil versionado de exportacao JSON/XLSX; revisao manual dos falsos positivos/negativos.
5. Registro do commit, run do GitHub Actions e totais de testes, sem dados identificaveis.
6. Revisao humana e autorizacao separada antes de receber ou testar qualquer copia anonimizada de origem real.

## 9. Fora do escopo
Nenhuma implementacao do validador nesta etapa; nenhum backup real lido; nenhuma transformacao, migracao, importacao, integracao, alteracao de main, Firebase ou producao; sem merge ou publicacao. A existencia deste documento nao autoriza as etapas G1-G4.
