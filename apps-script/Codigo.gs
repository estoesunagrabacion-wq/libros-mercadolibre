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
function filaAMovimiento_(f, fila) {
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
    fila: fila,                 // fila real en la planilla (para borrar/corregir)
    orden: fecha.getTime(),     // sello para validar antes de borrar
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

  valores.forEach(function (f, i) {
    var item = filaAMovimiento_(f, i + 2);   // los datos empiezan en la fila 2
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
  valores.forEach(function (f, i) {
    if (!(f[0] instanceof Date)) { return; }
    var fStr = Utilities.formatDate(f[0], TZ, 'yyyy-MM-dd');
    if (desde && fStr < desde) { return; }
    if (hasta && fStr > hasta) { return; }
    var item = filaAMovimiento_(f, i + 2);
    if (item) { out.push(item); }
  });

  out.sort(function (a, b) { return b.orden - a.orden; });
  return out;
}

/**
 * Devuelve la lista de meses que tienen movimientos (texto 'yyyy-MM'),
 * del más reciente al más antiguo. Alimenta el desplegable de "Meses".
 */
function getMesesDisponibles() {
  var hoja = getHojaRegistro_();
  var ultima = hoja.getLastRow();
  if (ultima < 2) {
    return [];
  }
  var col = hoja.getRange(2, 2, ultima - 1, 1).getValues(); // columna "Mes"
  var vistos = {};
  col.forEach(function (r) {
    var v = r[0];
    if (v) { vistos[String(v)] = true; }
  });
  var arr = Object.keys(vistos);
  arr.sort();
  arr.reverse();
  return arr;
}

/**
 * Devuelve los movimientos de un mes ('yyyy-MM'), del más reciente al más
 * antiguo. Lo usa la solapa "Meses" para el archivo histórico.
 */
function getDetalleMes(mes) {
  var hoja = getHojaRegistro_();
  var ultima = hoja.getLastRow();
  var out = [];
  if (ultima < 2) {
    return out;
  }
  mes = String(mes || '');
  var valores = hoja.getRange(2, 1, ultima - 1, ENCABEZADOS.length).getValues();
  valores.forEach(function (f, i) {
    if (String(f[1]) !== mes) { return; }   // columna "Mes"
    var item = filaAMovimiento_(f, i + 2);
    if (item) { out.push(item); }
  });
  out.sort(function (a, b) { return b.orden - a.orden; });
  return out;
}

/**
 * Elimina el movimiento de una fila. Para no borrar el equivocado, valida que
 * la fecha de esa fila coincida con el "sello" (timestamp) del movimiento que
 * se está viendo. Si la lista cambió, tira un error en vez de borrar a ciegas.
 */
function eliminarMovimiento(fila, sello) {
  fila = Number(fila) || 0;
  sello = Number(sello) || 0;
  var hoja = getHojaRegistro_();
  var ultima = hoja.getLastRow();
  if (ultima < 2) {
    throw new Error('No hay movimientos.');
  }

  // 1) Intenta en la fila indicada (tolerando pequeñas diferencias de milisegundos).
  if (fila >= 2 && fila <= ultima) {
    var fecha = hoja.getRange(fila, 1).getValue();
    if (fecha instanceof Date && (!sello || Math.abs(fecha.getTime() - sello) <= 2000)) {
      hoja.deleteRow(fila);
      return getResumen();
    }
  }
  // 2) Si la fila se movió, busca el movimiento por su fecha/hora (el sello).
  if (sello) {
    var fechas = hoja.getRange(2, 1, ultima - 1, 1).getValues();
    for (var i = 0; i < fechas.length; i++) {
      var d = fechas[i][0];
      if (d instanceof Date && Math.abs(d.getTime() - sello) <= 2000) {
        hoja.deleteRow(i + 2);
        return getResumen();
      }
    }
  }
  throw new Error('No se encontró el movimiento. Recargá el detalle e intentá de nuevo.');
}

/**
 * Elimina el último movimiento cargado ("Deshacer último").
 */
function eliminarUltimo() {
  var hoja = getHojaRegistro_();
  var ultima = hoja.getLastRow();
  if (ultima < 2) {
    throw new Error('No hay movimientos para deshacer.');
  }
  var fecha = hoja.getRange(ultima, 1).getValue();
  if (!(fecha instanceof Date)) {
    throw new Error('No hay un movimiento para deshacer.');
  }
  hoja.deleteRow(ultima);
  return getResumen();
}

/* ══════════════════ CLIENTES ══════════════════ */

var HOJA_CLIENTES = 'Clientes';
var ENCABEZADOS_CLI = ['Fecha alta', 'Nombre', 'Teléfono', 'Mail', 'Intereses', 'Observaciones'];

/** Devuelve la pestaña "Clientes", creándola con encabezados la primera vez. */
function getHojaClientes_() {
  var ss = getPlanilla_();
  var hoja = ss.getSheetByName(HOJA_CLIENTES);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_CLIENTES);
  }
  var primera = hoja.getRange(1, 1, 1, ENCABEZADOS_CLI.length).getValues()[0];
  var vacia = primera.every(function (c) { return c === '' || c === null; });
  if (vacia) {
    hoja.getRange(1, 1, 1, ENCABEZADOS_CLI.length)
      .setValues([ENCABEZADOS_CLI])
      .setFontWeight('bold').setBackground('#2b2b2b').setFontColor('#ffffff');
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm');
    hoja.setColumnWidth(2, 200);   // Nombre
    hoja.setColumnWidth(5, 320);   // Intereses
    hoja.setColumnWidth(6, 320);   // Observaciones
  }
  return hoja;
}

/** Lista de clientes, ordenada por nombre. */
function getClientes() {
  var hoja = getHojaClientes_();
  var ultima = hoja.getLastRow();
  var out = [];
  if (ultima < 2) {
    return out;
  }
  var valores = hoja.getRange(2, 1, ultima - 1, ENCABEZADOS_CLI.length).getValues();
  valores.forEach(function (f, i) {
    var nombre = (f[1] || '').toString().trim();
    if (!nombre) { return; }
    var fa = f[0];
    out.push({
      fila: i + 2,
      sello: (fa instanceof Date) ? fa.getTime() : 0,
      alta: (fa instanceof Date) ? Utilities.formatDate(fa, TZ, 'dd/MM/yyyy') : '',
      nombre: nombre,
      telefono: (f[2] || '').toString(),
      mail: (f[3] || '').toString(),
      intereses: (f[4] || '').toString(),
      observaciones: (f[5] || '').toString()
    });
  });
  out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  return out;
}

/**
 * Alta o edición de un cliente. Si datos.fila >= 2 edita esa ficha (validando
 * el sello); si no, crea una nueva con fecha de alta automática.
 */
function guardarCliente(datos) {
  datos = datos || {};
  var nombre = (datos.nombre || '').toString().trim();
  if (!nombre) {
    throw new Error('El nombre es obligatorio.');
  }
  var hoja = getHojaClientes_();
  var fila = Number(datos.fila) || 0;
  var fila5 = [nombre, datos.telefono || '', datos.mail || '', datos.intereses || '', datos.observaciones || ''];

  if (fila >= 2) {
    if (fila > hoja.getLastRow()) {
      throw new Error('La ficha ya no existe. Recargá la lista.');
    }
    var fa = hoja.getRange(fila, 1).getValue();
    if (datos.sello && (!(fa instanceof Date) || Math.abs(fa.getTime() - Number(datos.sello)) > 2000)) {
      throw new Error('La ficha cambió. Recargá la lista e intentá de nuevo.');
    }
    hoja.getRange(fila, 2, 1, 5).setValues([fila5]);   // conserva la fecha de alta
  } else {
    hoja.appendRow([new Date()].concat(fila5));
  }
  return getClientes();
}

/** Elimina una ficha de cliente (valida el sello antes de borrar). */
function eliminarCliente(fila, sello) {
  fila = Number(fila) || 0;
  sello = Number(sello) || 0;
  var hoja = getHojaClientes_();
  var ultima = hoja.getLastRow();
  if (ultima < 2) {
    throw new Error('No hay fichas.');
  }

  // 1) Intenta en la fila indicada.
  if (fila >= 2 && fila <= ultima) {
    var fa = hoja.getRange(fila, 1).getValue();
    if (!sello || (fa instanceof Date && Math.abs(fa.getTime() - sello) <= 2000)) {
      hoja.deleteRow(fila);
      return getClientes();
    }
  }
  // 2) Si la lista se movió, busca la ficha por su fecha de alta (el sello).
  if (sello) {
    var fechas = hoja.getRange(2, 1, ultima - 1, 1).getValues();
    for (var i = 0; i < fechas.length; i++) {
      var d = fechas[i][0];
      if (d instanceof Date && Math.abs(d.getTime() - sello) <= 2000) {
        hoja.deleteRow(i + 2);
        return getClientes();
      }
    }
  }
  throw new Error('No se encontró la ficha. Recargá la lista.');
}
