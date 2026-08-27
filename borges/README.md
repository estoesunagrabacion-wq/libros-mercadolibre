# ¿De qué texto es?

Juego personal: aparece **una oración al azar** de un cuento y hay que adivinar a
qué texto pertenece. Si no sale, se puede pedir la **oración siguiente**, y una
**tercera vez** — ahí se corta.

Puntaje: **3** puntos si acertás con una sola oración, **2** con dos, **1** con tres.

Dos dificultades: *fácil* (cuatro opciones) y *difícil* (la lista completa de
cuentos cargados). Se puede elegir con qué libros jugar.

## Cargar los textos

El juego no trae textos: se los cargás vos, y quedan **en tu navegador**, no en
el repositorio. Hay dos maneras:

1. **Desde el juego** — pestaña *Textos*. Dos modos:
   - *Un libro entero*: pegás el libro completo y corta solo por los títulos.
     De **Ficciones** y **El Aleph** conoce el índice; para cualquier otro libro
     detecta los títulos por la forma (líneas cortas y sueltas, con un párrafo
     debajo). Antes de importar te muestra la lista de lo que encontró, con las
     oraciones de cada cuento y su primera línea, para destildar lo que no va.
   - *Un cuento suelto*: libro, título y texto.

   Todo se guarda en el navegador de ese dispositivo. Con *Exportar / Importar
   JSON* lo pasás al celular o a otra máquina.

2. **Desde un epub** — si el libro trae un archivo por cuento (como los de
   epublibre), `extraer-epub.py` lo corta solo usando el índice del propio epub:

       python3 extraer-epub.py Ficciones.epub El_Aleph.epub

   Deja un `corpus.js` listo. Descarta tapa, sinopsis, notas, dedicatorias,
   epígrafes de otros autores y la firma con lugar y fecha del final. También
   los prólogos y epílogos: no son cuentos y varios comparten nombre, así que
   como ítem del juego no se pueden decidir. Con `--con-paratextos` se incluyen.

3. **A mano** — copiá `corpus.ejemplo.js` como `corpus.js` y cargá ahí los
   cuentos. El juego lo levanta solo al abrir la página.

## Un solo archivo

Con `corpus.js` en su lugar:

    python3 armar-html.py

deja un `de-que-texto-es.html` con el juego y los textos adentro. Anda con
doble clic, sin servidor y sin conexión, y se pasa al celular por Drive o
por mail sin tener que importar nada. Como lleva los textos, tampoco se
versiona.

Volvé a correrlo cada vez que cambie el juego: el archivo armado es una
copia, no se actualiza solo.

## Por qué `corpus.js` no se sube

Este repositorio se publica entero en GitHub Pages. *Ficciones* y *El Aleph*
están bajo derechos de autor: subir los textos completos sería publicarlos.
Por eso `corpus.js` figura en el `.gitignore` — el motor del juego se versiona,
los libros no.

## Cómo se parten las oraciones

El texto se corta primero por párrafos y después en oraciones. Está contemplado
lo que suele romper este tipo de corte:

- abreviaturas (`pág.`, `etc.`, `cf.`, `p.m.`) e iniciales (`J. L. Borges`);
- incisos de diálogo (`—¿Lo creerás, Ariadna? —dijo Teseo—.` queda entero);
- comillas, paréntesis y puntos suspensivos al cerrar la oración.

En la pestaña *Textos* se ve cuántas oraciones detectó cada cuento, para
controlar que el corte haya quedado bien.
