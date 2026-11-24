# Registro de fontes e dados territoriais

**Projeto:** Terra em Dados — protótipo demonstrativo  
**Consulta das fontes:** 24 de novembro de 2026  
**Tipo de busca:** exploratória; não é revisão sistemática.

## Estratégia de busca e seleção

Foram priorizadas fontes primárias de órgãos públicos e serviços geográficos institucionais para o recorte do Assentamento 17 de Abril, em Teresina (PI). As consultas literais usadas na busca exploratória foram:

- `site:pamgia.ibama.gov.br/server/rest/services/01_Publicacoes_Bases/assentamentos_incra FeatureServer assentamentos INCRA geometry`
- `site:gov.br/piaui "17 de Abril" "100 famílias" assentamento Teresina escola`

A segunda consulta levou à notícia oficial hospedada em `pi.gov.br`; a SEDUC-PI foi consultada como fonte institucional complementar. Foram selecionados dados ligados explicitamente ao assentamento e à escola ou a uma camada geográfica com crédito institucional identificável. A busca localiza fontes candidatas; não avalia exaustivamente todas as bases disponíveis.

## Dados implementados

| Dado | Fonte e referência | Uso no protótipo | Limite conhecido |
|---|---|---|---|
| Mais de 100 famílias; maioria descrita como agricultores familiares | Governo do Piauí, notícia publicada em 07/10/2025: https://www.pi.gov.br/governo-do-estado-transforma-estrutura-de-escola-da-zona-rural-de-teresina-que-e-destaque-em-competicoes-de-educacao/ | Cartão contextual abaixo do mapa | Declaração de notícia de 2025, sem método de contagem publicado na página; não é censo atual nem estimativa própria. |
| CETI Lucas Meireles Alves no Assentamento 17 de Abril, zona rural de Teresina | SEDUC-PI, notícia de 07/10/2025: https://seduc.pi.gov.br/noticias/noticia/13080/governador-rafael-fonteles-e-secretario-washington-bandeira-inauguram-reforma-e-moderniza-ao-de-escola-em-assentamento-na-zona-rural-de-teresina | Ponto de referência para centralizar o mapa | A coordenada `-5.3001571, -42.743763` foi obtida do destino do link de mapa associado à notícia. É uma localização de referência, não levantamento GNSS nem validação de campo. |
| Polígono de assentamento | PAMGIA/IBAMA, serviço ArcGIS “Assentamentos - INCRA”, camada 1: https://pamgia.ibama.gov.br/server/rest/services/01_Publicacoes_Bases/assentamentos_incra/FeatureServer/1 | Consulta espacial ao redor do ponto da escola; polígono retornado é carregado no Leaflet | O metadata da camada credita INCRA e identifica geometria poligonal, mas não informa data de atualização. O limite cadastral não deve ser interpretado como delimitação atual de posse, uso ou consenso comunitário. |
| Ruas e base cartográfica | OpenStreetMap: https://www.openstreetmap.org/copyright | Mapa-base com atribuição visível do OSM | Base colaborativa; cobertura, atualidade e detalhe variam localmente. |

A consulta espacial da camada do INCRA usa o ponto da escola, sistema de entrada EPSG:4326, relação espacial de interseção, campos de identificação e `f=geojson`; os dados são solicitados ao serviço público no carregamento da página. A camada declara referência espacial EPSG:4674 e crédito INCRA. O navegador confirmou que o serviço retornou o polígono do Assentamento 17 de Abril durante a validação em 24/11/2026.

## Estado da evidência

- **Confirmado na fonte:** publicação e teor da notícia do Governo do Piauí; localização nominal da escola e do assentamento na notícia da SEDUC-PI; geometria poligonal, campos e crédito INCRA na camada ArcGIS.
- **Confirmado no protótipo:** marcador escolar e polígono renderizado a partir da consulta espacial do serviço.
- **Não verificado:** data de atualização e precisão cadastral atual do polígono; contagem atual de famílias; validação das coordenadas ou limites com visita de campo ou representantes locais.
- **Interpretação:** o ponto escolar serve como referência de navegação e a camada do assentamento oferece contexto territorial. Nenhum dos dois substitui cadastro oficial consultado para fins administrativos ou validação comunitária.

## Reprodutibilidade

Data de busca e inspeção: **24/11/2026**. As camadas geográficas são consultadas remotamente e podem mudar ou ficar temporariamente indisponíveis; se a consulta falhar, o protótipo informa a indisponibilidade e mantém o marcador da escola e as referências de origem.
