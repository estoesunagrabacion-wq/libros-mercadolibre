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

1. **Desde el juego** — pestaña *Textos*: libro, título, y el cuento pegado.
   Se guarda en el navegador de ese dispositivo. Con *Exportar / Importar JSON*
   lo pasás al celular o a otra máquina.

2. **Desde un archivo** — copiá `corpus.ejemplo.js` como `corpus.js` y cargá ahí
   los cuentos. El juego lo levanta solo al abrir la página.

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
