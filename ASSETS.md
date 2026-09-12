# Materiais e modelos - build 36

Asphalt012, Concrete034, Ground037, Bark012 e Grass004 sao materiais CC0 de
[ambientCG](https://ambientcg.com). Os URLs originais e os metadados estao em
`assets/materials-sources.json`. Os mapas de cor, normal OpenGL e rugosidade
foram reduzidos para ate 1024 pixels e convertidos em WebP para distribuicao.

Os quatro GLB sao os modelos ja utilizados pelo proprietario neste jogo, copiados
de `bruno2001ka-coder/cloude-jogo-` para eliminar a dependencia de carregamento
daquele repositorio. Nao foi atribuida uma nova licenca a esses modelos.

Three.js 0.160.0 e polygon-clipping 0.15.7 estao em `vendor`, com suas licencas MIT.
Arvores, folhas, postes, cercas e geometria viaria sao gerados pelo codigo local.

## Implantacao

`WorldLayout.js` e a fonte compartilhada das superficies visuais e alturas de
apoio. As vias usam uniao e diferenca de poligonos; calcadas e acostamentos sao
recortados fora do asfalto. O lote existente da casa e preservado. Acesso e
estacionamento sao vias explicitas, sem objetos plantados na area de circulacao.

`npm test` verifica fisica, implantacao, colisores e passagens do carro e da moto.
`npm run build` prepara `dist` com recursos em `releases/36/`, manifesto SHA-256 e
service worker que so ativa depois de baixar o pacote completo. GitHub Pages
publica somente `dist`, depois dos testes. Para testar localmente:

```sh
npm run build
node scripts/serve.mjs dist 4177
```

Esta versao melhora materiais, sombras e geometria, mas continua sendo um jogo
leve de navegador com cenario procedural, nao uma producao fotorrealista AAA.
