# Terra em Dados

Prot�tipo est�tico da proposta conceitual do Projeto Integrador. Apresenta um explorador de mapa, camadas tem�ticas e cria��o de pontos tempor�rios para demonstrar uma poss�vel intera��o.

## Escopo e limites

- Os pontos criados ficam apenas na mem�ria da aba e desaparecem ao recarregar.
- Nenhuma contribui��o � enviada, compartilhada ou persistida.
- N�o h� conjunto de dados local validado nem coleta de campo.
- A busca de lugares usa o servi�o Nominatim; o mapa base usa OpenStreetMap. Ambos requerem conex�o.
- O prot�tipo n�o constitui evid�ncia de usabilidade, efic�cia ou aceita��o comunit�ria.

## Execu��o local

Requer Node.js 24 ou superior.

```sh
npm run build
```

O resultado est�tico � gerado em `dist/`. Abra `index.html` por um servidor est�tico para usar o mapa.

## Publica��o

O workflow `.github/workflows/pages.yml` compila com Node.js 24 e publica `dist/` no GitHub Pages em cada push para `main` ou por execu��o manual. Nas configura��es do reposit�rio, selecione **Settings  Pages  Build and deployment  Source: GitHub Actions**.

