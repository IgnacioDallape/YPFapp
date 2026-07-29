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
;globalThis.__T = { esc, fmtLitros, litrosTotal, litrosPagadosOf, litrosPendientes, estadoPago, computeViajes, computeOilStatus, OIL_ALERT_KM };`;
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
