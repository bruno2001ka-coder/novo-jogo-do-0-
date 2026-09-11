# Quintal 3D — Base Técnica

Recomeço do projeto com uma fundação pequena e mensurável.

## Fase 1 — Campo de provas
- personagem com andar, correr, pulo e animações;
- moto e carro com rodas girando e esterço visual;
- pista técnica com reta, slalom, lombada, rampa/plataforma, calçada, degraus, parede de impacto e garagem;
- colisão AABB simples com slide;
- veículos acompanham altura, arfagem e rolagem da pista;
- profiler interno de FPS, frame time, p95, draw calls, triângulos, geometrias e texturas;
- profiler aparece somente com `?debug=1`;
- controles para PC e celular;
- PWA;
- deploy automático pelo Netlify.

## O que NÃO existe
Favela, polícia, helicóptero, NPCs, fazenda, cultivo, armas, economia, cidade ou sistemas legados.

Os GLBs de personagem, moto, carro e animação de pilotagem ainda são carregados do repositório antigo apenas como fonte de assets. Se um modelo falhar, há fallbacks procedurais para a inicialização continuar.

## Controles
- WASD: andar/dirigir
- Shift: correr
- Espaço: pular
- M: moto
- V: carro
- E: veículo mais próximo / sair
- R: reset
- Mouse ou arraste do lado direito: câmera

## Diagnóstico
Abra com `?debug=1` para ver o profiler técnico e a grade de referência.
