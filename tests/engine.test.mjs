// RemitosApp — tests del motor (lógica pura de js/app.js)
// =====================================================================
// Corre con:  node tests/engine.test.mjs
// Sin dependencias: carga js/app.js en un contexto vm con stubs mínimos
// (supabase, document, localStorage, etc.) y testea las funciones puras.
// =====================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..', 'js', 'app.js');

// ── Stubs del entorno browser ─────────────────────────────────────────
const noop = () => {};
const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  appendChild: noop, addEventListener: noop, removeEventListener: noop,
  querySelector: () => null, querySelectorAll: () => [], remove: noop, focus: noop,
  innerHTML: '', textContent: '', value: '',
});
const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.console = console;
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;
sandbox.setInterval = () => 0;
sandbox.requestAnimationFrame = noop;
sandbox.URL = URL;
sandbox.addEventListener = noop;
sandbox.removeEventListener = noop;
sandbox.localStorage = {
  _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
};
sandbox.crypto = { randomUUID: () => 'test-uuid' };
sandbox.navigator = { serviceWorker: { addEventListener: noop, register: async () => ({}) } };
sandbox.document = {
  addEventListener: noop, getElementById: () => null,
  createElement: () => fakeEl(), querySelector: () => null, querySelectorAll: () => [],
  body: { appendChild: noop }, scripts: [],
};
sandbox.supabase = {
  createClient: () => ({
    auth: { getSession: async () => ({ data: {} }) },
    from: () => ({}), storage: { from: () => ({}) },
  }),
};

// ── Cargar app.js y exportar las funciones puras ──────────────────────
const src = readFileSync(APP, 'utf8');
const exportLine = `
;globalThis.__T = { esc, fmtLitros, litrosTotal, litrosPagadosOf, litrosPendientes, estadoPago, computeViajes, computeOilStatus, computeMergeGroups, computeDashboard, computeChains, OIL_ALERT_KM, guardarUnidad, guardarAceiteBase, __sb: (typeof sb !== 'undefined' ? sb : null) };`;
vm.createContext(sandbox);
vm.runInContext(src + exportLine, sandbox, { filename: 'app.js' });
const T = sandbox.__T;

// ── Mini runner ───────────────────────────────────────────────────────
let passed = 0, failed = 0;
const fails = [];
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; fails.push(`${name}\n     got: ${a}\n     exp: ${e}`); }
};
const ok = (name, cond) => { if (cond) passed++; else { failed++; fails.push(name); } };

// ── 0) Carga ──────────────────────────────────────────────────────────
['esc','fmtLitros','litrosTotal','litrosPagadosOf','litrosPendientes','estadoPago','computeViajes']
  .forEach(fn => ok(`load: ${fn} es función`, typeof T[fn] === 'function'));

// ── 1) esc ────────────────────────────────────────────────────────────
eq('esc &', T.esc('a&b'), 'a&amp;b');
eq('esc <>', T.esc('<x>'), '&lt;x&gt;');
eq('esc "', T.esc('a"b'), 'a&quot;b');
eq("esc '", T.esc("a'b"), 'a&#39;b');
eq('esc combinado', T.esc('<b o="\'">&'), '&lt;b o=&quot;&#39;&quot;&gt;&amp;');
eq('esc null', T.esc(null), '');
eq('esc undefined', T.esc(undefined), '');
eq('esc number', T.esc(123), '123');
eq('esc normal', T.esc('Hugo'), 'Hugo');

// ── 2) fmtLitros ──────────────────────────────────────────────────────
eq('fmtLitros entero', String(T.fmtLitros(100)), '100');
eq('fmtLitros decimal', String(T.fmtLitros(100.5)), '100.5');
eq('fmtLitros 724.24', String(T.fmtLitros(724.24)), '724.2');
eq('fmtLitros 0', String(T.fmtLitros(0)), '0');
eq('fmtLitros string', String(T.fmtLitros('50.5')), '50.5');
eq('fmtLitros NaN→0', String(T.fmtLitros('abc')), '0');
eq('fmtLitros null→0', String(T.fmtLitros(null)), '0');

// ── 3) litros helpers ─────────────────────────────────────────────────
eq('litrosTotal 100', T.litrosTotal({ litros: 100 }), 100);
eq('litrosTotal string', T.litrosTotal({ litros: '50.5' }), 50.5);
eq('litrosTotal null→0', T.litrosTotal({ litros: null }), 0);
eq('litrosTotal neg→0', T.litrosTotal({ litros: -5 }), 0);
eq('litrosTotal vacío→0', T.litrosTotal({}), 0);

eq('litrosPagadosOf 30', T.litrosPagadosOf({ litros_pagados: 30 }), 30);
eq('litrosPagadosOf vacío→0', T.litrosPagadosOf({}), 0);
eq('litrosPagadosOf neg→0', T.litrosPagadosOf({ litros_pagados: -1 }), 0);

eq('litrosPendientes 70', T.litrosPendientes({ litros: 100, litros_pagados: 30 }), 70);
eq('litrosPendientes pagado→0', T.litrosPendientes({ litros: 100, litros_pagados: 30, pagado: true }), 0);
eq('litrosPendientes sobrepago→0', T.litrosPendientes({ litros: 100, litros_pagados: 150 }), 0);
eq('litrosPendientes sin pago', T.litrosPendientes({ litros: 100 }), 100);
eq('litrosPendientes litros 0', T.litrosPendientes({ litros: 0 }), 0);

// ── 4) estadoPago ─────────────────────────────────────────────────────
eq('estado pendiente', T.estadoPago({ litros: 100, litros_pagados: 0 }), 'pendiente');
eq('estado pagado por flag', T.estadoPago({ litros: 100, litros_pagados: 0, pagado: true }), 'pagado');
eq('estado parcial', T.estadoPago({ litros: 100, litros_pagados: 50 }), 'parcial');
eq('estado parcial mínimo', T.estadoPago({ litros: 100, litros_pagados: 0.5 }), 'parcial');
eq('estado pagado exacto', T.estadoPago({ litros: 100, litros_pagados: 100 }), 'pagado');
eq('estado pagado sobrepago', T.estadoPago({ litros: 100, litros_pagados: 120 }), 'pagado');
eq('estado litros 0 → pendiente', T.estadoPago({ litros: 0, litros_pagados: 0 }), 'pendiente');
eq('estado litros 0 + flag → pagado', T.estadoPago({ litros: 0, litros_pagados: 0, pagado: true }), 'pagado');

// ── 5) computeViajes ──────────────────────────────────────────────────
eq('viajes vacío', T.computeViajes([]), []);
eq('viajes null', T.computeViajes(null), []);
eq('viajes un solo remito', T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
]), []);

const v2 = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 80, choferes: { nombre: 'A' } },
]);
ok('viajes par: 1 viaje', v2.length === 1);
ok('viajes par: km=400', v2[0].km === 400);
ok('viajes par: litros=80', v2[0].litros === 80);
ok('viajes par: l100=20', v2[0].l100 === 20);
ok('viajes par: chofer=A', v2[0].chofer === 'A');
ok('viajes par: fechaDesde', v2[0].fechaDesde === '2026-01-01');
ok('viajes par: fechaHasta', v2[0].fechaHasta === '2026-01-05');

eq('viajes km iguales (dist 0) → []', T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1000, litros: 80, choferes: { nombre: 'A' } },
]), []);

eq('viajes litros nuevo 0 → []', T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 0, choferes: { nombre: 'A' } },
]), []);

eq('viajes choferes distintos → []', T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'b', fecha_carga: '2026-01-05', km: 1400, litros: 80, choferes: { nombre: 'B' } },
]), []);

const v3 = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 80, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-09', km: 1800, litros: 60, choferes: { nombre: 'A' } },
]);
ok('viajes 3 cargas → 2 viajes', v3.length === 2);
ok('viajes orden desc por fechaHasta', v3[0].fechaHasta === '2026-01-09' && v3[1].fechaHasta === '2026-01-05');
ok('viajes l100 del más nuevo (60/400*100=15)', v3[0].l100 === 15);
ok('viajes l100 del previo (80/400*100=20)', v3[1].l100 === 20);

eq('viajes km null se ignora', T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: null, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 80, choferes: { nombre: 'A' } },
]), []);

// ── 6) Edge cases extra (de la auditoría de cobertura) ────────────────
// esc en datos crudos (XSS de comentarios/N° remito ya escapados en el render)
eq('esc rompe-textarea', T.esc('</textarea><img onerror=x>'), '&lt;/textarea&gt;&lt;img onerror=x&gt;');

// estadoPago edge
eq('estado litros 0 + pagados>0 → parcial', T.estadoPago({ litros: 0, litros_pagados: 50 }), 'parcial');
eq('estado litros negativo se clampa → pendiente', T.estadoPago({ litros: -5, litros_pagados: 0 }), 'pendiente');

// litrosPendientes con pagados negativo
eq('litrosPendientes pagados negativo → total', T.litrosPendientes({ litros: 100, litros_pagados: -30 }), 100);

// fmtLitros signos y bordes
eq('fmtLitros negativo decimal', String(T.fmtLitros(-100.5)), '-100.5');
eq('fmtLitros negativo entero', String(T.fmtLitros(-100)), '-100');
eq('fmtLitros 0.05 (acarreo toFixed)', String(T.fmtLitros(0.05)), '0.1');
eq('fmtLitros string con sufijo', String(T.fmtLitros('50.5L')), '50.5');

// litrosTotal edge
eq('litrosTotal undefined → 0', T.litrosTotal({ litros: undefined }), 0);
eq('litrosTotal string con sufijo', T.litrosTotal({ litros: '100L' }), 100);

// computeViajes: km:0 es válido (no se filtra)
const vKm0 = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 0, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 400, litros: 80, choferes: { nombre: 'A' } },
]);
ok('viajes km:0 válido → 1 viaje de 400', vKm0.length === 1 && vKm0[0].km === 400);

// computeViajes: fallback de nombre 'Desconocido'
const vDesc = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50 },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 80 },
]);
ok('viajes sin choferes.nombre → Desconocido', vDesc.length === 1 && vDesc[0].chofer === 'Desconocido');

// computeViajes: dos choferes con pares → intercalados por fechaHasta desc
const vMulti = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-10', km: 1400, litros: 80, choferes: { nombre: 'A' } },
  { chofer_id: 'b', fecha_carga: '2026-01-05', km: 2000, litros: 40, choferes: { nombre: 'B' } },
  { chofer_id: 'b', fecha_carga: '2026-01-15', km: 2300, litros: 60, choferes: { nombre: 'B' } },
]);
ok('viajes 2 choferes → 2 viajes', vMulti.length === 2);
ok('viajes 2 choferes orden desc (B 01-15 primero)', vMulti[0].chofer === 'B' && vMulti[1].chofer === 'A');

// computeViajes: litros string se coacciona a número (fix parseFloat)
const vStr = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: '80', choferes: { nombre: 'A' } },
]);
ok('viajes litros string → número (no concatena)', vStr[0].litros === 80 && typeof vStr[0].litros === 'number');
ok('viajes litros string → l100 numérico', vStr[0].l100 === 20);

// ── 7) computeOilStatus (cambio de aceite) ───────────────────────────
ok('OIL_ALERT_KM = 29000', T.OIL_ALERT_KM === 29000);

// Base en km 1000; distintos remitos del chofer 'a'
const oilR = [
  { id: 1, chofer_id: 'a', km: 500 },     // antes del cambio → sin base
  { id: 2, chofer_id: 'a', km: 1000 },    // en el cambio → 0
  { id: 3, chofer_id: 'a', km: 30000 },   // 29.000 desde el cambio → due
  { id: 4, chofer_id: 'b', km: 5000 },    // otro chofer sin cambio → null
];
T.computeOilStatus(oilR, [{ chofer_id: 'a', km: 1000 }]);
eq('aceite: antes del cambio → null', oilR[0]._oilKmDesde, null);
eq('aceite: en el cambio → 0', oilR[1]._oilKmDesde, 0);
eq('aceite: 29.000 km después → due', oilR[2]._oilKmDesde, 29000);
ok('aceite: due supera el umbral', oilR[2]._oilKmDesde >= T.OIL_ALERT_KM);
eq('aceite: otro chofer sin cambio → null', oilR[3]._oilKmDesde, null);

// Dos cambios: cuenta desde el más reciente (<= km del remito)
const oilR2 = [{ id: 1, chofer_id: 'a', km: 41000 }];
T.computeOilStatus(oilR2, [{ chofer_id: 'a', km: 1000 }, { chofer_id: 'a', km: 40000 }]);
eq('aceite: cuenta desde el cambio más reciente', oilR2[0]._oilKmDesde, 1000);

// km null → null, sin romper
const oilR3 = [{ id: 1, chofer_id: 'a', km: null }];
T.computeOilStatus(oilR3, [{ chofer_id: 'a', km: 1000 }]);
eq('aceite: km null → null', oilR3[0]._oilKmDesde, null);

// Base de aceite MANUAL por chofer (cambio de camión): se ancla a la última
// carga y suma de ahí en adelante; no toca el historial viejo.
const baseMap = { a: { aceite_base: 12197, aceite_base_km: 22519, aceite_base_fecha: '2026-10-26' } };
const oilBase = [
  { id: 1, chofer_id: 'a', km: 22519, fecha_carga: '2026-10-26' },  // carga ancla → 12197
  { id: 2, chofer_id: 'a', km: 25000, fecha_carga: '2026-10-28' },  // +2481 → 14678
  { id: 3, chofer_id: 'a', km: 500000, fecha_carga: '2026-09-01' }, // anterior a la base → null
];
T.computeOilStatus(oilBase, [], baseMap);
eq('aceite base: carga ancla = valor seteado', oilBase[0]._oilKmDesde, 12197);
eq('aceite base: suma los km nuevos', oilBase[1]._oilKmDesde, 14678);
eq('aceite base: no toca el historial viejo', oilBase[2]._oilKmDesde, null);

// Un cambio de aceite REAL posterior (km mayor) pisa la base manual.
const oilBase2 = [{ id: 2, chofer_id: 'a', km: 25000, fecha_carga: '2026-10-28' }];
T.computeOilStatus(oilBase2, [{ chofer_id: 'a', km: 24000 }], baseMap);
eq('aceite base: cambio real posterior resetea', oilBase2[0]._oilKmDesde, 1000);

// Sin base manual (choferesBase ausente) → lógica de siempre, sin regresión.
const oilNoBase = [{ id: 1, chofer_id: 'a', km: 1000 }, { id: 2, chofer_id: 'a', km: 30000 }];
T.computeOilStatus(oilNoBase, [{ chofer_id: 'a', km: 1000 }]);
eq('aceite sin base: cuenta desde el cambio real', oilNoBase[1]._oilKmDesde, 29000);

// Cambio de camión: punto de aceite de OTRO camión → contador absurdo → null (no falso aviso).
const oilOtroCamion = [{ id: 1, chofer_id: 'a', km: 1220376, fecha_carga: '2026-10-31' }];
T.computeOilStatus(oilOtroCamion, [{ chofer_id: 'a', km: 20076 }]);  // punto del camión viejo
eq('aceite: contador absurdo (cambio de camión) → null', oilOtroCamion[0]._oilKmDesde, null);

// computeViajes: salto gigante entre dos cargas (cambio de camión) → no es un viaje.
const vCambioCamion = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-10-26', km: 22519,   litros: 623, choferes: { nombre: 'Rolando' } }, // camión viejo
  { chofer_id: 'a', fecha_carga: '2026-10-31', km: 1220376, litros: 633, choferes: { nombre: 'Rolando' } }, // camión nuevo
]);
eq('viajes: salto de camión (1.197.857 km) descartado → []', vCambioCamion, []);
// Pero dentro del camión nuevo sí calcula normal
const vNuevoCamion = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-10-31', km: 1220376, litros: 633, choferes: { nombre: 'Rolando' } },
  { chofer_id: 'a', fecha_carga: '2026-11-02', km: 1220776, litros: 140, choferes: { nombre: 'Rolando' } }, // 400 km normal
]);
ok('viajes: dentro del camión nuevo calcula normal (140/400*100=35)', vNuevoCamion.length === 1 && vNuevoCamion[0].km === 400 && vNuevoCamion[0].l100 === 35);

// ── 10) Formaciones: el km sigue al CAMIÓN cuando los choferes rotan ──────
// Caso real: el camión de ~1,2M km lo manejaba Fabian (hasta 28/10) y pasó a Rolando
// (desde 31/10). Rolando antes estaba en otro camión (22.519).
const formacion = () => ([
  { id: 'f1', chofer_id: 'F', fecha_carga: '2026-10-25', km: 1217894, litros: 280, choferes: { nombre: 'Fabian' } },
  { id: 'f2', chofer_id: 'F', fecha_carga: '2026-10-28', km: 1218556, litros: 300, choferes: { nombre: 'Fabian' } },
  { id: 'r1', chofer_id: 'R', fecha_carga: '2026-10-26', km: 22519,   litros: 623, choferes: { nombre: 'Rolando' } },
  { id: 'r2', chofer_id: 'R', fecha_carga: '2026-10-31', km: 1220376, litros: 633, choferes: { nombre: 'Rolando' } },
]);
const fRem = formacion();
T.computeChains(fRem);
ok('formación: r2 queda en el mismo camión que Fabian', fRem[3]._chain === fRem[0]._chain);
ok('formación: r1 (camión viejo de Rolando) es otro camión', fRem[2]._chain !== fRem[3]._chain);
const vForm = T.computeViajes(formacion());
const vRol = vForm.find(v => v.chofer_id === 'R');
ok('formación: hay viaje de Rolando en el camión nuevo', !!vRol);
ok('formación: arranca de la última carga de Fabian (1.218.556 → 1.220.376 = 1.820 km)', vRol && vRol.km === 1820);
ok('formación: litros de Rolando (633) y L/100km ≈ 34,8', vRol && vRol.litros === 633 && Math.abs(vRol.l100 - 633 / 1820 * 100) < 1e-9);
ok('formación: viaje sabe que venía de Fabian', vRol && vRol.prevChoferId === 'F' && vRol.prevChofer === 'Fabian' && vRol.prevTopId === 'f2' && vRol.baseId === 'r2');
ok('formación: no hay viaje fantasma 22.519 → 1.220.376', !vForm.some(v => v.km > 50000));
ok('formación: Fabian conserva su viaje 25/10 → 28/10 (662 km)', vForm.some(v => v.chofer_id === 'F' && v.km === 662));

// Aceite sigue al camión: el cambio marcado por Fabian vale para Rolando en ese camión.
const fOil = formacion();
fOil[0].cambio_aceite = true;   // Fabian cambió el aceite a los 1.217.894
T.computeOilStatus(fOil, null, {});
eq('aceite por camión: Rolando cuenta desde el cambio de Fabian (2.482)', fOil[3]._oilKmDesde, 1220376 - 1217894);
eq('aceite por camión: el camión viejo de Rolando no hereda ese cambio', fOil[2]._oilKmDesde, null);

// Odómetro cargado por error en el campo viejo de "km desde" (1.200.300) → se
// interpreta como odómetro del cambio → 20.076 km desde el cambio.
const fLeg = formacion();
T.computeOilStatus(fLeg, null, { R: { aceite_base: 1200300, aceite_base_km: 1220376, aceite_base_fecha: '2026-10-31' } });
eq('aceite: odómetro mal cargado como "km desde" se reinterpreta (20.076)', fLeg[3]._oilKmDesde, 20076);

// Guarda de concurrencia: un camión que sigue en uso no se "presta" a otro chofer.
const vConc = T.computeViajes([
  { id: 'a1', chofer_id: 'A', fecha_carga: '2026-01-01', km: 100000, litros: 100, choferes: { nombre: 'A' } },
  { id: 'a2', chofer_id: 'A', fecha_carga: '2026-01-10', km: 101000, litros: 100, choferes: { nombre: 'A' } },
  { id: 'b1', chofer_id: 'B', fecha_carga: '2026-01-01', km: 20000,  litros: 100, choferes: { nombre: 'B' } },
  { id: 'b2', chofer_id: 'B', fecha_carga: '2026-01-05', km: 100500, litros: 100, choferes: { nombre: 'B' } }, // salto, pero A sigue en su camión
]);
ok('concurrencia: no se enlaza a un camión que seguía en uso', !vConc.some(v => v.chofer_id === 'B'));
ok('concurrencia: A conserva su viaje normal (1.000 km)', vConc.some(v => v.chofer_id === 'A' && v.km === 1000));

// ── 8) Efectivo (fuera de cuenta corriente) ──────────────────────────
// No debe litros en la cuenta corriente → 0 (queda fuera de la deuda).
eq('efectivo: litrosPendientes → 0', T.litrosPendientes({ litros: 100, litros_pagados: 0, efectivo: true }), 0);
eq('no-efectivo: litrosPendientes normal', T.litrosPendientes({ litros: 100, litros_pagados: 30, efectivo: false }), 70);
// Pero SÍ cuenta en el consumo (computeViajes no filtra por efectivo).
const vEfectivo = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 50, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 80, efectivo: true, choferes: { nombre: 'A' } },
]);
ok('efectivo: el consumo lo sigue tomando', vEfectivo.length === 1 && vEfectivo[0].l100 === 20);

// ── 9) Unir cargas (tanque no lleno) en computeViajes ────────────────
// La carga marcada unir_anterior fusiona sus litros con la anterior sobre el
// tramo combinado → un solo viaje con litros sumados y la distancia total.
const vUnir = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 100, choferes: { nombre: 'A' } }, // llenó
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 50,  choferes: { nombre: 'A' } }, // parcial
  { chofer_id: 'a', fecha_carga: '2026-01-09', km: 2000, litros: 80, unir_anterior: true, choferes: { nombre: 'A' } },
]);
ok('unir: 1 viaje combinado (no 2)', vUnir.length === 1);
ok('unir: km combinado = 1000 (1000→2000)', vUnir[0].km === 1000);
ok('unir: litros combinados = 130 (50+80)', vUnir[0].litros === 130);
ok('unir: l100 = 13 (130/1000)', vUnir[0].l100 === 13);
ok('unir: fechaDesde de la base y fechaHasta del más nuevo',
   vUnir[0].fechaDesde === '2026-01-01' && vUnir[0].fechaHasta === '2026-01-09');

// unir_anterior en la PRIMERA carga (sin anterior) → se trata normal, no rompe.
const vUnir0 = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 100, unir_anterior: true, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 80,  choferes: { nombre: 'A' } },
]);
ok('unir sin carga anterior → viaje normal', vUnir0.length === 1 && vUnir0[0].km === 400 && vUnir0[0].litros === 80);

// Encadenado: dos unir_anterior seguidas suman todo en un tramo.
const vChain = T.computeViajes([
  { chofer_id: 'a', fecha_carga: '2026-01-01', km: 1000, litros: 100, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-05', km: 1400, litros: 50,  choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-09', km: 1800, litros: 40, unir_anterior: true, choferes: { nombre: 'A' } },
  { chofer_id: 'a', fecha_carga: '2026-01-13', km: 2000, litros: 30, unir_anterior: true, choferes: { nombre: 'A' } },
]);
ok('unir encadenado: 1 viaje km 1000 litros 120 (50+40+30)',
   vChain.length === 1 && vChain[0].km === 1000 && vChain[0].litros === 120);

// ── 10) computeMergeGroups (marcar los remitos unidos) ───────────────
// Marca _inMerge en TODOS los que forman una unión (base + los unir_anterior).
const mg = [
  { id: 1, chofer_id: 'a', km: 1000, litros: 100 },                       // base
  { id: 2, chofer_id: 'a', km: 1400, litros: 50, unir_anterior: true },   // unido
  { id: 3, chofer_id: 'a', km: 2000, litros: 80 },                        // suelto
  { id: 4, chofer_id: 'b', km: 500,  litros: 60, unir_anterior: true },   // unir sin anterior (solo)
];
T.computeMergeGroups(mg);
eq('merge: base marcada', mg[0]._inMerge, true);
eq('merge: unido marcado', mg[1]._inMerge, true);
eq('merge: suelto NO marcado', mg[2]._inMerge, false);
eq('merge: unir sin anterior (grupo de 1) NO marcado', mg[3]._inMerge, false);

// Cadena de 3 (base + 2 unidos): las tres marcadas.
const mg3 = [
  { id: 1, chofer_id: 'a', km: 1000, litros: 100 },
  { id: 2, chofer_id: 'a', km: 1400, litros: 50, unir_anterior: true },
  { id: 3, chofer_id: 'a', km: 1800, litros: 40, unir_anterior: true },
];
T.computeMergeGroups(mg3);
ok('merge encadenado: las 3 marcadas', mg3.every(r => r._inMerge === true));

// La BASE lleva los agregados del grupo (para el consumo combinado del separador).
// Caso real: base 04/09 (km 1045286, 300L) + unido 15/09 (km 1046286, 725L).
const mgAgg = [
  { id: 1, chofer_id: 'a', km: 1045286, litros: 300, fecha_carga: '2026-09-04' },
  { id: 2, chofer_id: 'a', km: 1046286, litros: 725, fecha_carga: '2026-09-15', unir_anterior: true },
];
T.computeMergeGroups(mgAgg);
eq('agg: base tiene km del tope', mgAgg[0]._groupTopKm, 1046286);
eq('agg: base tiene litros combinados (300+725=1025)', mgAgg[0]._groupLitros, 1025);
eq('agg: base tiene fecha del tope', mgAgg[0]._groupTopFecha, '2026-09-15');
// El consumo real del tramo 31/08(km 1043401) → grupo: 1025 / (1046286-1043401=2885) * 100 = 35.5
ok('agg: consumo combinado ≈ 35.5', +(1025 / (1046286 - 1043401) * 100).toFixed(1) === 35.5);
eq('agg: el unido NO lleva agregados', mgAgg[1]._groupTopKm, null);

// ── 11) computeDashboard ──────────────────────────────────────────────
ok('dashboard: función', typeof T.computeDashboard === 'function');

// Vacío
const dEmpty = T.computeDashboard([]);
eq('dashboard vacío: sin choferes', dEmpty.choferes, []);
eq('dashboard vacío: sin deuda vieja', dEmpty.masViejo, null);
eq('dashboard null: sin choferes', T.computeDashboard(null).choferes, []);

// Un chofer, dos cargas en meses distintos + un viaje
const dash1 = T.computeDashboard([
  { chofer_id: 'a', fecha_carga: '2026-08-10', km: 1000, litros: 50, choferes: { nombre: 'Ana' } },
  { chofer_id: 'a', fecha_carga: '2026-09-05', km: 1400, litros: 80, choferes: { nombre: 'Ana' } },
]);
ok('dash1: 1 chofer', dash1.choferes.length === 1);
ok('dash1: nombre', dash1.choferes[0].nombre === 'Ana');
ok('dash1: total litros 130', dash1.choferes[0].totalLitros === 130);
ok('dash1: total km del viaje 400', dash1.choferes[0].totalKm === 400);
ok('dash1: promedio 80/400*100=20', dash1.choferes[0].promedioL100 === 20);
ok('dash1: 2 meses', dash1.choferes[0].meses.length === 2);
ok('dash1: mes reciente primero (2026-09)', dash1.choferes[0].meses[0].mes === '2026-09');
ok('dash1: litros sep=80', dash1.choferes[0].meses[0].litros === 80);
ok('dash1: litros ago=50', dash1.choferes[0].meses[1].litros === 50);
ok('dash1: maxMesLitros=80', dash1.choferes[0].maxMesLitros === 80);
ok('dash1: sin deuda (todo sin pagar pero contamos pendientes)', dash1.masViejo !== null);

// Una sola carga → sin viaje → promedio null
const dashNoTrip = T.computeDashboard([
  { chofer_id: 'a', fecha_carga: '2026-09-05', km: 1400, litros: 80, choferes: { nombre: 'Ana' } },
]);
eq('dashboard 1 carga: promedio null', dashNoTrip.choferes[0].promedioL100, null);

// Litros del mismo mes se suman
const dashSameMonth = T.computeDashboard([
  { chofer_id: 'a', fecha_carga: '2026-09-02', km: 1000, litros: 30, choferes: { nombre: 'Ana' } },
  { chofer_id: 'a', fecha_carga: '2026-09-20', km: 1500, litros: 40, choferes: { nombre: 'Ana' } },
]);
ok('dashboard mismo mes: 1 mes', dashSameMonth.choferes[0].meses.length === 1);
ok('dashboard mismo mes: litros 70', dashSameMonth.choferes[0].meses[0].litros === 70);

// masViejo: elige el pendiente más antiguo; ignora pagados y efectivo.
// Input DESORDENADO a propósito (el más viejo va último) para exigir la comparación real.
const dashDeuda = T.computeDashboard([
  { chofer_id: 'a', fecha_carga: '2026-08-01', km: 400, litros: 50, choferes: { nombre: 'Ana' } },                    // pendiente más nuevo (primero en la lista)
  { chofer_id: 'a', fecha_carga: '2026-05-01', km: 100, litros: 50, pagado: true, choferes: { nombre: 'Ana' } },      // pagado → no cuenta (aunque sea el más viejo)
  { chofer_id: 'b', fecha_carga: '2026-06-01', km: 200, litros: 50, efectivo: true, choferes: { nombre: 'Beto' } },   // efectivo → no cuenta
  { chofer_id: 'b', fecha_carga: '2026-07-01', km: 300, litros: 50, numero: 'R-7', choferes: { nombre: 'Beto' } },    // pendiente más viejo (último en la lista)
]);
ok('dashboard deuda: elige el pendiente más viejo (2026-07-01)', dashDeuda.masViejo.fecha === '2026-07-01');
ok('dashboard deuda: número correcto', dashDeuda.masViejo.numero === 'R-7');
ok('dashboard deuda: chofer correcto (Beto)', dashDeuda.masViejo.chofer === 'Beto');

// Sin pendientes (todo pagado/efectivo) → masViejo null
const dashSinDeuda = T.computeDashboard([
  { chofer_id: 'a', fecha_carga: '2026-05-01', km: 100, litros: 50, pagado: true, choferes: { nombre: 'Ana' } },
  { chofer_id: 'a', fecha_carga: '2026-06-01', km: 200, litros: 50, efectivo: true, choferes: { nombre: 'Ana' } },
]);
eq('dashboard sin pendientes: masViejo null', dashSinDeuda.masViejo, null);

// Parcial cuenta como pendiente
const dashParcial = T.computeDashboard([
  { chofer_id: 'a', fecha_carga: '2026-07-01', km: 300, litros: 50, litros_pagados: 20, choferes: { nombre: 'Ana' } },
]);
ok('dashboard parcial: cuenta como pendiente', dashParcial.masViejo && dashParcial.masViejo.fecha === '2026-07-01');

// Dos choferes ordenados por nombre
const dashDos = T.computeDashboard([
  { chofer_id: 'b', fecha_carga: '2026-09-01', km: 100, litros: 20, choferes: { nombre: 'Zoe' } },
  { chofer_id: 'a', fecha_carga: '2026-09-01', km: 100, litros: 20, choferes: { nombre: 'Ana' } },
]);
ok('dashboard 2 choferes: orden alfabético (Ana antes de Zoe)', dashDos.choferes[0].nombre === 'Ana' && dashDos.choferes[1].nombre === 'Zoe');

// Totales de flota + pendientesCount + rango de meses
const dashFleet = T.computeDashboard([
  { chofer_id: 'a', fecha_carga: '2026-07-02', km: 1000, litros: 100, choferes: { nombre: 'Ana' } },  // viaje base
  { chofer_id: 'a', fecha_carga: '2026-08-04', km: 1400, litros: 80,  choferes: { nombre: 'Ana' } },  // viaje: 80/400*100=20
  { chofer_id: 'b', fecha_carga: '2026-09-06', km: 5000, litros: 50, pagado: true, choferes: { nombre: 'Beto' } }, // pagado
  { chofer_id: 'b', fecha_carga: '2026-09-10', km: 5300, litros: 30, choferes: { nombre: 'Beto' } }, // pendiente, viaje 30/300*100=10
]);
ok('fleet: total litros = 100+80+50+30 = 260', dashFleet.fleet.totalLitros === 260);
ok('fleet: total km = 400 (Ana) + 300 (Beto) = 700', dashFleet.fleet.totalKm === 700);
ok('fleet: promedio = (80+30)/700*100 ≈ 15.71', Math.abs(dashFleet.fleet.promedioL100 - (110 / 700 * 100)) < 1e-9);
ok('fleet: pendientesCount = 3 (Ana 07 y 08, Beto 10; NO el pagado)', dashFleet.pendientesCount === 3);
ok('fleet: rango meses from 2026-07', dashFleet.monthRange.from === '2026-07');
ok('fleet: rango meses to 2026-09', dashFleet.monthRange.to === '2026-09');

// Sin datos → fleet en cero y sin rango
const dashFleet0 = T.computeDashboard([]);
ok('fleet vacío: totalLitros 0', dashFleet0.fleet.totalLitros === 0);
ok('fleet vacío: promedio null', dashFleet0.fleet.promedioL100 === null);
ok('fleet vacío: pendientesCount 0', dashFleet0.pendientesCount === 0);
eq('fleet vacío: monthRange null', dashFleet0.monthRange, null);

// ── 11) Odómetro del cambio mayor al actual → se rechaza (no se guarda 0 en silencio) ──
// Caso real: unidad nl10 (Mauricio, camión en 26.209 km) y cargaron 1.041.759.
{
  const writes = [];
  const fakeFrom = () => ({
    update(p) { writes.push(p); return { eq: async () => ({ error: null }) }; },
    insert(p) { writes.push(p); return Promise.resolve({ error: null }); },
    select() { const q = { eq: () => q, order: () => q, limit: async () => ({ data: [{ km: 26209, fecha_carga: '2026-11-10' }] }) }; return q; },
  });
  ok('test: hay cliente supabase stub para interceptar', !!T.__sb);
  const realFrom = T.__sb && T.__sb.from;
  if (T.__sb) T.__sb.from = fakeFrom;
  const latest = { M: { km: 26209, fecha: '2026-11-10' } };
  const nl10 = { id: 'u3', numero: 'nl10', chofer_id: 'M', aceite_base: 12197, aceite_base_km: 83040, aceite_base_fecha: '2026-10-29' };
  const r1 = await T.guardarUnidad('u3', { numero: 'nl10', chofer_id: 'M' }, 1041759, nl10, latest);
  eq('unidad: odómetro del cambio > actual → "mayor"', r1, 'mayor');
  ok('unidad: con "mayor" NO escribe nada en la base', writes.length === 0);
  const r2 = await T.guardarUnidad('u3', { numero: 'nl10', chofer_id: 'M' }, 10322, nl10, latest);
  ok('unidad: odómetro válido guarda', r2 === true && writes.length === 1);
  ok('unidad: guarda km desde el cambio = 26.209 − 10.322 = 15.887', writes[0] && writes[0].aceite_base === 15887 && writes[0].aceite_base_km === 26209);
  const r3 = await T.guardarUnidad('u3', { numero: 'nl10', chofer_id: 'M' }, 26209, nl10, latest);
  ok('unidad: odómetro igual al actual es válido (0 km)', r3 === true && writes[1] && writes[1].aceite_base === 0);
  writes.length = 0;
  const r4 = await T.guardarAceiteBase('M', 1041759);
  ok('chofer: odómetro del cambio > actual → {mayor} sin escribir', r4 && r4.mayor === 26209 && writes.length === 0);
  const r5 = await T.guardarAceiteBase('M', 10322);
  ok('chofer: odómetro válido guarda 15.887', r5 === true && writes[0] && writes[0].aceite_base === 15887);
  if (T.__sb) T.__sb.from = realFrom;
}

// ── Resumen ───────────────────────────────────────────────────────────
console.log(`\nRemitosApp · tests del motor`);
console.log(`  ${passed} passed, ${failed} failed  (${passed + failed} total)\n`);
if (failed) {
  console.log('FALLAS:');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
} else {
  console.log('✓ Todo verde');
  process.exit(0);
}
