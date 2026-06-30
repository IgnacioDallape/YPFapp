// RemitosApp — js/app.js
// =====================================================
// VERSIÓN — bumpear en cada deploy (también bumpear CACHE en sw.js)
// =====================================================
const APP_VERSION = 'v30 · 2026-06-30';

// =====================================================
// CONFIG — reemplazar con tus credenciales de Supabase
// =====================================================
const SUPABASE_URL      = 'https://eqenqgrqvjithlayrezv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZW5xZ3JxdmppdGhsYXlyZXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDE2NTUsImV4cCI6MjA5MjQ3NzY1NX0.wkx8mAF0YndymIAfHfroncI0C8ql2rp8UweUPL1evg4';
const ADMIN_PASSWORD   = 'ypf2024'; // cambiar por contraseña segura

const SUPABASE_CONFIGURED = !SUPABASE_URL.includes('tu-proyecto');
const sb = SUPABASE_CONFIGURED
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// =====================================================
// STATE
// =====================================================
const S = {
  get deviceId() {
    let id = localStorage.getItem('ypf_device_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ypf_device_id', id); }
    return id;
  },
  choferId:  localStorage.getItem('ypf_chofer_id'),
  nombre:    localStorage.getItem('ypf_nombre'),
  isAdmin:   localStorage.getItem('ypf_is_admin') === 'true',
  adminTab:  'pendientes',
  filtroChofer: '',
  filtroMes:    '',
  fotosStaged:  [],
  fotoKm:       null,
  lightboxUrls: [],
  lightboxIdx:  0,
  precioLitro:  0,
};

// =====================================================
// UTILS
// =====================================================
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const fmt = d => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })
  : '';

const $ = id => document.getElementById(id);
const app = () => document.getElementById('app');

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, 3200);
}

function setLoading(msg = 'Cargando...') {
  app().innerHTML = `<div class="loading-screen"><div class="spinner"></div><p>${msg}</p></div>`;
}

// Formatea litros: sin decimales si es entero, con 1 decimal si no.
const fmtLitros = n => { n = parseFloat(n) || 0; return n % 1 === 0 ? n : n.toFixed(1); };

// Escapa texto para interpolar de forma segura en HTML (contenido y atributos).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// =====================================================
// ESTADO DE PAGO (derivado de litros) — pago parcial
// =====================================================
function litrosTotal(r)     { return Math.max(0, parseFloat(r.litros) || 0); }
function litrosPagadosOf(r) { return Math.max(0, parseFloat(r.litros_pagados) || 0); }

// Litros que todavía se deben de un remito.
function litrosPendientes(r) {
  if (r.pagado) return 0;
  return Math.max(0, litrosTotal(r) - litrosPagadosOf(r));
}

// 'pendiente' | 'parcial' | 'pagado'
function estadoPago(r) {
  const tot = litrosTotal(r), pag = litrosPagadosOf(r);
  if (r.pagado || (tot > 0 && pag >= tot)) return 'pagado';
  if (pag > 0) return 'parcial';
  return 'pendiente';
}

// =====================================================
// INIT
// =====================================================
async function init() {
  if (!SUPABASE_CONFIGURED) { renderWelcome(); return; }

  if (S.isAdmin) { renderAdmin(); return; }

  // Sesión cacheada de chofer: revalidar el id contra la DB por si cambió
  // en el backend (evita errores de foreign key al enviar remitos).
  if (S.choferId && S.nombre) {
    try {
      let { data } = await sb.from('choferes').select('*').ilike('nombre', S.nombre).maybeSingle();
      if (!data) {
        ({ data } = await sb.from('choferes').select('*').eq('device_id', S.deviceId).maybeSingle());
      }
      if (data) {
        guardarSesionChofer(data); // refresca id/nombre/is_admin si cambiaron
        if (data.is_admin) { renderAdmin(); return; }
      }
    } catch (e) { /* sin conexión: seguir con la sesión cacheada */ }
    renderChofer();
    return;
  }

  setLoading();
  try {
    const { data } = await sb.from('choferes').select('*').eq('device_id', S.deviceId).maybeSingle();
    if (data) {
      S.choferId = data.id;
      S.nombre   = data.nombre;
      S.isAdmin  = data.is_admin;
      localStorage.setItem('ypf_chofer_id', data.id);
      localStorage.setItem('ypf_nombre',    data.nombre);
      localStorage.setItem('ypf_is_admin',  data.is_admin);
      if (S.isAdmin) renderAdmin(); else renderChofer();
    } else {
      renderWelcome();
    }
  } catch (e) {
    renderWelcome();
  }
}

// =====================================================
// WELCOME
// =====================================================
function renderWelcome() {
  app().innerHTML = `
    <div class="screen screen-welcome">
      <div class="welcome-logo">🚛</div>
      <h1 class="welcome-title">RemitosApp</h1>
      <p class="welcome-sub">Gestión de cargas y remitos</p>
      ${!SUPABASE_CONFIGURED ? `
      <div class="config-banner">
        ⚠️ Configurá las credenciales de Supabase en <code>js/app.js</code> para activar la app
      </div>` : ''}
      <div class="card welcome-card">
        <div class="field">
          <label class="field-label">Tu nombre</label>
          <input type="text" id="inp-nombre" class="inp" placeholder="Ej: Mauricio" maxlength="60" autocomplete="off">
        </div>
        <div class="field">
          <label class="field-label">PIN (4 dígitos)</label>
          <input type="password" id="inp-pin" class="inp inp-pin"
            placeholder="• • • •" maxlength="4" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
        </div>
        <button id="btn-continuar" class="btn btn-primary btn-full" disabled>Entrar →</button>
        <div class="divider"></div>
        <button id="btn-admin-toggle" class="link-btn">Soy administrador</button>
        <div id="admin-form" class="hidden mt">
          <div class="field">
            <label class="field-label">Contraseña de administrador</label>
            <input type="password" id="inp-admin-pass" class="inp" placeholder="••••••••">
          </div>
          <button id="btn-admin-login" class="btn btn-secondary btn-full mt-sm">Entrar como admin</button>
        </div>
      </div>
      <div id="install-wrap-welcome"></div>
      <div class="version-tag">${APP_VERSION}</div>
    </div>
  `;

  // Botón de instalación PWA
  $('install-wrap-welcome').appendChild(makeInstallBtn('btn-install-welcome'));

  const inpNombre = $('inp-nombre');
  const inpPin    = $('inp-pin');
  const btnOk     = $('btn-continuar');

  const checkReady = () => {
    btnOk.disabled = inpNombre.value.trim().length < 2 || inpPin.value.length !== 4;
  };

  inpNombre.addEventListener('input', checkReady);
  inpPin.addEventListener('input', () => {
    inpPin.value = inpPin.value.replace(/\D/g, '').slice(0, 4);
    checkReady();
  });

  const submit = () => {
    if (btnOk.disabled) return;
    handleLogin(inpNombre.value.trim(), inpPin.value);
  };

  inpNombre.addEventListener('keydown', e => { if (e.key === 'Enter') inpPin.focus(); });
  inpPin.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  btnOk.addEventListener('click', submit);

  $('btn-admin-toggle').addEventListener('click', () => $('admin-form').classList.toggle('hidden'));
  $('btn-admin-login').addEventListener('click', () => {
    if ($('inp-admin-pass').value === ADMIN_PASSWORD) {
      adminLoginSuccess(inpNombre.value.trim() || 'Admin');
    } else {
      toast('Contraseña incorrecta', 'err');
    }
  });
}

async function handleLogin(nombre, pin) {
  if (!SUPABASE_CONFIGURED) { toast('Configurá Supabase primero', 'err'); return; }
  setLoading('Verificando...');
  try {
    // Busca por nombre e PIN juntos — si no coinciden ambos, no entra
    const { data, error } = await sb.from('choferes')
      .select('*')
      .ilike('nombre', nombre)
      .eq('pin', pin)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      toast('Usuario o PIN incorrecto', 'err');
      renderWelcome();
      return;
    }

    await sb.from('choferes').update({ device_id: S.deviceId }).eq('id', data.id);
    guardarSesionChofer(data);
    toast(`Bienvenido, ${data.nombre}!`);
    if (data.is_admin) renderAdmin(); else renderChofer();
  } catch(e) {
    toast('Error de conexión. Intentá de nuevo.', 'err');
    renderWelcome();
  }
}

function guardarSesionChofer(chofer) {
  S.choferId = chofer.id;
  S.nombre   = chofer.nombre;
  S.isAdmin  = chofer.is_admin;
  localStorage.setItem('ypf_chofer_id', chofer.id);
  localStorage.setItem('ypf_nombre',    chofer.nombre);
  localStorage.setItem('ypf_is_admin',  String(chofer.is_admin));
}

async function adminLoginSuccess(nombre) {
  if (!SUPABASE_CONFIGURED) {
    toast('Configurá las credenciales de Supabase en js/app.js primero', 'err');
    return;
  }
  setLoading('Accediendo...');

  let { data } = await sb.from('choferes').select('*').eq('device_id', S.deviceId).maybeSingle();

  if (!data) {
    // No device match — check if an admin record already exists to avoid duplicates
    const { data: existingAdmin } = await sb
      .from('choferes').select('*').eq('is_admin', true).limit(1).maybeSingle();
    if (existingAdmin) {
      // Re-link existing admin to this device
      await sb.from('choferes').update({ device_id: S.deviceId }).eq('id', existingAdmin.id);
      data = { ...existingAdmin, device_id: S.deviceId };
    } else {
      // No admin exists yet — create one
      const res = await sb
        .from('choferes')
        .insert({ nombre, device_id: S.deviceId, is_admin: true })
        .select().single();
      data = res.data;
    }
  } else if (!data.is_admin) {
    await sb.from('choferes').update({ is_admin: true }).eq('id', data.id);
    data.is_admin = true;
  }

  if (data) {
    S.choferId = data.id;
    S.nombre   = data.nombre;
    S.isAdmin  = true;
    localStorage.setItem('ypf_chofer_id', data.id);
    localStorage.setItem('ypf_nombre',    data.nombre);
    localStorage.setItem('ypf_is_admin',  'true');
  }

  renderAdmin();
}

// =====================================================
// CHOFER
// =====================================================
// Formulario de carga de remito. Reutilizado por el chofer y por el admin.
// adminMode=true agrega un selector de chofer (para que el admin cargue por otro).
function remitoFormHTML(adminMode, choferes) {
  const choferField = adminMode ? `
          <div class="field">
            <label class="field-label">Chofer *</label>
            <select id="f-chofer" class="inp">
              <option value="">Elegí un chofer...</option>
              ${(choferes || []).map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}
            </select>
          </div>` : '';
  return `
        <div class="card form-card">
          <h2 class="section-title">${adminMode ? 'Cargar remito por un chofer' : 'Cargar nuevo remito'}</h2>
          ${choferField}
          <div class="form-row-2">
            <div class="field">
              <label class="field-label">Fecha de carga *</label>
              <input type="date" id="f-fecha" class="inp" value="${today()}">
            </div>
            <div class="field">
              <label class="field-label">Litros cargados *</label>
              <input type="number" id="f-litros" class="inp" placeholder="0.0" step="0.1" min="0">
            </div>
          </div>

          <div class="field">
            <label class="field-label">N° de remito *</label>
            <input type="text" id="f-numero" class="inp" placeholder="Ej: 0001-00012345" maxlength="40" autocomplete="off">
          </div>

          <div class="field">
            <label class="field-label">Kilómetros del camión *</label>
            <input type="number" id="f-km" class="inp" placeholder="Ej: 245789" step="1" min="0">
          </div>

          <div class="field">
            <label class="field-label">
              Foto del kilómetro &nbsp;<span class="req-badge">obligatoria *</span>
            </label>
            <div class="foto-actions foto-actions-single">
              <label class="foto-btn foto-btn-cam">
                <input type="file" id="f-foto-km" accept="image/*" capture="environment" class="hidden">
                📷 Sacar foto del km
              </label>
            </div>
            <div id="foto-km-preview" class="foto-previews"></div>
          </div>

          <div class="field">
            <label class="field-label">Destino ida * <span style="font-size:0.75em;font-weight:400;opacity:0.7">(del último viaje)</span></label>
            <input type="text" id="f-destino-ida" class="inp" placeholder="¿A dónde fue en el último viaje?">
          </div>

          <div class="field">
            <label class="field-label">Destino vuelta * <span style="font-size:0.75em;font-weight:400;opacity:0.7">(del último viaje)</span></label>
            <input type="text" id="f-destino-vuelta" class="inp" placeholder="¿De dónde regresó en el último viaje?">
          </div>

          <div class="field">
            <label class="field-label">Comentarios</label>
            <textarea id="f-comentarios" class="inp inp-ta" rows="3"
              placeholder="Ej: Rotura de cubierta, espera en destino, observaciones... (opcional)"></textarea>
          </div>

          <div class="field">
            <label class="field-label">
              Fotos del remito &nbsp;<span class="req-badge">mínimo 1 requerida *</span>
            </label>
            <div class="foto-actions foto-actions-single">
              <label class="foto-btn foto-btn-cam">
                <input type="file" id="f-fotos-cam" accept="image/*" capture="environment" class="hidden">
                📷 Sacar foto
              </label>
            </div>
            <div id="foto-previews" class="foto-previews"></div>
          </div>

          <button id="btn-enviar" class="btn btn-primary btn-full btn-lg" disabled>
            📤 Enviar remito
          </button>
        </div>`;
}

function renderChofer() {
  S.fotosStaged = [];
  S.fotoKm = null;
  app().innerHTML = `
    <div class="screen screen-chofer">
      <header class="app-header">
        <span class="header-name">Hola, ${esc(S.nombre)} 👋 <span class="version-inline">${APP_VERSION}</span></span>
        <div class="header-actions">
          <div id="install-wrap-chofer"></div>
          <button id="btn-logout" class="btn-logout" title="Cerrar sesión">↩ Salir</button>
        </div>
      </header>
      <main class="chofer-main">

        ${remitoFormHTML(false)}

        <div class="card" id="mis-remitos-card">
          <h2 class="section-title">Mis últimos remitos</h2>
          <div id="mis-remitos-list"><div class="loading-inline">Cargando...</div></div>
        </div>

      </main>
    </div>
  `;

  bindChoferForm();
  loadMisRemitos();
  $('btn-logout').addEventListener('click', logout);
  $('install-wrap-chofer').appendChild(makeInstallBtn('btn-install-header'));
}

function bindChoferForm() {
  const btnEnviar = $('btn-enviar');
  let _prevObjUrls = []; // track active object URLs so we can revoke them on re-render
  let _kmObjUrl = null;  // single object URL for the km photo preview

  const checkValid = () => {
    const fecha  = $('f-fecha').value;
    const numero = $('f-numero').value.trim();
    const litros = parseFloat($('f-litros').value);
    const km     = parseFloat($('f-km').value);
    const ida    = $('f-destino-ida').value.trim();
    const vuelta = $('f-destino-vuelta').value.trim();
    // En modo admin (si existe el selector) hay que tener un chofer elegido.
    const choferOk = !$('f-chofer') || !!$('f-chofer').value;
    btnEnviar.disabled = !(fecha && numero && litros > 0 && km > 0 && ida && vuelta && S.fotoKm && S.fotosStaged.length > 0 && choferOk);
  };

  $('f-chofer')?.addEventListener('change', checkValid);
  $('f-fecha').addEventListener('change', checkValid);
  $('f-numero').addEventListener('input', checkValid);
  $('f-litros').addEventListener('input', checkValid);
  $('f-km').addEventListener('input', checkValid);
  $('f-destino-ida').addEventListener('input', checkValid);
  $('f-destino-vuelta').addEventListener('input', checkValid);

  const addFotos = input => {
    S.fotosStaged = [...S.fotosStaged, ...Array.from(input.files)];
    input.value = '';
    renderFotoPreviews();
    checkValid();
  };
  $('f-fotos-cam').addEventListener('change', function() { addFotos(this); });

  const setFotoKm = input => {
    const f = input.files[0];
    if (f) S.fotoKm = f;
    input.value = '';
    renderFotoKmPreview();
    checkValid();
  };
  $('f-foto-km').addEventListener('change', function() { setFotoKm(this); });

  function renderFotoKmPreview() {
    if (_kmObjUrl) URL.revokeObjectURL(_kmObjUrl);
    _kmObjUrl = S.fotoKm ? URL.createObjectURL(S.fotoKm) : null;
    const prev = $('foto-km-preview');
    if (!S.fotoKm) { prev.innerHTML = ''; return; }
    prev.innerHTML = `
      <div class="foto-preview-item">
        <img src="${_kmObjUrl}" alt="km preview">
        <button class="foto-remove" id="foto-km-remove">✕</button>
      </div>
    `;
    $('foto-km-remove').addEventListener('click', () => {
      S.fotoKm = null;
      renderFotoKmPreview();
      checkValid();
    });
  }

  function renderFotoPreviews() {
    // Revoke previous object URLs to free memory (important on mobile)
    _prevObjUrls.forEach(u => URL.revokeObjectURL(u));
    _prevObjUrls = S.fotosStaged.map(f => URL.createObjectURL(f));

    const prev = $('foto-previews');
    prev.innerHTML = _prevObjUrls.map((url, i) => `
      <div class="foto-preview-item">
        <img src="${url}" alt="preview">
        <button class="foto-remove" data-idx="${i}">✕</button>
      </div>
    `).join('');
    prev.querySelectorAll('.foto-remove').forEach(b => {
      b.addEventListener('click', () => {
        S.fotosStaged.splice(+b.dataset.idx, 1);
        renderFotoPreviews();
        checkValid();
      });
    });
  }

  btnEnviar.addEventListener('click', submitRemito);
}

function compressImage(file, maxPx = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else        { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      try {
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob null')), 'image/jpeg', 0.82);
      } catch(e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')); };
    img.src = url;
  });
}

async function uploadFoto(file, path) {
  // Intentar comprimir; si falla, usar archivo original
  let blob;
  let contentType = 'image/jpeg';
  try {
    blob = await compressImage(file);
  } catch(e) {
    console.warn('Compresión falló, usando archivo original:', e.message);
    blob = file;
    contentType = file.type || 'image/jpeg';
  }

  const { error } = await sb.storage.from('remitos-fotos').upload(path, blob, {
    upsert: true,
    contentType,
  });

  if (error) throw error;

  const { data: urlData } = sb.storage.from('remitos-fotos').getPublicUrl(path);
  return urlData.publicUrl;
}

async function submitRemito() {
  const btn = $('btn-enviar');
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  const fecha          = $('f-fecha').value;
  const numero         = $('f-numero').value.trim();
  const destinoIda     = $('f-destino-ida').value.trim();
  const destinoVuelta  = $('f-destino-vuelta').value.trim();
  const litros         = parseFloat($('f-litros').value);
  const km             = parseInt($('f-km').value, 10);
  const comentarios    = $('f-comentarios').value.trim() || null;

  // Modo admin: si existe el selector de chofer, el remito se carga por ese chofer.
  // NO se cae a S.choferId (eso atribuiría el remito al admin si el select quedó vacío).
  const choferSel      = $('f-chofer');
  const isAdminUpload  = !!choferSel;
  const targetChoferId = isAdminUpload ? choferSel.value : S.choferId;

  // Doble validación por si el botón se habilitó indebidamente
  if (!fecha || !numero || !destinoIda || !destinoVuelta || !(litros > 0) || !(km > 0) || !S.fotoKm || !targetChoferId) {
    toast('Completá todos los campos antes de enviar', 'err');
    $('btn-enviar').disabled = false;
    $('btn-enviar').textContent = '📤 Enviar remito';
    return;
  }

  // 1. Insertar remito (sin foto_km_url aún — se completa luego)
  const remitoData = { chofer_id: targetChoferId, fecha_carga: fecha, numero, destino_ida: destinoIda,
                       destino_vuelta: destinoVuelta, litros, km, comentarios };
  let { data: remito, error: rErr } = await sb
    .from('remitos').insert(remitoData).select().single();

  // Auto-reparación: si el chofer_id cacheado quedó viejo (FK 23503),
  // re-buscar el chofer por nombre, refrescar el id y reintentar una vez.
  // (Solo en modo chofer; en modo admin el chofer_id viene de la DB.)
  if (rErr && rErr.code === '23503' && !isAdminUpload) {
    try {
      const { data: ch } = await sb.from('choferes').select('*').ilike('nombre', S.nombre).maybeSingle();
      if (ch && ch.id !== S.choferId) {
        guardarSesionChofer(ch);
        remitoData.chofer_id = ch.id;
        ({ data: remito, error: rErr } = await sb
          .from('remitos').insert(remitoData).select().single());
      }
    } catch (e) { /* dejar que caiga al manejo de error de abajo */ }
  }

  if (rErr) {
    console.error('Remito insert error:', rErr);
    toast('No se pudo enviar el remito. Cerrá sesión y volvé a entrar.', 'err');
    btn.disabled = false;
    btn.textContent = '📤 Enviar remito';
    return;
  }

  // 2. Subir foto del km y guardar URL en el remito
  btn.textContent = `⏳ Subiendo foto del km...`;
  let fotoKmFallo = null;
  try {
    const ext  = (S.fotoKm.type === 'image/png') ? 'png' : 'jpg';
    const path = `${targetChoferId}/${remito.id}/km_${Date.now()}.${ext}`;
    const kmUrl = await uploadFoto(S.fotoKm, path);
    await sb.from('remitos').update({ foto_km_url: kmUrl }).eq('id', remito.id);
  } catch (e) {
    console.error('Error foto km:', e);
    fotoKmFallo = e.message;
  }

  // 3. Subir fotos del remito a Supabase Storage
  const fallidos = [];
  let subidas = 0;
  for (let i = 0; i < S.fotosStaged.length; i++) {
    const file = S.fotosStaged[i];
    btn.textContent = `⏳ Subiendo foto ${i + 1}/${S.fotosStaged.length}...`;
    try {
      const ext  = (file.type === 'image/png') ? 'png' : 'jpg';
      const path = `${targetChoferId}/${remito.id}/${Date.now()}_${i}.${ext}`;
      const publicUrl = await uploadFoto(file, path);
      await sb.from('remito_fotos').insert({ remito_id: remito.id, storage_url: publicUrl });
      subidas++;
    } catch (e) {
      console.error(`Error foto ${i + 1}:`, e);
      fallidos.push(e.message || file.name);
    }
  }

  if (fotoKmFallo) fallidos.push(`foto km: ${fotoKmFallo}`);

  if (fallidos.length === S.fotosStaged.length && S.fotosStaged.length > 0) {
    // Todas fallaron — el remito YA fue guardado en la base de datos, solo faltan las fotos
    toast(`Remito guardado sin fotos. Error: ${fallidos[0]}`, 'warn');
  } else if (fallidos.length > 0) {
    toast(`Remito enviado. ${fallidos.length} foto(s) fallaron`, 'warn');
  } else {
    toast('Remito enviado correctamente ✓');
  }

  if (isAdminUpload) renderAdmin(); else renderChofer();
}

async function loadMisRemitos() {
  const el = $('mis-remitos-list');
  if (!el) return;

  const { data, error } = await sb
    .from('remitos')
    .select('*, remito_fotos(id)')
    .eq('chofer_id', S.choferId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!el) return;

  if (error) {
    el.innerHTML = `<p class="empty-msg">Error al cargar remitos. Verificá tu conexión.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    el.innerHTML = `<p class="empty-msg">Todavía no cargaste ningún remito</p>`;
    return;
  }

  el.innerHTML = data.map(r => `
    <div class="mini-remito">
      <div class="mini-remito-top">
        <span class="mini-fecha">${fmt(r.fecha_carga)}</span>
      </div>
      <div class="mini-destino">
        ${r.destino_ida}${r.destino_vuelta ? ` → ${r.destino_vuelta}` : ''}
      </div>
      <div class="mini-meta">
        ${r.litros ? `<span class="mini-litros">⛽ ${r.litros}L</span>` : ''}
        ${r.remito_fotos?.length ? `<span class="mini-fotos">📷 ${r.remito_fotos.length} foto${r.remito_fotos.length !== 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function logout() {
  showConfirm('¿Cerrar sesión?', 'Vas a volver a la pantalla de inicio.', 'Salir', () => {
    ['ypf_chofer_id','ypf_nombre','ypf_is_admin','ypf_device_id'].forEach(k => localStorage.removeItem(k));
    S.choferId = null; S.nombre = null; S.isAdmin = false;
    renderWelcome();
  });
}

function showPrecioEditor() {
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">Precio por litro</div>
      <div class="confirm-sub">Se usa para calcular la deuda de combustible.</div>
      <div class="field">
        <label class="field-label">Pesos por litro</label>
        <input type="number" id="precio-input" class="inp" value="${S.precioLitro || ''}"
               step="0.01" min="0" placeholder="Ej: 1450.50" autocomplete="off">
      </div>
      <div class="confirm-btns" style="margin-top:14px">
        <button class="btn btn-ghost" id="precio-cancel">Cancelar</button>
        <button class="btn btn-primary" id="precio-ok">Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.querySelector('#precio-cancel').addEventListener('click', close);
  el.querySelector('#precio-ok').addEventListener('click', async () => {
    const v = el.querySelector('#precio-input').value;
    await savePrecioLitro(v);
    toast('Precio actualizado ✓');
    close();
    loadAdminContent();
  });
  el.addEventListener('click', e => { if (e.target === el) close(); });
  setTimeout(() => el.querySelector('#precio-input').focus(), 100);
}

function showConfirm(titulo, subtitulo, btnLabel, onConfirm) {
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">${titulo}</div>
      ${subtitulo ? `<div class="confirm-sub">${subtitulo}</div>` : ''}
      <div class="confirm-btns">
        <button class="btn btn-ghost" id="conf-cancel">Cancelar</button>
        <button class="btn btn-primary" id="conf-ok">${btnLabel}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.querySelector('#conf-cancel').addEventListener('click', close);
  el.querySelector('#conf-ok').addEventListener('click', () => { close(); onConfirm(); });
  el.addEventListener('click', e => { if (e.target === el) close(); });
}

// =====================================================
// ADMIN
// =====================================================
async function renderAdmin() {
  app().innerHTML = `
    <div class="screen screen-admin">
      <header class="app-header">
        <span class="header-name">Panel Admin <span class="version-inline">${APP_VERSION}</span></span>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="admin-badge">ADMIN</span>
          <button id="btn-logout-admin" class="btn-logout" title="Cerrar sesión">↩ Salir</button>
        </div>
      </header>
      <div class="tab-bar">
        <button class="tab-btn ${S.adminTab === 'pendientes' ? 'active' : ''}" data-tab="pendientes">
          Pendientes
        </button>
        <button class="tab-btn ${S.adminTab === 'todos' ? 'active' : ''}" data-tab="todos">
          Todos
        </button>
        <button class="tab-btn ${S.adminTab === 'historial' ? 'active' : ''}" data-tab="historial">
          Historial
        </button>
      </div>
      <main class="admin-main" id="admin-main">
        <div class="loading-inline">Cargando...</div>
      </main>
    </div>
    <div id="lightbox" class="lightbox hidden">
      <div class="lb-backdrop" id="lb-backdrop"></div>
      <button class="lb-close" id="lb-close">✕</button>
      <button class="lb-nav lb-prev" id="lb-prev">‹</button>
      <img id="lb-img" src="" alt="remito">
      <button class="lb-nav lb-next" id="lb-next">›</button>
    </div>
  `;

  $('btn-logout-admin').addEventListener('click', logout);

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.tab === S.adminTab) return;
      S.adminTab     = b.dataset.tab;
      S.filtroChofer = '';
      S.filtroMes    = '';
      document.querySelectorAll('.tab-btn').forEach(x =>
        x.classList.toggle('active', x.dataset.tab === S.adminTab)
      );
      loadAdminContent();
    });
  });

  bindLightbox();
  await loadPrecioLitro();
  await loadAdminContent();
}

async function loadPrecioLitro() {
  const { data } = await sb.from('config').select('value').eq('key', 'precio_litro').maybeSingle();
  S.precioLitro = parseFloat(data?.value) || 0;
}

async function savePrecioLitro(v) {
  const val = String(parseFloat(v) || 0);
  await sb.from('config').upsert({ key: 'precio_litro', value: val });
  S.precioLitro = parseFloat(val);
}

async function loadAdminContent() {
  const main = $('admin-main');
  if (!main) return;
  main.innerHTML = `<div class="loading-inline">Cargando...</div>`;

  // El Historial tiene su propio flujo (calcula viajes sobre todo el histórico).
  if (S.adminTab === 'historial') return loadHistorial(main);

  let query = sb
    .from('remitos')
    .select('*, choferes(nombre), remito_fotos(storage_url)')
    .order('fecha_carga', { ascending: false })
    .order('created_at', { ascending: false });

  // Pendientes ahora muestra todo lo NO archivado (pendientes + parciales +
  // pagados-no-archivados). Los pagados solo se van con "Archivar pagados".
  if (S.adminTab === 'pendientes') query = query.eq('archivado', false);
  if (S.filtroChofer)              query = query.eq('chofer_id', S.filtroChofer);
  if (S.filtroMes) {
    const [y, m] = S.filtroMes.split('-');
    const from = `${y}-${m}-01`;
    const to   = new Date(+y, +m, 0).toISOString().slice(0, 10);
    query = query.gte('fecha_carga', from).lte('fecha_carga', to);
  }

  const [{ data: remitosRaw, error: rErr }, { data: choferes }] = await Promise.all([
    query,
    sb.from('choferes').select('id, nombre').eq('is_admin', false).order('nombre'),
  ]);

  if (rErr) {
    main.innerHTML = `<p class="empty-msg">Error al cargar remitos. Verificá tu conexión.</p>`;
    return;
  }

  // En "Todos" separamos activos de archivados: los archivados van en una
  // sección colapsable al final (NO se pierden, siguen en el Historial).
  const all        = remitosRaw || [];
  const activos    = S.adminTab === 'todos' ? all.filter(r => !r.archivado) : all;
  const archivados = S.adminTab === 'todos' ? all.filter(r =>  r.archivado) : [];

  // Cache para el editor (incluye activos y archivados)
  _remitosCache = {};
  all.forEach(r => { _remitosCache[r.id] = r; });

  let html = '';

  // Herramientas del admin (tab "todos"): subir remito por un chofer + gestión de choferes.
  if (S.adminTab === 'todos') {
    html += `
      <div class="admin-tools-row">
        <button id="btn-subir-remito" class="btn btn-primary btn-sm">➕ Subir remito</button>
        <button id="btn-usuarios" class="btn btn-secondary btn-sm">👤 Choferes</button>
      </div>
    `;
  }

  // Deuda de combustible (tab "pendientes") — resta lo ya pagado (parcial).
  if (S.adminTab === 'pendientes') {
    const totalLitros = activos.reduce((a, r) => a + litrosPendientes(r), 0);
    const deuda = totalLitros * S.precioLitro;
    const fmtARS = n => '$ ' + Math.round(n).toLocaleString('es-AR');
    html += `
      <div class="deuda-card">
        <div class="deuda-head">
          <span class="deuda-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            DEUDA DE COMBUSTIBLE
          </span>
          <button id="btn-edit-precio" class="deuda-edit-btn">✏ Precio</button>
        </div>
        <div class="deuda-amount">${fmtARS(deuda)}</div>
        <div class="deuda-detail">
          <b>${fmtLitros(totalLitros)}</b> L pendientes &times; <b>${fmtARS(S.precioLitro)}</b>/L
        </div>
      </div>
    `;
  }

  // Stats (solo en tab "todos")
  if (S.adminTab === 'todos') {
    const mesKey  = today().slice(0, 7);
    const rMes    = activos.filter(r => r.fecha_carga?.startsWith(mesKey));
    const litros  = rMes.reduce((a, r) => a + (r.litros || 0), 0);
    const pend    = activos.filter(r => estadoPago(r) !== 'pagado').length;
    html += `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-val">${rMes.length}</div>
          <div class="stat-lbl">Remitos este mes</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${litros % 1 === 0 ? litros : litros.toFixed(1)}L</div>
          <div class="stat-lbl">Litros este mes</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${pend}</div>
          <div class="stat-lbl">Pendientes de pago</div>
        </div>
      </div>
    `;
  }

  // Filtros + acción de archivar (solo en tab "todos")
  if (S.adminTab === 'todos') {
    html += filtrosHTML(choferes);
    html += `
      <div class="admin-actions-row">
        <button id="btn-archivar-pagados" class="btn btn-ghost btn-sm">📦 Archivar pagados</button>
      </div>
    `;
  }

  // Lista de activos (con separadores de consumo entre cargas consecutivas)
  if (!activos.length) {
    html += `<p class="empty-msg">${S.adminTab === 'pendientes' ? '✓ Sin remitos pendientes' : 'No hay remitos cargados'}</p>`;
  } else {
    html += renderRemitoList(activos);
  }

  // Sección colapsable de archivados (solo en tab "todos")
  if (S.adminTab === 'todos' && archivados.length) {
    html += `
      <details class="archivados-block">
        <summary class="archivados-summary">📦 Archivados (${archivados.length})</summary>
        <div class="archivados-list">${renderRemitoList(archivados)}</div>
      </details>
    `;
  }

  main.innerHTML = html;

  // Bind filtros + acciones
  bindChoferDropdown();
  bindMesPicker();
  $('btn-limpiar')?.addEventListener('click', () => { S.filtroChofer = ''; S.filtroMes = ''; loadAdminContent(); });
  $('btn-archivar-pagados')?.addEventListener('click', archivarPagados);
  $('btn-edit-precio')?.addEventListener('click', showPrecioEditor);
  $('btn-subir-remito')?.addEventListener('click', renderAdminUploadRemito);
  $('btn-usuarios')?.addEventListener('click', showUsuariosModal);
  bindAdminListEvents(main);
}

// Markup de la card de filtros (chofer + mes). Reutilizado por Todos e Historial.
function filtrosHTML(choferes) {
  const hasFilter = S.filtroChofer || S.filtroMes;
  const selected = (choferes || []).find(c => c.id === S.filtroChofer);
  const choferLabel = selected ? selected.nombre : 'Todos los choferes';
  return `
    <div class="filtros-card">
      <div class="filtros-head">
        <span class="filtros-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
          Filtros
        </span>
        ${hasFilter ? `<button id="btn-limpiar" class="filtros-clear">✕ Limpiar</button>` : ''}
      </div>
      <div class="filtros-row">
        <div class="filtro-field">
          <label class="filtro-label">Chofer</label>
          <div class="cdd" id="cdd-chofer">
            <button type="button" class="cdd-trigger">
              <span class="cdd-text ${!selected ? 'cdd-placeholder' : ''}">${choferLabel}</span>
              <svg class="cdd-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="cdd-menu hidden">
              <button class="cdd-opt ${!S.filtroChofer ? 'is-active' : ''}" data-value="">Todos los choferes</button>
              ${(choferes || []).map(c => `
                <button class="cdd-opt ${S.filtroChofer === c.id ? 'is-active' : ''}" data-value="${c.id}">${c.nombre}</button>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="filtro-field">
          <label class="filtro-label">Mes</label>
          <div class="cdd" id="mdd-mes">
            <button type="button" class="cdd-trigger">
              <span class="cdd-text ${!S.filtroMes ? 'cdd-placeholder' : ''}">${formatMesLabel(S.filtroMes)}</span>
              <svg class="cdd-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
            <div class="cdd-menu mdd-menu hidden">
              <div class="mdd-year-nav">
                <button type="button" class="mdd-year-btn" data-dir="-1">‹</button>
                <span class="mdd-year">${S.filtroMes ? S.filtroMes.split('-')[0] : new Date().getFullYear()}</span>
                <button type="button" class="mdd-year-btn" data-dir="1">›</button>
              </div>
              <div class="mdd-months">
                ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m,i) =>
                  `<button type="button" class="mdd-month" data-m="${String(i+1).padStart(2,'0')}">${m}</button>`
                ).join('')}
              </div>
              <div class="mdd-actions">
                <button type="button" class="mdd-action mdd-clear">Limpiar</button>
                <button type="button" class="mdd-action mdd-today">Este mes</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Lista de cards con separadores de consumo entre cargas consecutivas.
function renderRemitoList(remitos) {
  const pieces = [];
  for (let i = 0; i < remitos.length; i++) {
    pieces.push(renderRemitoCard(remitos[i]));
    if (i + 1 < remitos.length) {
      // remitos[i] es MÁS NUEVO que remitos[i+1] (orden desc por fecha_carga)
      const sep = renderConsumoSeparator(remitos[i], remitos[i + 1]);
      if (sep) pieces.push(sep);
    }
  }
  return pieces.join('');
}

// Engancha los botones de cada card (pago, parcial, borrar, desarchivar, fotos, editar).
function bindAdminListEvents(main) {
  main.querySelectorAll('.btn-marcar-pagado').forEach(b =>
    b.addEventListener('click', () => marcarPagado(b.dataset.id)));
  main.querySelectorAll('.btn-marcar-pendiente').forEach(b =>
    b.addEventListener('click', () => marcarPendiente(b.dataset.id)));
  main.querySelectorAll('.btn-pago-parcial').forEach(b =>
    b.addEventListener('click', () => showPagoParcial(b.dataset.id)));
  main.querySelectorAll('.btn-completar-pago').forEach(b =>
    b.addEventListener('click', () => completarPago(b.dataset.id)));
  main.querySelectorAll('.btn-del-remito').forEach(b =>
    b.addEventListener('click', () => eliminarRemito(b.dataset.id)));
  main.querySelectorAll('.btn-desarchivar').forEach(b =>
    b.addEventListener('click', () => desarchivarRemito(b.dataset.id)));
  main.querySelectorAll('.foto-thumb').forEach(img =>
    img.addEventListener('click', () => openLightbox(JSON.parse(img.dataset.urls), +img.dataset.idx)));
  main.querySelectorAll('.btn-edit-remito').forEach(b =>
    b.addEventListener('click', () => showEditRemito(b.dataset.id)));
}

// =====================================================
// HISTORIAL — consumo L/100km por viaje (carga a carga)
// =====================================================

// Arma un "viaje" por cada par de cargas consecutivas del mismo chofer.
// distancia = km(nuevo) − km(anterior); litros = los cargados en el nuevo.
function computeViajes(remitos) {
  const byChofer = {};
  for (const r of (remitos || [])) {
    if (r.km == null) continue;
    (byChofer[r.chofer_id] = byChofer[r.chofer_id] || []).push(r);
  }
  const viajes = [];
  for (const cid in byChofer) {
    const list = byChofer[cid].slice().sort((a, b) => a.km - b.km);
    for (let i = 1; i < list.length; i++) {
      const older = list[i - 1], newer = list[i];
      const distance = newer.km - older.km;
      if (distance <= 0) continue;
      if (!newer.litros || newer.litros <= 0) continue;
      viajes.push({
        chofer:     newer.choferes?.nombre || older.choferes?.nombre || 'Desconocido',
        fechaDesde: older.fecha_carga,
        fechaHasta: newer.fecha_carga,
        km:         distance,
        litros:     newer.litros,
        l100:       (newer.litros / distance) * 100,
      });
    }
  }
  // Más recientes primero (por fecha de llegada).
  viajes.sort((a, b) => (a.fechaHasta < b.fechaHasta ? 1 : a.fechaHasta > b.fechaHasta ? -1 : 0));
  return viajes;
}

async function loadHistorial(main) {
  // Trae TODO el histórico (incluye archivados) para que el consumo no se corte
  // en los bordes de mes. El filtro de mes se aplica sobre el viaje, después.
  let q = sb.from('remitos').select('chofer_id, fecha_carga, km, litros, choferes(nombre)');
  if (S.filtroChofer) q = q.eq('chofer_id', S.filtroChofer);

  const [{ data: remitos, error }, { data: choferes }] = await Promise.all([
    q,
    sb.from('choferes').select('id, nombre').eq('is_admin', false).order('nombre'),
  ]);

  if (error) {
    main.innerHTML = `<p class="empty-msg">Error al cargar el historial. Verificá tu conexión.</p>`;
    return;
  }

  let viajes = computeViajes(remitos || []);
  if (S.filtroMes) viajes = viajes.filter(v => (v.fechaHasta || '').startsWith(S.filtroMes));

  let html = filtrosHTML(choferes);

  if (!viajes.length) {
    html += `<p class="empty-msg">No hay viajes para mostrar todavía</p>`;
  } else {
    const totKm = viajes.reduce((a, v) => a + v.km, 0);
    const totL  = viajes.reduce((a, v) => a + v.litros, 0);
    const prom  = totKm > 0 ? (totL / totKm) * 100 : 0;
    html += `
      <div class="hist-summary">
        <div class="hist-sum-cell">
          <span class="hist-sum-val">${totKm.toLocaleString('es-AR')}</span>
          <span class="hist-sum-lbl">km totales</span>
        </div>
        <div class="hist-sum-cell">
          <span class="hist-sum-val">${fmtLitros(totL)}</span>
          <span class="hist-sum-lbl">litros</span>
        </div>
        <div class="hist-sum-cell hist-sum-hl">
          <span class="hist-sum-val">${prom.toFixed(1)}</span>
          <span class="hist-sum-lbl">L/100km prom.</span>
        </div>
      </div>
    `;
    html += `<div class="hist-list">${viajes.map(renderViaje).join('')}</div>`;
  }

  main.innerHTML = html;
  bindChoferDropdown();
  bindMesPicker();
  $('btn-limpiar')?.addEventListener('click', () => { S.filtroChofer = ''; S.filtroMes = ''; loadAdminContent(); });
}

// Fila de viaje. Colapsada muestra SOLO el consumo L/100km; al desplegar
// (native <details>) aparecen km recorridos y litros.
function renderViaje(v) {
  const iconRoute = `<svg class="consumo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21L8 3"/><path d="M21 21L16 3"/><path d="M12 5v2"/><path d="M12 11v2"/><path d="M12 17v2"/></svg>`;
  const iconFuel  = `<svg class="consumo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M3 22h14"/><path d="M4 13h12"/><path d="M16 8h1a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg>`;
  const iconGauge = `<svg class="consumo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/></svg>`;
  return `
    <details class="viaje-row">
      <summary class="viaje-summary">
        <span class="viaje-chofer">${esc(v.chofer)}</span>
        <span class="viaje-l100">${v.l100.toFixed(1)}<small>L/100km</small></span>
        <span class="viaje-chev">▾</span>
      </summary>
      <div class="viaje-detail">
        <div class="consumo-header">
          <span class="consumo-pill">VIAJE</span>
          <span class="consumo-dates">${fmt(v.fechaDesde)} <span class="consumo-arrow">→</span> ${fmt(v.fechaHasta)}</span>
        </div>
        <div class="consumo-grid">
          <div class="consumo-cell">
            ${iconRoute}
            <span class="consumo-value">${v.km.toLocaleString('es-AR')}<span class="consumo-unit">km</span></span>
          </div>
          <div class="consumo-vdiv"></div>
          <div class="consumo-cell">
            ${iconFuel}
            <span class="consumo-value">${fmtLitros(v.litros)}<span class="consumo-unit">L</span></span>
          </div>
          <div class="consumo-vdiv"></div>
          <div class="consumo-cell consumo-cell-hl">
            ${iconGauge}
            <span class="consumo-value">${v.l100.toFixed(1)}<span class="consumo-unit">L/100km</span></span>
          </div>
        </div>
      </div>
    </details>
  `;
}

function renderRemitoCard(r) {
  const fotos   = r.remito_fotos || [];
  const nombre  = r.choferes?.nombre || 'Desconocido';

  // Lightbox: foto del km primero (si existe), después las demás
  const lightboxUrls = [];
  if (r.foto_km_url) lightboxUrls.push(r.foto_km_url);
  fotos.forEach(f => lightboxUrls.push(f.storage_url));
  const allUrls = JSON.stringify(lightboxUrls).replace(/"/g, '&quot;');

  // Thumbnail de la foto del km (con badge)
  const kmThumb = r.foto_km_url
    ? `<div class="foto-thumb-wrap foto-km-thumb">
         <img class="foto-thumb" src="${r.foto_km_url}" alt="km" data-urls="${allUrls}" data-idx="0">
         <span class="foto-km-badge">KM</span>
       </div>`
    : '';

  // Thumbnails de las fotos del remito (a partir del índice 1 si hay foto km)
  const offset  = r.foto_km_url ? 1 : 0;
  const thumbs  = fotos.slice(0, 4).map((f, i) =>
    `<img class="foto-thumb" src="${f.storage_url}" alt="foto"
      data-urls="${allUrls}" data-idx="${i + offset}">`
  ).join('');
  const masTag  = fotos.length > 4 ? `<div class="foto-mas">+${fotos.length - 4}</div>` : '';

  const estado = estadoPago(r);

  // Badge de estado (3 estados)
  const badge = estado === 'pagado'
    ? `<span class="status-badge paid">✓ Pagado</span>`
    : estado === 'parcial'
      ? `<span class="status-badge partial">◐ ${fmtLitros(litrosPagadosOf(r))}/${fmtLitros(litrosTotal(r))} L</span>`
      : `<span class="status-badge pending">Pendiente</span>`;

  // Botón de borrado individual: solo en la pestaña "Todos"
  const delBtn = S.adminTab === 'todos'
    ? `<button class="btn-del-remito" data-id="${r.id}" title="Eliminar remito">🗑</button>`
    : '';

  // Acciones según estado / archivado
  let acciones;
  if (r.archivado) {
    acciones = `<button class="btn btn-ghost btn-full mt-sm btn-desarchivar" data-id="${r.id}">↩ Desarchivar</button>`;
  } else if (estado === 'parcial') {
    acciones = `
      <div class="pago-parcial-info">Pagado ${fmtLitros(litrosPagadosOf(r))} de ${fmtLitros(litrosTotal(r))} L · faltan ${fmtLitros(litrosPendientes(r))} L</div>
      <div class="pago-actions mt-sm">
        <button class="btn btn-pay btn-completar-pago" data-id="${r.id}">Completar pago</button>
        <button class="btn btn-ghost btn-pago-parcial" data-id="${r.id}">Editar parcial</button>
      </div>
      <button class="btn btn-ghost btn-full mt-sm btn-marcar-pendiente" data-id="${r.id}">↩ Marcar pendiente</button>`;
  } else if (estado === 'pagado') {
    acciones = `<button class="btn btn-ghost btn-full mt-sm btn-marcar-pendiente" data-id="${r.id}">↩ Marcar como pendiente</button>`;
  } else {
    acciones = `
      <div class="pago-actions mt-sm">
        <button class="btn btn-pay btn-marcar-pagado" data-id="${r.id}">Marcar como pagado</button>
        <button class="btn btn-ghost btn-pago-parcial" data-id="${r.id}">Pago parcial</button>
      </div>`;
  }

  return `
    <div class="remito-card ${estado === 'pagado' ? 'card-pagado' : ''} ${r.archivado ? 'card-archivado' : ''}">
      <div class="remito-card-header">
        <div class="remito-meta">
          <span class="chofer-chip">${esc(nombre)}</span>
          <span class="fecha-chip">${fmt(r.fecha_carga)}</span>
          ${r.archivado ? `<span class="archivado-tag">Archivado</span>` : ''}
        </div>
        <div class="remito-header-actions">
          <button class="btn-edit-remito" data-id="${r.id}" title="Editar remito">✏ Editar</button>
          ${delBtn}
          ${badge}
        </div>
      </div>
      <div class="remito-destinos">
        <span class="destino-tag">📍 ${r.destino_ida}</span>
        ${r.destino_vuelta ? `<span class="dest-arrow">→</span><span class="destino-tag">${r.destino_vuelta}</span>` : ''}
      </div>
      <div class="remito-info-row">
        ${r.litros ? `<span class="info-chip">⛽ ${r.litros}L</span>` : ''}
        ${r.km != null ? `<span class="info-chip">🛣 ${r.km.toLocaleString('es-AR')} km</span>` : ''}
      </div>
      ${r.comentarios ? `<div class="remito-comentarios">💬 ${r.comentarios}</div>` : ''}
      ${r.numero || (kmThumb || thumbs) ? `
        <div class="fotos-section">
          ${r.numero ? `<div class="remito-numero"><span class="remito-numero-label">N° REMITO</span><span class="remito-numero-val">${r.numero}</span></div>` : ''}
          ${(kmThumb || thumbs) ? `<div class="fotos-row">${kmThumb}${thumbs}${masTag}</div>` : ''}
        </div>` : ''}
      ${r.pagado && r.fecha_pago ? `<div class="fecha-pago-info">Pagado el ${fmt(r.fecha_pago)}</div>` : ''}
      ${acciones}
    </div>
  `;
}

// Separador entre dos cargas consecutivas del mismo chofer.
// newer = carga más reciente (sus litros = lo consumido en el viaje anterior, que terminó en newer.km).
// older = carga anterior (km de partida del viaje analizado).
function renderConsumoSeparator(newer, older) {
  if (!newer || !older) return '';
  if (newer.chofer_id !== older.chofer_id) return '';
  if (newer.km == null || older.km == null) return '';
  const distance = newer.km - older.km;
  if (distance <= 0) return '';
  if (!newer.litros || newer.litros <= 0) return '';
  const l100 = (newer.litros / distance) * 100;

  const iconRoute = `<svg class="consumo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21L8 3"/><path d="M21 21L16 3"/><path d="M12 5v2"/><path d="M12 11v2"/><path d="M12 17v2"/></svg>`;
  const iconFuel  = `<svg class="consumo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M3 22h14"/><path d="M4 13h12"/><path d="M16 8h1a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg>`;
  const iconGauge = `<svg class="consumo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/></svg>`;

  return `
    <div class="consumo-separator">
      <div class="consumo-header">
        <span class="consumo-pill">VIAJE</span>
        <span class="consumo-dates">${fmt(older.fecha_carga)} <span class="consumo-arrow">→</span> ${fmt(newer.fecha_carga)}</span>
      </div>
      <div class="consumo-grid">
        <div class="consumo-cell">
          ${iconRoute}
          <span class="consumo-value">${distance.toLocaleString('es-AR')}<span class="consumo-unit">km</span></span>
        </div>
        <div class="consumo-vdiv"></div>
        <div class="consumo-cell">
          ${iconFuel}
          <span class="consumo-value">${newer.litros}<span class="consumo-unit">L</span></span>
        </div>
        <div class="consumo-vdiv"></div>
        <div class="consumo-cell consumo-cell-hl">
          ${iconGauge}
          <span class="consumo-value">${l100.toFixed(1)}<span class="consumo-unit">L/100km</span></span>
        </div>
      </div>
    </div>
  `;
}

function marcarPagado(id) {
  showConfirm('¿Marcar como pagado?', 'Se registra el pago total con la fecha de hoy.', 'Confirmar', async () => {
    const r = _remitosCache[id];
    const upd = { pagado: true, fecha_pago: today() };
    if (r) upd.litros_pagados = litrosTotal(r);   // pago total = todos los litros
    const { error } = await sb.from('remitos').update(upd).eq('id', id);
    if (error) { toast('Error al actualizar', 'err'); return; }
    toast('Remito marcado como pagado ✓');
    loadAdminContent();
  });
}

// Completar un pago parcial → pasa a pagado al 100%.
async function completarPago(id) {
  const r = _remitosCache[id];
  const upd = { pagado: true, fecha_pago: today() };
  if (r) upd.litros_pagados = litrosTotal(r);
  const { error } = await sb.from('remitos').update(upd).eq('id', id);
  if (error) { toast('Error al actualizar', 'err'); return; }
  toast('Pago completado ✓');
  loadAdminContent();
}

function marcarPendiente(id) {
  showConfirm('¿Marcar como pendiente?', 'Vuelve a pendiente y se borra el pago registrado.', 'Confirmar', async () => {
    const { error } = await sb.from('remitos')
      .update({ pagado: false, fecha_pago: null, litros_pagados: 0 }).eq('id', id);
    if (error) { toast('Error al actualizar', 'err'); return; }
    toast('Remito marcado como pendiente ✓');
    loadAdminContent();
  });
}

// Modal de pago parcial: el admin ingresa cuántos LITROS se pagaron.
function showPagoParcial(id) {
  const r = _remitosCache[id];
  if (!r) { toast('No se encontró el remito', 'err'); return; }
  const total  = litrosTotal(r);
  const actual = litrosPagadosOf(r);
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">Pago parcial</div>
      <div class="confirm-sub">Total del remito: <b>${fmtLitros(total)} L</b>. Ingresá cuántos litros se pagaron.</div>
      <div class="field">
        <label class="field-label">Litros pagados</label>
        <input type="number" id="parcial-input" class="inp" value="${actual || ''}"
               step="0.1" min="0" max="${total}" placeholder="Ej: 50" autocomplete="off" inputmode="decimal">
      </div>
      <div class="confirm-btns" style="margin-top:14px">
        <button class="btn btn-ghost" id="parcial-cancel">Cancelar</button>
        <button class="btn btn-primary" id="parcial-ok">Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.querySelector('#parcial-cancel').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });
  el.querySelector('#parcial-ok').addEventListener('click', async () => {
    let v = parseFloat(el.querySelector('#parcial-input').value);
    if (isNaN(v) || v < 0) v = 0;
    if (total > 0 && v > total) v = total;
    const fully = total > 0 && v >= total;
    const upd = { litros_pagados: v, pagado: fully };
    upd.fecha_pago = fully ? today() : null;
    const { error } = await sb.from('remitos').update(upd).eq('id', id);
    if (error) { toast('Error al guardar', 'err'); return; }
    toast(fully ? 'Pago completado ✓' : `Pago parcial de ${fmtLitros(v)} L guardado ✓`);
    close();
    loadAdminContent();
  });
  setTimeout(() => el.querySelector('#parcial-input').focus(), 100);
}

// Cache de remitos cargados (para el editor del admin)
let _remitosCache = {};

// Editor de remito (solo admin): permite corregir datos y agregar/quitar fotos
function showEditRemito(id) {
  const r = _remitosCache[id];
  if (!r) { toast('No se encontró el remito', 'err'); return; }

  // Fotos nuevas a subir (en memoria hasta guardar) y fotos existentes a borrar
  let _nuevasFotos = [];
  let _kmReemplazo = null;             // File nuevo para la foto del km
  const _borrarFotos = new Set();      // ids de remito_fotos a eliminar

  const fotos = r.remito_fotos || [];

  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.innerHTML = `
    <div class="confirm-box edit-remito-box">
      <div class="confirm-title">Editar remito</div>
      <div class="confirm-sub">Chofer: <b>${r.choferes?.nombre || '—'}</b></div>

      <div class="edit-scroll">
        <div class="form-row-2">
          <div class="field">
            <label class="field-label">Fecha de carga</label>
            <input type="date" id="e-fecha" class="inp" value="${r.fecha_carga || ''}">
          </div>
          <div class="field">
            <label class="field-label">Litros</label>
            <input type="number" id="e-litros" class="inp" value="${r.litros ?? ''}" step="0.1" min="0">
          </div>
        </div>

        <div class="field">
          <label class="field-label">N° de remito</label>
          <input type="text" id="e-numero" class="inp" value="${(r.numero || '').replace(/"/g,'&quot;')}" maxlength="40">
        </div>

        <div class="form-row-2">
          <div class="field">
            <label class="field-label">Kilómetros</label>
            <input type="number" id="e-km" class="inp" value="${r.km ?? ''}" step="1" min="0">
          </div>
          <div class="field">
            <label class="field-label">Litros pagados <span style="font-size:0.75em;font-weight:400;opacity:0.7">(parcial)</span></label>
            <input type="number" id="e-litros-pagados" class="inp" value="${(r.litros_pagados ?? 0) || ''}" step="0.1" min="0" placeholder="0">
          </div>
        </div>

        <div class="form-row-2">
          <div class="field">
            <label class="field-label">Destino ida</label>
            <input type="text" id="e-ida" class="inp" value="${(r.destino_ida || '').replace(/"/g,'&quot;')}">
          </div>
          <div class="field">
            <label class="field-label">Destino vuelta</label>
            <input type="text" id="e-vuelta" class="inp" value="${(r.destino_vuelta || '').replace(/"/g,'&quot;')}">
          </div>
        </div>

        <div class="field">
          <label class="field-label">Comentarios</label>
          <textarea id="e-comentarios" class="inp inp-ta" rows="2">${r.comentarios || ''}</textarea>
        </div>

        <div class="field">
          <label class="field-label">Foto del kilómetro</label>
          <div id="e-km-preview" class="foto-previews"></div>
          <label class="foto-btn foto-btn-cam">
            <input type="file" id="e-foto-km" accept="image/*" class="hidden">
            📷 ${r.foto_km_url ? 'Reemplazar foto del km' : 'Agregar foto del km'}
          </label>
        </div>

        <div class="field">
          <label class="field-label">Fotos del remito</label>
          <div id="e-fotos-existentes" class="foto-previews"></div>
          <div id="e-fotos-nuevas" class="foto-previews"></div>
          <label class="foto-btn foto-btn-cam">
            <input type="file" id="e-fotos-add" accept="image/*" multiple class="hidden">
            📷 Agregar fotos
          </label>
        </div>
      </div>

      <div class="confirm-btns" style="margin-top:14px">
        <button class="btn btn-ghost" id="e-cancel">Cancelar</button>
        <button class="btn btn-primary" id="e-save">Guardar cambios</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };

  // ── Preview de la foto del km ──
  const renderKmPreview = () => {
    const box = el.querySelector('#e-km-preview');
    let src = null;
    if (_kmReemplazo) src = URL.createObjectURL(_kmReemplazo);
    else if (r.foto_km_url) src = r.foto_km_url;
    box.innerHTML = src
      ? `<div class="foto-preview-item"><img src="${src}" alt="km">${_kmReemplazo ? '<span class="foto-km-badge">NUEVA</span>' : ''}</div>`
      : '<span class="edit-empty-note">Sin foto del km</span>';
  };

  // ── Preview de fotos existentes (con opción de borrar) ──
  const renderExistentes = () => {
    const box = el.querySelector('#e-fotos-existentes');
    const visibles = fotos.filter(f => !_borrarFotos.has(f.id ?? f.storage_url));
    if (!visibles.length && !fotos.length) { box.innerHTML = '<span class="edit-empty-note">Sin fotos</span>'; return; }
    box.innerHTML = fotos.map(f => {
      const key = f.id ?? f.storage_url;
      const marcada = _borrarFotos.has(key);
      return `
        <div class="foto-preview-item ${marcada ? 'foto-tobedeleted' : ''}">
          <img src="${f.storage_url}" alt="foto">
          <button class="foto-remove" data-key="${key}">${marcada ? '↩' : '✕'}</button>
        </div>`;
    }).join('');
    box.querySelectorAll('.foto-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (_borrarFotos.has(key)) _borrarFotos.delete(key); else _borrarFotos.add(key);
        renderExistentes();
      });
    });
  };

  // ── Preview de fotos nuevas (aún sin subir) ──
  const renderNuevas = () => {
    const box = el.querySelector('#e-fotos-nuevas');
    box.innerHTML = _nuevasFotos.map((f, i) => `
      <div class="foto-preview-item">
        <img src="${URL.createObjectURL(f)}" alt="nueva">
        <span class="foto-km-badge">NUEVA</span>
        <button class="foto-remove" data-idx="${i}">✕</button>
      </div>`).join('');
    box.querySelectorAll('.foto-remove').forEach(btn => {
      btn.addEventListener('click', () => { _nuevasFotos.splice(+btn.dataset.idx, 1); renderNuevas(); });
    });
  };

  renderKmPreview();
  renderExistentes();
  renderNuevas();

  el.querySelector('#e-foto-km').addEventListener('change', function() {
    if (this.files[0]) { _kmReemplazo = this.files[0]; this.value = ''; renderKmPreview(); }
  });
  el.querySelector('#e-fotos-add').addEventListener('change', function() {
    _nuevasFotos = [..._nuevasFotos, ...Array.from(this.files)];
    this.value = '';
    renderNuevas();
  });

  el.querySelector('#e-cancel').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });

  el.querySelector('#e-save').addEventListener('click', async () => {
    const btn = el.querySelector('#e-save');
    btn.disabled = true; btn.textContent = 'Guardando...';

    try {
      // 1) Actualizar campos de texto/número
      const litrosVal = parseFloat(el.querySelector('#e-litros').value);
      const kmVal     = parseInt(el.querySelector('#e-km').value, 10);

      // Pago parcial (litros): se clampa al total y recalcula el estado pagado.
      const totL = isNaN(litrosVal) ? 0 : litrosVal;
      let lpVal = parseFloat(el.querySelector('#e-litros-pagados').value);
      if (isNaN(lpVal) || lpVal < 0) lpVal = 0;
      if (totL > 0 && lpVal > totL) lpVal = totL;
      const fully = totL > 0 && lpVal >= totL;

      const update = {
        fecha_carga:    el.querySelector('#e-fecha').value || r.fecha_carga,
        numero:         el.querySelector('#e-numero').value.trim() || null,
        litros:         isNaN(litrosVal) ? null : litrosVal,
        km:             isNaN(kmVal) ? null : kmVal,
        destino_ida:    el.querySelector('#e-ida').value.trim() || null,
        destino_vuelta: el.querySelector('#e-vuelta').value.trim() || null,
        comentarios:    el.querySelector('#e-comentarios').value.trim() || null,
        litros_pagados: lpVal,
        pagado:         fully,
        fecha_pago:     fully ? (r.fecha_pago || today()) : null,
      };
      const { error: uErr } = await sb.from('remitos').update(update).eq('id', r.id);
      if (uErr) throw uErr;

      // 2) Reemplazar foto del km (si se eligió una nueva)
      if (_kmReemplazo) {
        btn.textContent = 'Subiendo foto km...';
        const ext  = (_kmReemplazo.type === 'image/png') ? 'png' : 'jpg';
        const path = `${r.chofer_id}/${r.id}/km_${Date.now()}.${ext}`;
        const url  = await uploadFoto(_kmReemplazo, path);
        await sb.from('remitos').update({ foto_km_url: url }).eq('id', r.id);
      }

      // 3) Borrar fotos marcadas
      if (_borrarFotos.size) {
        const aBorrar = fotos.filter(f => _borrarFotos.has(f.id ?? f.storage_url));
        for (const f of aBorrar) {
          if (f.id) await sb.from('remito_fotos').delete().eq('id', f.id);
          else      await sb.from('remito_fotos').delete().eq('storage_url', f.storage_url);
        }
      }

      // 4) Subir fotos nuevas
      for (let i = 0; i < _nuevasFotos.length; i++) {
        btn.textContent = `Subiendo foto ${i + 1}/${_nuevasFotos.length}...`;
        const file = _nuevasFotos[i];
        const ext  = (file.type === 'image/png') ? 'png' : 'jpg';
        const path = `${r.chofer_id}/${r.id}/${Date.now()}_${i}.${ext}`;
        const url  = await uploadFoto(file, path);
        await sb.from('remito_fotos').insert({ remito_id: r.id, storage_url: url });
      }

      toast('Remito actualizado ✓');
      close();
      loadAdminContent();
    } catch (e) {
      console.error('Error al editar remito:', e);
      toast(`Error al guardar: ${e.message || 'intentá de nuevo'}`, 'err');
      btn.disabled = false; btn.textContent = 'Guardar cambios';
    }
  });
}

// "Archivar pagados": saca de Pendientes los remitos pagados al 100%, SIN borrarlos.
// Quedan disponibles en "Todos" (sección Archivados) y en el Historial.
async function archivarPagados() {
  const { data, error: cErr } = await sb
    .from('remitos').select('id, litros, litros_pagados, pagado').eq('archivado', false);
  if (cErr) { toast('Error al consultar remitos', 'err'); return; }

  const ids = (data || []).filter(r => estadoPago(r) === 'pagado').map(r => r.id);
  if (!ids.length) { toast('No hay remitos pagados para archivar', 'warn'); return; }

  const plural = ids.length !== 1;
  showConfirm(
    `¿Archivar ${ids.length} remito${plural ? 's' : ''} pagado${plural ? 's' : ''}?`,
    'NO se borran: salen de Pendientes pero siguen en "Todos" y en el Historial. Podés desarchivarlos cuando quieras.',
    'Archivar',
    async () => {
      const { error } = await sb.from('remitos').update({ archivado: true }).in('id', ids);
      if (error) { toast(`Error al archivar: ${error.message}`, 'err'); return; }
      toast(`${ids.length} remito${plural ? 's' : ''} archivado${plural ? 's' : ''} ✓`);
      loadAdminContent();
    }
  );
}

// Desarchivar un remito (vuelve a Pendientes/Todos).
async function desarchivarRemito(id) {
  const { error } = await sb.from('remitos').update({ archivado: false }).eq('id', id);
  if (error) { toast('Error al desarchivar', 'err'); return; }
  toast('Remito desarchivado ✓');
  loadAdminContent();
}

// Borrado individual de un remito (solo en "Todos", con confirmación).
// Este SÍ borra de verdad — y por lo tanto desaparece también del Historial.
function eliminarRemito(id) {
  const r = _remitosCache[id];
  const quien = r?.choferes?.nombre ? ` de ${r.choferes.nombre}` : '';
  showConfirm(
    '¿Eliminar este remito?',
    `Se borra el remito${quien} y sus fotos. Esta acción no se puede deshacer.`,
    'Eliminar',
    async () => {
      const { error: fErr } = await sb.from('remito_fotos').delete().eq('remito_id', id);
      if (fErr) { toast(`Error al borrar fotos: ${fErr.message}`, 'err'); return; }
      const { error: rErr } = await sb.from('remitos').delete().eq('id', id);
      if (rErr) { toast(`Error al borrar remito: ${rErr.message}`, 'err'); return; }
      toast('Remito eliminado ✓');
      loadAdminContent();
    }
  );
}

// =====================================================
// ADMIN — Subir remito por un chofer (sin desloguear)
// =====================================================
async function renderAdminUploadRemito() {
  S.fotosStaged = [];
  S.fotoKm = null;
  setLoading('Cargando...');
  let choferes;
  try {
    const res = await sb.from('choferes').select('id, nombre').eq('is_admin', false).order('nombre');
    if (res.error) throw res.error;
    choferes = res.data || [];
  } catch (e) {
    toast('No se pudieron cargar los choferes. Probá de nuevo.', 'err');
    renderAdmin();
    return;
  }

  app().innerHTML = `
    <div class="screen screen-chofer">
      <header class="app-header">
        <span class="header-name">Subir remito <span class="version-inline">como admin</span></span>
        <button id="btn-volver-admin" class="btn-logout" title="Volver al panel">← Volver</button>
      </header>
      <main class="chofer-main">
        ${remitoFormHTML(true, choferes)}
      </main>
    </div>
  `;

  bindChoferForm();
  $('btn-volver-admin').addEventListener('click', () => renderAdmin());
}

// =====================================================
// ADMIN — Gestión de choferes (alta / baja)
// =====================================================
function showUsuariosModal() {
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.innerHTML = `
    <div class="confirm-box usuarios-box">
      <div class="confirm-title">Choferes</div>
      <div class="confirm-sub">Crear o eliminar choferes. La contraseña es un PIN de 4 dígitos.</div>
      <div class="form-row-2">
        <div class="field">
          <label class="field-label">Nombre</label>
          <input id="u-nombre" class="inp" placeholder="Ej: Hugo" maxlength="60" autocomplete="off">
        </div>
        <div class="field">
          <label class="field-label">PIN (4 díg.)</label>
          <input id="u-pin" class="inp" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off">
        </div>
      </div>
      <button id="u-add" class="btn btn-primary btn-full mt-sm">➕ Agregar chofer</button>
      <div class="usuarios-list" id="u-list"><div class="loading-inline">Cargando...</div></div>
      <div class="confirm-btns" style="margin-top:6px">
        <button class="btn btn-ghost" id="u-close">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.querySelector('#u-close').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });

  const pinInput = el.querySelector('#u-pin');
  pinInput.addEventListener('input', () => { pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4); });

  const box = el.querySelector('#u-list');
  const renderList = (list) => {
    if (!list || !list.length) { box.innerHTML = `<div class="usuarios-empty">No hay choferes cargados</div>`; return; }
    box.innerHTML = list.map(c => `
      <div class="usuario-row">
        <span class="usuario-nombre">${esc(c.nombre)}</span>
        <button class="usuario-del" data-id="${c.id}" data-nombre="${esc(c.nombre)}" title="Eliminar chofer">🗑</button>
      </div>`).join('');
    box.querySelectorAll('.usuario-del').forEach(b =>
      b.addEventListener('click', () => eliminarChofer(b.dataset.id, b.dataset.nombre, reload)));
  };
  const reload = async () => {
    const { data } = await sb.from('choferes').select('id, nombre').eq('is_admin', false).order('nombre');
    renderList(data);
  };
  reload();

  const addBtn = el.querySelector('#u-add');
  addBtn.addEventListener('click', async () => {
    const nombre = el.querySelector('#u-nombre').value.trim();
    const pin = pinInput.value;
    if (nombre.length < 2) { toast('Ingresá un nombre', 'err'); return; }
    if (pin.length !== 4)  { toast('El PIN debe tener 4 dígitos', 'err'); return; }
    addBtn.disabled = true;                 // evita doble alta por doble click
    await addChofer(nombre, pin, () => {
      el.querySelector('#u-nombre').value = '';
      pinInput.value = '';
      reload();
    });
    addBtn.disabled = false;
  });
}

// Crea un chofer (equivale al INSERT manual): nombre + PIN, is_admin=false,
// device_id temporal único (se reemplaza por el real cuando el chofer entra).
async function addChofer(nombre, pin, onOk) {
  const { data: existing } = await sb
    .from('choferes').select('id').ilike('nombre', nombre).limit(1).maybeSingle();
  if (existing) { toast(`Ya existe un chofer "${nombre}"`, 'warn'); return; }

  const { error } = await sb.from('choferes').insert({
    nombre, pin, device_id: crypto.randomUUID(), is_admin: false,
  });
  if (error) { toast(`Error al crear: ${error.message}`, 'err'); return; }
  toast(`Chofer "${nombre}" creado ✓`);
  onOk && onOk();
}

// Elimina un chofer. OJO: por el FK on delete cascade, borra también sus remitos
// y fotos — por eso se avisa cuántos remitos se van a perder.
async function eliminarChofer(id, nombre, onOk) {
  const { count, error: cErr } = await sb
    .from('remitos').select('*', { count: 'exact', head: true }).eq('chofer_id', id);
  const n = count || 0;
  // Si el conteo falla, NO afirmar que no hay nada que perder: avisar en pesimista.
  const aviso = cErr
    ? 'No se pudo verificar cuántos remitos tiene: se borrarán TODOS sus remitos y fotos. Esta acción no se puede deshacer.'
    : (n > 0
        ? `Se borrarán también sus ${n} remito${n !== 1 ? 's' : ''} (y sus fotos). Esta acción no se puede deshacer.`
        : 'Esta acción no se puede deshacer.');
  showConfirm(`¿Eliminar al chofer "${esc(nombre)}"?`, aviso, 'Eliminar', async () => {
    const { error } = await sb.from('choferes').delete().eq('id', id);
    if (error) { toast(`Error al eliminar: ${error.message}`, 'err'); return; }
    toast(`Chofer "${nombre}" eliminado ✓`);
    onOk && onOk();
  });
}

// =====================================================
// MES PICKER (filtro mes — custom)
// =====================================================
function formatMesLabel(value) {
  if (!value) return 'Seleccionar mes';
  const [y, m] = value.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
}

function bindMesPicker() {
  const mdd = document.getElementById('mdd-mes');
  if (!mdd) return;
  const trigger  = mdd.querySelector('.cdd-trigger');
  const menu     = mdd.querySelector('.cdd-menu');
  const yearEl   = mdd.querySelector('.mdd-year');
  const monthBtns = mdd.querySelectorAll('.mdd-month');

  // Año mostrado en el picker (puede ser distinto al seleccionado mientras navega)
  let displayYear = S.filtroMes
    ? parseInt(S.filtroMes.split('-')[0], 10)
    : new Date().getFullYear();
  const selectedYear  = S.filtroMes ? S.filtroMes.split('-')[0] : '';
  const selectedMonth = S.filtroMes ? S.filtroMes.split('-')[1] : '';

  const refresh = () => {
    yearEl.textContent = displayYear;
    monthBtns.forEach(b => {
      b.classList.toggle('is-active',
        String(displayYear) === selectedYear && b.dataset.m === selectedMonth);
    });
  };
  refresh();

  const onDoc = (e) => { if (!mdd.contains(e.target)) close(); };
  const close = () => {
    menu.classList.add('hidden');
    trigger.classList.remove('is-open');
    document.removeEventListener('click', onDoc);
  };
  const open = () => {
    menu.classList.remove('hidden');
    trigger.classList.add('is-open');
    setTimeout(() => document.addEventListener('click', onDoc), 0);
  };

  trigger.addEventListener('click', () => {
    if (menu.classList.contains('hidden')) open(); else close();
  });

  mdd.querySelectorAll('.mdd-year-btn').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      displayYear += parseInt(b.dataset.dir, 10);
      refresh();
    });
  });

  monthBtns.forEach(b => {
    b.addEventListener('click', () => {
      S.filtroMes = `${displayYear}-${b.dataset.m}`;
      loadAdminContent();
    });
  });

  mdd.querySelector('.mdd-clear')?.addEventListener('click', () => {
    S.filtroMes = '';
    loadAdminContent();
  });
  mdd.querySelector('.mdd-today')?.addEventListener('click', () => {
    const t = new Date();
    S.filtroMes = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
    loadAdminContent();
  });
}

// =====================================================
// CUSTOM DROPDOWN (chofer filter)
// =====================================================
function bindChoferDropdown() {
  const cdd = document.getElementById('cdd-chofer');
  if (!cdd) return;
  const trigger = cdd.querySelector('.cdd-trigger');
  const menu    = cdd.querySelector('.cdd-menu');

  const onDoc = (e) => { if (!cdd.contains(e.target)) close(); };
  const close = () => {
    menu.classList.add('hidden');
    trigger.classList.remove('is-open');
    document.removeEventListener('click', onDoc);
  };
  const open = () => {
    menu.classList.remove('hidden');
    trigger.classList.add('is-open');
    setTimeout(() => document.addEventListener('click', onDoc), 0);
  };

  trigger.addEventListener('click', () => {
    if (menu.classList.contains('hidden')) open(); else close();
  });

  cdd.querySelectorAll('.cdd-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      S.filtroChofer = opt.dataset.value;
      loadAdminContent();
    });
  });
}

// =====================================================
// LIGHTBOX
// =====================================================
let _lightboxKeyHandler = null; // prevents duplicate keydown listeners across renderAdmin() calls

function bindLightbox() {
  $('lb-close')?.addEventListener('click', closeLightbox);
  $('lb-backdrop')?.addEventListener('click', closeLightbox);
  $('lb-prev')?.addEventListener('click', () => {
    S.lightboxIdx = (S.lightboxIdx - 1 + S.lightboxUrls.length) % S.lightboxUrls.length;
    updateLightboxImg();
  });
  $('lb-next')?.addEventListener('click', () => {
    S.lightboxIdx = (S.lightboxIdx + 1) % S.lightboxUrls.length;
    updateLightboxImg();
  });
  // Remove previous handler before adding a new one to avoid accumulating listeners
  if (_lightboxKeyHandler) document.removeEventListener('keydown', _lightboxKeyHandler);
  _lightboxKeyHandler = e => {
    if ($('lightbox')?.classList.contains('hidden')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  { S.lightboxIdx = (S.lightboxIdx - 1 + S.lightboxUrls.length) % S.lightboxUrls.length; updateLightboxImg(); }
    if (e.key === 'ArrowRight') { S.lightboxIdx = (S.lightboxIdx + 1) % S.lightboxUrls.length; updateLightboxImg(); }
  };
  document.addEventListener('keydown', _lightboxKeyHandler);
}

function openLightbox(urls, idx) {
  S.lightboxUrls = urls;
  S.lightboxIdx  = idx;
  $('lightbox').classList.remove('hidden');
  updateLightboxImg();
  const showNav = urls.length > 1;
  $('lb-prev').style.display = showNav ? '' : 'none';
  $('lb-next').style.display = showNav ? '' : 'none';
}

function updateLightboxImg() { $('lb-img').src = S.lightboxUrls[S.lightboxIdx]; }
function closeLightbox()     { $('lightbox').classList.add('hidden'); $('lb-img').src = ''; }

// =====================================================
// INSTALL PWA
// =====================================================
let _installPrompt = null;
let _installBtn    = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  if (_installBtn) _installBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  _installPrompt = null;
  if (_installBtn) _installBtn.classList.add('hidden');
});

async function triggerInstall() {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  const { outcome } = await _installPrompt.userChoice;
  if (outcome === 'accepted') _installPrompt = null;
}

function makeInstallBtn(extraClass = '') {
  // Solo botón automático — solo aparece si el navegador soporta PWA
  const wrap = document.createElement('div');
  wrap.className = 'install-wrap';

  const btn = document.createElement('button');
  btn.className = `btn-install ${extraClass} ${_installPrompt ? '' : 'hidden'}`.trim();
  btn.innerHTML = '📲 Agregar al escritorio';
  btn.addEventListener('click', triggerInstall);
  _installBtn = btn;

  wrap.appendChild(btn);
  return wrap;
}

// =====================================================
// START
// =====================================================
document.addEventListener('DOMContentLoaded', init);
