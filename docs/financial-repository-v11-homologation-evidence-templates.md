# Modelos de evidencias e criterios de aprovacao: homologacao financeira v1.1

**Status:** somente modelos documentais. Nao executar importacao, acessar backups reais ou armazenar dados pessoais neste repositorio.

## Modelo A - Registro de fixture autorizada

| Campo | Valor a preencher no futuro |
| --- | --- |
| ID de caso | JSON-01 / JSON-02 / XLSX-01 / ... |
| Consentimento para uso da copia anonimizada | PENDENTE (referencia nao sensivel) |
| Revisao de anonimização | PENDENTE |
| Origem e versao do exportador | PENDENTE |
| Schema e formato | PENDENTE |
| Identificador da copia (nao reversivel) | PENDENTE |
| Digest SHA-256 da copia anonimizada | PENDENTE |
| Contagem de meses / despesas / cartoes / parcelas | PENDENTE |
| Campos opcionais presentes | PENDENTE |
| Resultado da validacao estrutural | NAO EXECUTADO |
| Digest antes e apos reabertura | NAO EXECUTADO |
| Igualdade estrutural canonica | NAO EXECUTADO |
| Comparacao de totais/saldos | NAO EXECUTADO |
| Resultado da reimportacao e duplicidades | NAO EXECUTADO |
| Resultado de rollback e estado de conexoes | NAO EXECUTADO |
| Evidencia CI e aprovador | NAO EXECUTADO |
| Decisao | BLOQUEADO ATE EVIDENCIAS |

Nunca colar descricoes de gastos, nomes, numeros de conta, chaves ou conteudo de backup nos logs e documentos.

## Modelo B - Resultado por invariante

| Invariante | Resultado | Evidencia exigida |
| --- | --- | --- |
| Origem intacta | NAO EXECUTADO | Comparacao de bytes/hash do arquivo original sob controle do titular |
| Estrutura financeira completa | NAO EXECUTADO | Igualdade de schema, meses, itens, categorias, parcelas, exclusoes, investimentos e metadados |
| Saldos e totais | NAO EXECUTADO | Valores de referencia calculados independentemente, sem divergencia |
| Integridade de destino | NAO EXECUTADO | Hash de snapshot apos fechar e reabrir banco isolado |
| Rejeicao segura | NAO EXECUTADO | Sem escrita apos entrada invalida, adulterada ou desconhecida |
| Idempotencia | NAO EXECUTADO | Reimportacao nao duplica registros; repeticoes legitimas preservadas |
| Reversao | NAO EXECUTADO | deleteDatabase onsuccess e nova leitura vazia |
| Exclusao bloqueada | NAO EXECUTADO | Evento blocked nao e tratado como sucesso; conclusao apenas apos fechamento |
| Privacidade | NAO EXECUTADO | Anonimizacao revisada, ausencia de dados pessoais em CI |

## Modelo C - Decisao de gate

- **APROVADO:** todas as invariantes obrigatorias aprovadas, fixtures autorizadas, versoes cobertas e evidencias CI/manuais registradas; nao autoriza integracao por si so.
- **REPROVADO:** qualquer perda de campo, divergencia financeira, duplicacao indevida, corrupcao aceita, escrita parcial ou rollback falsamente confirmado.
- **BLOQUEADO:** ausencia de autorizacao, anonimização incompleta, falta de fixture, resultado pendente, erro de infraestrutura ou cobertura insuficiente.
- **NAO APLICAVEL:** somente com justificativa especifica e aprovacao registrada; nunca usar para ocultar falha.

## Gate de inicio da homologacao real

Exige autorizacao expressa do titular para uso de copias anonimizadas, revisao de privacidade e definicao de ambiente isolado. JSON simples e selado podem ser avaliados com LegacyPlan; XLSX requer contrato de transformacao futuro. Nenhum modelo implica ativacao automatica, acesso a backups reais, alteracao de main, Firebase, merge ou publicacao.

**Baseline:** GitHub Actions #404 para f6382a2 com 150/150 testes aprovados. O CI de f1eeeca e de commits posteriores deve ser confirmado separadamente.
