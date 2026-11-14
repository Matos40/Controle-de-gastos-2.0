# Validador local JSON/XLSX — Fase 1 (contratos sinteticos)

**PR #7. Escopo:** somente contratos de decisao e testes com metadados inventados, sem leitura de arquivos.

## Entregas
- `tests/fixtures/financialRepositoryV11ValidatorPhase1Contracts.cjs`: modulo isolado CommonJS com formatos, perfis, politica versionada, verificacao de checks e relatorio minimo imutavel.
- `tests/financialRepositoryV11ValidatorPhase1.test.cjs`: sete cenarios conceituais JSON/XLSX e seis testes adicionais de precedencia, entradas invalidas, versoes e nao mutacao.

## Limites importantes
Os cenarios sinteticos sao **metadados de verificacoes predefinidas**, nao arquivos JSON ou XLSX reais, nem demonstracoes de capacidade de detectar credenciais, CPF, email, formula externa ou metadados ocultos. Os testes comprovam apenas a politica de decisao sobre checks fornecidos. Nenhum leitor, parser, scanner de privacidade, validador de integridade de arquivo ou ferramenta de anonimizacao foi implementado.

- PASS: checks fornecidos aprovados; nunca significa anonimato garantido.
- REVIEW: check de revisao ou informativo falhou.
- BLOCKED: check bloqueante falhou; tem precedencia sobre REVIEW.
- Entrada invalida ou politica desconhecida gera erro de contrato, nao parecer PASS.
- O relatorio exclui valores, descricoes, IDs, caminhos, digests e dados financeiros. A propriedade `reviewedByHuman` e sempre falsa.
- Os contratos nao acessam sistema de arquivos, rede, IndexedDB, Firebase ou o aplicativo.

## Autorizacoes
G0 documental e Fase 1 sintetica autorizados. G1 acesso a copias anonimizadas, G2 homologacao real, G3 integracao e G4 merge/Firebase/publicacao continuam nao autorizados. Sem migracao, transformacao ou alteracao de main/produçao.

**CI:** confirmar workflow e logs do commit final antes de afirmar aprovacao.
