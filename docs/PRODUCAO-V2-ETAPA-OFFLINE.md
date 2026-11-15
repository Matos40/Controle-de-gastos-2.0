# Preparação da produção V2 — etapa offline

Porta para a aplicação oficial exclusivamente as correções de cache/abertura offline da baseline homologada 4a01326a742731c3c2c86a54b5385f96041d8165. Cache oficial v14; namespace separado; mantém caches anteriores e localStorage intactos. Não altera regras financeiras, backup, login, nem o PR #7.

Não é a integração completa V2: a aplicação homologada usa UID, Firebase de testes, descrições fictícias e regras restritas. A nuvem real exige projeto Firebase de produção configurado, regras específicas e integração/validação de dados reais por contrato compatível. Nunca direcionar backups reais ao projeto de homologação. Não ligar sincronização por simples troca de URL. A promoção desta etapa não implica aprovação funcional da nuvem.
