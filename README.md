# Tokenómetro

Compara cuánto cuesta **tu texto** en cada modelo de IA. Cuenta tokens con el tokenizador real de cada familia y
proyecta el gasto mensual de la API con tu propia carga de trabajo: volumen, caché, Batch, razonamiento y
recargos por contexto largo.

La idea: el precio por token no basta. El mismo texto da de 158 a 195 tokens según el modelo, así que dos modelos
con la misma tarifa no cuestan lo mismo.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # 135 tests (precios, tokenizadores, costos, filtros, comparación, barra fija, SEO)
pnpm build        # el catálogo se hornea y se revalida cada hora
pnpm snapshot     # refresca la copia local de precios (src/lib/catalog/snapshot.json)
pnpm icons        # rehace todos los íconos desde brand/icon.png (solo macOS, usa sips)
```

## De dónde salen los datos

| Fuente | Qué aporta | Estado |
|---|---|---|
| **OpenRouter** `GET /api/v1/models` | Modelos, precios de lista por token (entrada, salida, caché, Batch, recargo por contexto largo), contexto, familia de tokenizador, capacidades, retiro, índice de inteligencia de Artificial Analysis | **Fuente principal.** Pública, sin clave. |
| models.dev `GET /api.json` | Precios por proveedor (≈10 000 modelos) | Contraste |
| Vercel AI Gateway `GET /v1/models` | Precios de lista | Contraste |
| LiteLLM `model_prices_and_context_window.json` | Precios, Batch, prioridad | Contraste |
| Anthropic `POST /v1/messages/count_tokens` | Conteo exacto de Claude | Calibración (gratis, con tu clave) |
| Google `POST …/models/{m}:countTokens` | Conteo exacto de Gemini | Calibración (gratis, con tu clave) |

Al construir la herramienta se contrastaron los precios de los modelos insignia (OpenAI, Anthropic, Google) entre
las cuatro fuentes de precios: coinciden. OpenRouter además publica `…:batch` como entradas aparte (siempre a la
mitad), que aquí se pliegan al modelo base, y `pricing.overrides` con los recargos de contexto largo.

Si OpenRouter falla, la app usa `snapshot.json` y reintenta pronto.

## Cómo cuenta tokens

Todo ocurre **en el navegador**, en un Web Worker. Tu texto no se envía a ningún servidor.

| Precisión | Familias | Cómo |
|---|---|---|
| Exacto | OpenAI (`o200k`, `cl100k`), Qwen, DeepSeek, Mistral, Llama 3/4, Gemma | Tokenizador publicado. Los de Hugging Face (≈100 MB) se descargan una vez, a pedido, y quedan en Cache Storage |
| Aproximado | Gemini | Tokenizador de Gemma |
| Estimado | Claude, Grok, Nova, Cohere, otros | `o200k × factor` (Claude 1,14: 3,5 vs 4 caracteres por token) |
| Calibrado | Claude, Gemini | Razón medida contra la API del proveedor con tu texto |
| Exacto (propio) | Cualquier modelo con repositorio en Hugging Face: GLM, MiniMax, Xiaomi MiMo, Ling, Nemotron… | Su propio `tokenizer.json`, a pedido (ver abajo) |

El código está en `src/lib/tokenizers/`: `registry.ts` (familias), `counters.ts` (motores), `worker.ts` y
`client.ts` (hilo aparte), `resolve.ts` (qué fuente usar para cada familia).

### Tokenizador propio por modelo

La familia «otros» era el 40 % del catálogo (136 de 340 modelos) y se estimaba con el conteo de OpenAI. OpenRouter
publica el `hugging_face_id` de los modelos abiertos, así que cada uno puede contarse con **su** tokenizador:

- De esos 136 modelos, 85 tienen repositorio. De 81 repos, **61 publican `tokenizer.json`** (75 %); 13 usan un formato
  propio y 7 exigen acceso. En una muestra de 20 repos de proveedores distintos, los 20 cargaron y contaron bien.
- Pesan de 4 a 33 MB (mediana 17), así que **no se descargan solos**: bajo la tabla, en el detalle del modelo y en
  Comparar aparece «Contar con el suyo», con el tamaño sondeado antes con un `HEAD`. Si el servidor no informa el
  largo (comprime el archivo), se lee con un `GET` de 1 byte con `Range`. Nunca se baja el archivo para medirlo.
- Quedan en Cache Storage y se restauran al volver, sin descargar de nuevo. Como mucho 12 a la vez; el worker
  descarta el menos usado y lo recarga desde caché si hace falta.
- Los repos restringidos o sin `tokenizer.json` se recuerdan 7 días para no repetir la consulta.
- El id del repo viene de una API externa: se valida como `owner/name` antes de armar cualquier URL.

El mismo texto cambia de verdad: con el texto de ejemplo, Ling 3.0 Tiny pasa de 1 358 (estimado) a 1 412 tokens (+4 %).

## Cómo calcula el costo

Por solicitud, con el tokenizador de **cada** modelo:

```
entrada nueva  × tarifa de entrada
+ prefijo      × (aciertos × lectura de caché + fallos × max(entrada, escritura de caché))
+ salida       × tarifa de salida
+ razonamiento × tarifa de razonamiento (o de salida)
```

Se aplica el tramo de contexto largo cuando el prompt lo alcanza, la mezcla Batch solo en modelos que lo ofrecen, y
se marca si la solicitud no cabe en el contexto. Con eso se calcula la **frontera eficiente** (ningún modelo es a la
vez más barato y mejor) y su **codo**, que es la recomendación. `src/lib/cost/` y `src/lib/compute-rows.ts`.

## Comparar dos o más modelos

Fija modelos con ★ (en la tabla, en el detalle o desde «Agregar modelo») y abre la pestaña **Comparar**. Hasta 6 a
la vez, lado a lado:

- **Costo** (mes, año, solicitud, veces el más barato), **tokens** de la solicitud con la precisión de cada conteo,
  **tarifas** de lista y **calidad y límites** (índice, contexto, capacidades, retiro).
- En cada fila se resalta el mejor valor. Si todos empatan o solo uno es comparable, nadie gana: no se inventa un
  ganador. «No ofrece» no cuenta como cero.
- Un resumen en frases dice lo que significa la tabla: el más barato, el de mayor índice, cuánto cuesta ese salto y
  cuánto cambia el peso de la misma solicitud según el tokenizador.
- «Copiar tabla» deja un Markdown listo para pegar en un documento. «Comparar las recomendaciones» arranca con el
  más barato, el equilibrio y el de mayor calidad.
- Anchas, las columnas son modelos; en pantallas angostas cada modelo es una tarjeta.

La lógica está en `src/lib/compare.ts` (probada) y la interfaz en `src/components/compare-view.tsx`.

## Diseño

Tipografía [**Allo**](https://allo.joshpuckett.me) (`allo-font`, OFL-1.1) y su paleta. Cada rol de texto afina los
ejes de la fuente: peso (`wght`), redondez (`ROND`), tamaño óptico (`opsz`) y espaciado. Los iconos son los símbolos
de la propia fuente (⌕ ✕ ✓ ★ ⌄ ↗ …), no un set aparte. Sin bordes (las superficies se separan por tono), formas
redondas, sin rebote al desplazar y sin barras de scroll dentro de los componentes. Claro y oscuro siguen al sistema hasta que elijas un tema en el footer.

**Columna izquierda fija.** En pantallas anchas (desde 1024 px) «Tu texto» y «Tu carga de trabajo» te acompañan al
desplazarte. Como juntas miden más que una pantalla (≈1550 px), un `sticky` normal dejaría su parte baja fuera de
alcance. Así que la columna sigue a la página hasta que su borde inferior toca la ventana y ahí se queda; al subir
hace lo mismo con el borde superior. Nada de su aspecto cambia. Como todo `sticky`, solo se mueve dentro de su fila:
cuanto más larga la columna de resultados (más filas de la tabla, la vista Comparar), más acompaña.
`src/components/sticky-aside.tsx` y `src/lib/sticky.ts` (la cuenta, con tests).

## Tema e idioma

En el footer puedes elegir **Claro / Oscuro** y **Español / English**. El tema inicialmente sigue al sistema;
una selección explícita lo reemplaza. Las preferencias quedan guardadas en este navegador. Cambiar de idioma
traduce la interfaz, las ayudas y las tablas copiadas sin reemplazar tu texto ni reiniciar filtros o cálculos.
Los precios siguen en USD. Si el almacenamiento está bloqueado, los controles funcionan durante la sesión.

Las traducciones están en `src/lib/i18n/en.json`; los mensajes de origen son los textos en español. Los datos
variables se insertan después de traducir para conservar nombres de modelos, archivos y texto del usuario.

## Sitio, SEO y compartir

- **Ícono.** El de la app (unos binoculares) está en `brand/icon.png`. `pnpm icons` saca de ahí el de la pestaña, el de
  iOS, `favicon.ico` y los del manifest. Los de pestaña mantienen el mismo encuadre y espacio interior que el del footer.
- **Banner para compartir.** `src/app/opengraph-image.png` (1200×630) con su texto alternativo; Next lo copia también
  a `twitter:image`. Su texto está en inglés. Se dibujó con la tipografía y los colores de la app y muestra una misma frase cortada en 7 tokens
  por un tokenizador de OpenAI y en 8 por otro. Para cambiarlo, reemplaza el PNG.
- **Metadatos.** Título, descripción, canonical, Open Graph, Twitter Card, `robots` y `viewport` están en
  `src/app/layout.tsx`; los textos, en `src/lib/site.ts` (`SEO` para título, descripción, keywords y Open Graph en inglés). `robots.txt`, `sitemap.xml` y `manifest.webmanifest` salen de
  `src/app/{robots,sitemap,manifest}.ts`. La página lleva datos estructurados (`WebApplication`, JSON-LD).
- **Dirección del sitio.** En producción define `NEXT_PUBLIC_SITE_URL=https://tu-dominio` (ver `.env.example`); de ahí
  salen el canonical, la imagen para compartir y el sitemap. En Vercel se toma sola la del dominio de producción. Sin
  ninguna usa `http://localhost:3000`.
- **Pie de página.** `src/components/site-footer.tsx`: fuentes de los datos, créditos de la tipografía y avisos.

## Publicar en GitHub Pages

`.github/workflows/pages.yml` construye el sitio como archivos estáticos (`pnpm build:pages`, que usa
`NEXT_OUTPUT=export`) y lo publica en `https://<usuario>.github.io/<repo>/`. De esa dirección sale el prefijo `/<repo>`
de todas las rutas (`NEXT_PUBLIC_SITE_URL`, que el workflow arma solo). En Settings → Pages, elige **GitHub Actions**
como fuente. Los precios se leen de OpenRouter al construir, así que el workflow también corre cada 6 horas.
Para probarlo en local, ejecuta
`NEXT_PUBLIC_SITE_URL=https://usuario.github.io/repo pnpm build:pages` y sirve `out/` bajo `/repo/`.

## Límites

- Solo texto. Imágenes, audio y PDF no se calculan (los PDF se pegan como texto).
- Precios de lista: sin descuentos por volumen ni contratos, impuestos ni tipo de cambio.
- Modelos abiertos: se usa el precio de OpenRouter. Alojarlos tú tiene otro costo.
- El índice de calidad es general (Artificial Analysis). Valida con tus propios casos.
- Para generaciones muy nuevas, el tokenizador de la familia puede variar unos puntos.

## Siguiente

- Tokenizadores para los modelos cerrados de «otros» (51 sin repositorio) y para los 7 repos con acceso restringido.
- Extraer texto de PDF y Word al subir archivos.
- Estado en la URL y exportar a CSV.
