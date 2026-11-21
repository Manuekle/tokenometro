# Tema e idioma en el footer

Diseño aprobado: dos controles segmentados visibles, integrados en el footer existente con Allo, sus superficies redondeadas y los colores actuales.

- Tema: Claro / Oscuro. Antes de elegir se respeta el tema del sistema; al elegir se aplica a toda la página y se guarda en este navegador. Un script previo a la hidratación restaura el tema para evitar un destello del tema equivocado.
- Idioma: Español / English. Español es el idioma inicial. Cambiar de idioma actualiza la interfaz completa, incluidos los diálogos, ayudas, estados, etiquetas accesibles y textos exportados. No traduce ni reemplaza el texto del usuario ni los nombres propios de modelos o proveedores. Los precios siguen en USD.
- Las preferencias se guardan separadas de los datos de trabajo. El cambio no recarga la página ni remonta el área de trabajo, por lo que conserva muestras, filtros, modelos fijados y cálculos.
- Ambos controles tienen etiquetas, selección anunciada, foco visible y funcionamiento con teclado. En móvil se acomodan sin desbordar.
- Un proveedor de preferencias comparte el estado con los componentes. Un catálogo de mensajes centralizado mantiene las traducciones; las funciones que producen textos reciben el idioma explícitamente. El atributo lang del documento sigue la selección.
- La versión estática de GitHub Pages sigue funcionando sin servidor, cookies ni servicios de traducción. Si el almacenamiento está bloqueado o contiene datos inválidos, los controles siguen funcionando durante la sesión.

## Validación

Comprobar persistencia y valores inválidos, cobertura de mensajes y ausencia de traducción de entradas del usuario. Ejecutar las pruebas existentes, lint, typecheck y exportación estática. Probar ambos temas e idiomas en navegador, recargar para confirmar preferencias, abrir diálogos y revisar el footer en móvil. Publicar por una rama de trabajo y pull request, sin push directo a main, y verificar el despliegue de Pages.

## Revisión del diseño

- [x] Contexto del proyecto y publicación estática revisados.
- [x] Alternativas revisadas: controles visibles frente a menús desplegables.
- [x] Usuario aprobó controles visibles y cambio inmediato con persistencia.
- [x] Sin placeholders ni cambios ajenos a tema e idioma.
- [ ] Usuario revisa esta especificación escrita antes de implementar.
