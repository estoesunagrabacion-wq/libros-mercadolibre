/**
 * Registrador de Ventas y Gastos — Librería
 * ------------------------------------------------------------
 * Backend de Google Apps Script embebido en la planilla.
 *
 * Escribe cada movimiento en la pestaña "Registro" del MISMO
 * archivo de Google Sheets y mantiene una pestaña "Resumen" que
 * se calcula sola, agrupada por mes (registro histórico por mes/año).
 *
 * No modifica ninguna otra pestaña existente.
 */

// Zona horaria de Argentina para fechas y armado del período (mes).
var TZ = 'America/Argentina/Buenos_Aires';

var HOJA_REGISTRO = 'Registro';
var HOJA_RESUMEN = 'Resumen';

// Orden de las columnas de la pestaña "Registro".
var ENCABEZADOS = ['Fecha', 'Mes', 'Detalle', 'Efectivo', 'Tarjeta', 'Otros', 'Egresos', 'USD', 'Medio'];

/**
 * Sirve la página web (la app) cuando se abre la URL publicada.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Librería · Ventas y Gastos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Devuelve la planilla contenedora del script. */
function getPlanilla_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Devuelve la pestaña "Registro", creándola con sus encabezados
 * y formatos la primera vez.
 */
function getHojaRegistro_() {
  var ss = getPlanilla_();
  var hoja = ss.getSheetByName(HOJA_REGISTRO);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_REGISTRO);
  }

  // Si la primera fila está vacía, escribimos encabezados y formatos.
  var primera = hoja.getRange(1, 1, 1, ENCABEZADOS.length).getValues()[0];
  var estaVacia = primera.every(function (c) { return c === '' || c === null; });
  if (estaVacia) {
    hoja.getRange(1, 1, 1, ENCABEZADOS.length)
      .setValues([ENCABEZADOS])
      .setFontWeight('bold')
      .setBackground('#2b2b2b')
      .setFontColor('#ffffff');
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm');   // Fecha y hora
    hoja.getRange('D:G').setNumberFormat('#,##0');              // Montos en $
    hoja.getRange('H:H').setNumberFormat('#,##0.00');           // Montos en USD
    hoja.setColumnWidth(3, 340);                                // Detalle más ancho
  }
  // Compatibilidad: si a una planilla anterior le falta la columna "Medio", la agrega.
  if (hoja.getRange(1, 9).getValue() === '') {
    hoja.getRange(1, 9)
      .setValue('Medio')
      .setFontWeight('bold').setBackground('#2b2b2b').setFontColor('#ffffff');
  }
  return hoja;
}

/**
 * Devuelve la pestaña "Resumen", creándola con una fórmula QUERY
 * que agrupa todos los movimientos por mes.
 */
function asegurarResumen_() {
  var ss = getPlanilla_();
  var hoja = ss.getSheetByName(HOJA_RESUMEN);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_RESUMEN);
  }

  if (hoja.getRange('A1').getValue() === '') {
    var enc = ['Período (mes)', 'Efectivo', 'Tarjeta', 'Otros',
               'Total ingresos', 'Egresos', 'Neto', 'USD'];
    hoja.getRange(1, 1, 1, enc.length)
      .setValues([enc])
      .setFontWeight('bold')
      .setBackground('#2b2b2b')
      .setFontColor('#ffffff');
    hoja.setFrozenRows(1);

    // Agrupa por la columna "Mes" (Registro!B) y suma cada medio.
    var formula =
      '=IFERROR(QUERY(Registro!B2:H, "' +
      'select B, sum(D), sum(E), sum(F), sum(D)+sum(E)+sum(F), sum(G), ' +
      'sum(D)+sum(E)+sum(F)-sum(G), sum(H) ' +
      'where B is not null group by B order by B desc ' +
      'label B \'\', sum(D) \'\', sum(E) \'\', sum(F) \'\', ' +
      'sum(D)+sum(E)+sum(F) \'\', sum(G) \'\', ' +
      'sum(D)+sum(E)+sum(F)-sum(G) \'\', sum(H) \'\'", 0), "")';
    hoja.getRange('A2').setFormula(formula);

    hoja.getRange('B:G').setNumberFormat('#,##0');
    hoja.getRange('H:H').setNumberFormat('#,##0.00');
    hoja.setColumnWidth(1, 140);
  }
  return hoja;
}

/**
 * Guarda un movimiento. Lo llama la app con google.script.run.
 *
 * @param {Object} datos
 *   datos.tipo    'ingreso' | 'egreso'
 *   datos.detalle nombre del ítem (venta) o concepto (gasto)
 *   datos.importe importe en pesos (número)
 *   datos.medio   'Efectivo' | 'Tarjeta' | 'Otros'  (solo ventas)
 *   datos.usd     importe en dólares (número, opcional)
 * @return {Object} resumen actualizado (ver getResumen).
 */
function guardar(datos) {
  datos = datos || {};
  var detalle = (datos.detalle || '').toString().trim();
  var importe = Number(datos.importe) || 0;
  var usd = Number(datos.usd) || 0;

  if (!detalle) {
    throw new Error('Falta el detalle / concepto.');
  }
  if (importe <= 0 && usd <= 0) {
    throw new Error('Ingresá un importe en pesos o en dólares mayor a cero.');
  }

  var hoja = getHojaRegistro_();
  asegurarResumen_();

  var ahora = new Date();
  var mes = Utilities.formatDate(ahora, TZ, 'yyyy-MM');

  var efectivo = '', tarjeta = '', otros = '', egresos = '';

  if (datos.tipo === 'egreso') {
    egresos = importe > 0 ? importe : '';
  } else {
    // Venta: el importe va a la columna del medio con que se cobró.
    if (importe > 0) {
      if (datos.medio === 'Tarjeta') {
        tarjeta = importe;
      } else if (datos.medio === 'Otros') {
        otros = importe;
      } else {
        efectivo = importe; // Efectivo por defecto
      }
    }
  }

  // Medio de pago: en ventas es con qué se cobró; en gastos, con qué se pagó.
  var medioPago = datos.medio || 'Efectivo';

  var fila = [ahora, mes, detalle, efectivo, tarjeta, otros, egresos, usd > 0 ? usd : '', medioPago];

  // Calcula en qué fila escribir. Cuando cambia el día, salta una fila para
  // dejar una separación en blanco entre jornadas.
  // (No se usa appendRow porque ignora las filas vacías y pisaría la separación.)
  var ultima = hoja.getLastRow();
  var destino = ultima + 1;
  if (ultima >= 2) {
    var ultimaFecha = hoja.getRange(ultima, 1).getValue();
    if (ultimaFecha instanceof Date) {
      var ultDia = Utilities.formatDate(ultimaFecha, TZ, 'yyyy-MM-dd');
      var hoyDia = Utilities.formatDate(ahora, TZ, 'yyyy-MM-dd');
      if (ultDia !== hoyDia) { destino += 1; }
    }
  }
  hoja.getRange(destino, 1, 1, fila.length).setValues([fila]);

  return getResumen();
}

/**
 * Calcula los totales de HOY y del MES en curso a partir del Registro.
 * @return {Object} { hoy: {...}, mes: {...} }
 */
function getResumen() {
  var hoja = getHojaRegistro_();
  var ultima = hoja.getLastRow();

  var res = {
    hoy: nuevoAcumulador_(),
    mes: nuevoAcumulador_()
  };
  if (ultima < 2) {
    return res;
  }

  var valores = hoja.getRange(2, 1, ultima - 1, ENCABEZADOS.length).getValues();
  var hoyStr = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var mesStr = Utilities.formatDate(new Date(), TZ, 'yyyy-MM');

  valores.forEach(function (f) {
    var fecha = f[0];
    if (!(fecha instanceof Date)) {
      return;
    }
    var fStr = Utilities.formatDate(fecha, TZ, 'yyyy-MM-dd');
    var fMes = Utilities.formatDate(fecha, TZ, 'yyyy-MM');
    var mov = {
      efectivo: Number(f[3]) || 0,
      tarjeta: Number(f[4]) || 0,
      otros: Number(f[5]) || 0,
      egresos: Number(f[6]) || 0,
      usd: Number(f[7]) || 0
    };
    if (fMes === mesStr) { acumular_(res.mes, mov); }
    if (fStr === hoyStr) { acumular_(res.hoy, mov); }
  });

  return res;
}

function nuevoAcumulador_() {
  return { efectivo: 0, tarjeta: 0, otros: 0, ingresos: 0, egresos: 0, neto: 0, usd: 0, cant: 0 };
}

function acumular_(o, mov) {
  o.efectivo += mov.efectivo;
  o.tarjeta += mov.tarjeta;
  o.otros += mov.otros;
  o.egresos += mov.egresos;
  o.usd += mov.usd;
  o.ingresos += mov.efectivo + mov.tarjeta + mov.otros;
  o.neto += mov.efectivo + mov.tarjeta + mov.otros - mov.egresos;
  o.cant += 1;
}

/**
 * Devuelve el detalle (movimiento por movimiento) de HOY y del MES en curso,
 * ordenado del más reciente al más antiguo. Lo usa la vista "Ver detalle".
 * @return {Object} { hoy: [movimiento...], mes: [movimiento...] }
 */
/**
 * Convierte una fila de la planilla en un objeto de movimiento, o null si la
 * fila no es un movimiento (fila en blanco / separador).
 */
function filaAMovimiento_(f) {
  var fecha = f[0];
  if (!(fecha instanceof Date)) {
    return null;
  }
  var ef = Number(f[3]) || 0, ta = Number(f[4]) || 0,
      ot = Number(f[5]) || 0, eg = Number(f[6]) || 0, us = Number(f[7]) || 0;
  var medioTxt = f[8] ? String(f[8]).trim() : '';

  var esEgreso = (eg > 0 && ef === 0 && ta === 0 && ot === 0);
  var medioIng = ta > 0 ? 'Tarjeta' : (ot > 0 ? 'Otros' : (ef > 0 ? 'Efectivo' : ''));

  return {
    orden: fecha.getTime(),
    hora: Utilities.formatDate(fecha, TZ, 'dd/MM HH:mm'),
    detalle: f[2],
    tipo: esEgreso ? 'Egreso' : 'Ingreso',
    medio: esEgreso ? medioTxt : (medioIng || medioTxt),
    monto: esEgreso ? eg : (ef + ta + ot),
    usd: us
  };
}

function getDetalle() {
  var hoja = getHojaRegistro_();
  var ultima = hoja.getLastRow();
  var out = { hoy: [], mes: [] };
  if (ultima < 2) {
    return out;
  }

  var valores = hoja.getRange(2, 1, ultima - 1, ENCABEZADOS.length).getValues();
  var hoyStr = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var mesStr = Utilities.formatDate(new Date(), TZ, 'yyyy-MM');

  valores.forEach(function (f) {
    var item = filaAMovimiento_(f);
    if (!item) { return; }
    var fStr = Utilities.formatDate(f[0], TZ, 'yyyy-MM-dd');
    var fMes = Utilities.formatDate(f[0], TZ, 'yyyy-MM');
    if (fMes === mesStr) { out.mes.push(item); }
    if (fStr === hoyStr) { out.hoy.push(item); }
  });

  out.hoy.sort(function (a, b) { return b.orden - a.orden; });
  out.mes.sort(function (a, b) { return b.orden - a.orden; });
  return out;
}

/**
 * Devuelve los movimientos entre dos fechas (inclusive), del más reciente al
 * más antiguo. Las fechas llegan como texto 'yyyy-MM-dd'. Lo usa la solapa
 * "Período" para calcular la Caja (u otros filtros) sobre un rango a elección.
 */
function getDetalleRango(desde, hasta) {
  var hoja = getHojaRegistro_();
  var ultima = hoja.getLastRow();
  var out = [];
  if (ultima < 2) {
    return out;
  }
  desde = String(desde || '');
  hasta = String(hasta || '');

  var valores = hoja.getRange(2, 1, ultima - 1, ENCABEZADOS.length).getValues();
  valores.forEach(function (f) {
    if (!(f[0] instanceof Date)) { return; }
    var fStr = Utilities.formatDate(f[0], TZ, 'yyyy-MM-dd');
    if (desde && fStr < desde) { return; }
    if (hasta && fStr > hasta) { return; }
    var item = filaAMovimiento_(f);
    if (item) { out.push(item); }
  });

  out.sort(function (a, b) { return b.orden - a.orden; });
  return out;
}
