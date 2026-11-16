# Laboratorio sintetico isolado FinancialRepository v1.1

**Escopo:** PR #7, somente testes automatizados com dados inteiramente inventados. Nao existe conexao com Firebase, importacao de backups reais, migracao real, alteracao de main ou deploy.

## Ambiente
- Teste Node.js + Playwright Chromium, com contexto de navegador novo, sem cookies nem origens persistidas.
- Origem de teste interceptada localmente em `http://localhost:8765/financial-v11-synthetic-lab`; nenhuma pagina de producao e acessada.
- Scripts experimentais carregados da branch do PR, sem carregar o aplicativo principal.
- IndexedDB exclusivo com nome `fr-v11-synthetic-<UUID>`, eliminado apos o teste.
- Fixtures 100% sinteticas com dois meses, salario ficticio, despesas fixas e variaveis, cartao parcelado, exclusoes, renda extra, investimento e metadados.

## Casos automatizados
1. Validar snapshot sintetico com LegacyPlan, inicializar banco experimental, fechar/reabrir, comparar estrutura JSON e SHA-256, confirmar revisao zero e ausencia de recibos historicos fabricados, verificar origem intacta, excluir apenas banco experimental.
2. Adulterar backup selado sintetico, confirmar rejeicao de checksum antes de criar destino e preservar origem.

## Limites e gates
- Os testes nao representam cobertura com arquivos reais ou exportacoes Excel.
- O laboratorio nao implementa importador, restaurador, migrador automatico ou ativacao de funcionalidades.
- A exclusao do banco de teste exige `onsuccess`; `onblocked` e falha, nunca sucesso presumido.
- Os criterios de homologacao com backups reais continuam pendentes de autorizacao expressa e revisao de anonimizacao.
- CI de qualquer commit novo precisa ser verificado antes de declarar testes aprovados.

**Autorizacao:** apenas preparacao do laboratorio com dados sinteticos. Main, Firebase e producao intocados; sem merge nem publicacao.
