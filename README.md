# Cepeda Bros

Plataformero retro estilo Mario Bros hecho con Next.js 15 + React 19 y canvas 2D,
con la misma arquitectura de `duck-hunt-facho`.

- **Personaje:** Iván Cepeda en pixel-art (pelo crespo, gafas, bigote y barba,
  saco azul sobre camisa blanca), recreado a partir de las fotos de referencia
  que están en la raíz del proyecto (`01..03-ivan-cepeda.jpg`).
- **Meta:** la Casa de Nariño (`01-casa-narino.jpg`) recreada en pixel-art
  procedural con su pórtico, columnas, frontón y bandera de Colombia.
- **Nivel:** un solo nivel (Mundo 1-1) con pocos obstáculos: huecos, tuberías,
  bloques `?`, monedas, una escalera de piedra y 4 enemigos.

## Controles

- **Desktop:** flechas o `A`/`D` para moverse, `Espacio`/`↑`/`W` para saltar.
- **Móvil:** botones táctiles en pantalla (◀ ▶ para moverse, `A` para saltar).

## Desarrollo

```bash
npm install
npm run dev   # http://localhost:3002
```

Todos los sprites son procedurales (mapas de píxeles dibujados en canvas) y el
audio es chiptune generado con WebAudio, así que no se necesitan assets externos.

By [Cristhian Luna](https://www.instagram.com/cristhian_lunaa) - Team Cauca
