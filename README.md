# Terra em Dados

Protótipo estático da proposta conceitual do Projeto Integrador. Apresenta um explorador de mapas, camadas temáticas e criação de pontos temporários para demonstrar uma possível interação.

## Escopo e limites

- Os pontos criados ficam apenas na memória desta aba e desaparecem ao recarregar a página.
- Nenhuma contribuição é enviada, compartilhada ou persistida.
- O protótipo não contém dados locais validados nem resultados de coleta de campo.
- A busca de lugares usa o serviço Nominatim; o mapa base usa OpenStreetMap. Ambos requerem conexão com a internet.
- O protótipo não constitui evidência de usabilidade, eficácia ou aceitação comunitária.

## Execução local

Requer Node.js 24 ou superior.

```sh
npm run build
```

O site estático é gerado em `dist/`. Abra `index.html` por meio de um servidor estático para usar o mapa.

## Publicação

O workflow `.github/workflows/pages.yml` compila com Node.js 24 e publica `dist/` no GitHub Pages a cada envio para `main` ou por execução manual. Nas configurações do repositório, selecione **Settings → Pages → Build and deployment → Source: GitHub Actions**.
