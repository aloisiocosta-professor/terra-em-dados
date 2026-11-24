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

## Categorias dos filtros do mapa

Os filtros temáticos consultam feições OpenStreetMap dentro de **2 km do centro visível do mapa**. A consulta só é feita quando um filtro é ativado; se o usuário deslocar o mapa mais de 1,5 km, as camadas ativas são atualizadas. O protótipo consulta somente a categoria ativada, com chamadas sequenciais, à instância pública de Overpass para a América do Sul, operada por ovp.dresel.systems: https://ovp.dresel.systems/ (API regional: https://ovp.dresel.systems/api-sa/interpreter). O operador informa CORS aberto, atualização regular e limite de quatro consultas paralelas por IP e região; não oferece garantia de disponibilidade. É um serviço comunitário sem garantia de disponibilidade; a página fornece estados de carregamento, quantidade encontrada e indisponibilidade.

| Filtro | Tags OSM selecionadas | Representação visual |
|---|---|---|
| Água e recursos hídricos | `natural=water/spring/hot_spring`, `waterway=*`, `water=lake/pond/reservoir`, `landuse=reservoir` | Linhas e áreas em azul; nascentes e pontos como marcadores. |
| Estradas e acessibilidade | `highway=*` em vias (ways) | Linhas em terracota; vias principais com traço mais espesso. |
| Educação | `amenity=school/college/university/kindergarten/training` | Marcadores e áreas em azul; inclui o ponto do CETI da SEDUC-PI. |
| Saúde | `amenity=hospital/clinic/doctors/dentist/pharmacy` e `healthcare=*` | Marcadores e áreas em vermelho. |
| Produção rural | `landuse=farmland/farmyard/orchard/vineyard/plant_nursery` | Polígonos em ocre. |
| Meio ambiente | `natural=wood/scrub/wetland/grassland/heath`, `landuse=forest/grass/meadow`, `leisure=park/nature_reserve/garden` | Áreas e linhas em verde. |
| Espaços comunitários | `amenity=community_centre/social_centre/social_facility/place_of_worship`, `leisure=sports_centre/sports_hall` | Marcadores e áreas em violeta. |
| Infraestrutura e serviços | `amenity=post_office/police/fire_station/drinking_water/water_point/toilets/waste_disposal/marketplace/bus_station`, `man_made=water_tower/water_well/communications_tower`, `power=substation/plant` | Marcadores e áreas em azul-ardósia. |

A cor da camada corresponde à cor do controle temático. Popups informam o nome, tags relevantes e identificador da feição no OSM. Uma feição recebe uma categoria principal para evitar desenho duplicado. O protótipo consulta nós e vias; áreas complexas mapeadas somente como relações podem não aparecer. O limite de 2 km e a seleção de tags são filtros de visualização do protótipo, não uma classificação oficial do território.

A base segue o modelo colaborativo e licença ODbL do OpenStreetMap. A aplicação mantém a atribuição no mapa e no rodapé. Categorias com zero feições mostram esse resultado sem inferir ausência física do recurso. Tags e cobertura local podem variar; não há validação de campo.
