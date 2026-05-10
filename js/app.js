// RemitosApp — js/app.js
// =====================================================
// CONFIG — reemplazar con tus credenciales de Supabase
// =====================================================
const SUPABASE_URL     = 'https://tu-proyecto.supabase.co'; // reemplazar
const SUPABASE_ANON_KEY = 'tu-anon-key';                   // reemplazar
const ADMIN_PASSWORD   = 'ypf2024'; // cambiar por contraseña segura

const SUPABASE_CONFIGURED = !SUPABASE_URL.includes('tu-proyecto');
const sb = SUPABASE_CONFIGURED
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// =====================================================
// STATE
// =====================================================
const S = {
  deviceId: (() => {
    let id = localStorage.getItem('ypf_device_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ypf_device_id', id); }
    return id;
  })(),
  choferId:  localStorage.getItem('ypf_chofer_id'),
  nombre:    localStorage.getItem('ypf_nombre'),
  isAdmin:   localStorage.getItem('ypf_is_admin') === 'true',
  adminTab:  'pendientes',
  filtroChofer: '',
  filtroMes:    '',
  fotosStaged:  [],
  lightboxUrls: [],
  lightboxIdx:  0,
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

// =====================================================
// INIT
// =====================================================
async function init() {
  if (!SUPABASE_CONFIGURED) { renderWelcome(); return; }

  if (S.isAdmin) { renderAdmin(); return; }
  if (S.choferId && S.nombre) { renderChofer(); return; }

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
          <input type="text" id="inp-nombre" class="inp" placeholder="Ej: Juan Pérez" maxlength="60" autocomplete="off">
        </div>
        <button id="btn-confirmar" class="btn btn-primary btn-full" disabled>Continuar</button>
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
    </div>
  `;

  const inpNombre = $('inp-nombre');
  const btnOk     = $('btn-confirmar');

  inpNombre.addEventListener('input', () => {
    btnOk.disabled = inpNombre.value.trim().length < 2;
  });
  inpNombre.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !btnOk.disabled) registrarChofer(inpNombre.value.trim());
  });
  btnOk.addEventListener('click', () => registrarChofer(inpNombre.value.trim()));

  $('btn-admin-toggle').addEventListener('click', () => {
    $('admin-form').classList.toggle('hidden');
  });

  $('btn-admin-login').addEventListener('click', () => {
    if ($('inp-admin-pass').value === ADMIN_PASSWORD) {
      const nombre = inpNombre.value.trim() || 'Admin';
      adminLoginSuccess(nombre);
    } else {
      toast('Contraseña incorrecta', 'err');
    }
  });
}

async function registrarChofer(nombre) {
  if (!SUPABASE_CONFIGURED) {
    toast('Configurá las credenciales de Supabase en js/app.js primero', 'err');
    return;
  }
  const btn = $('btn-confirmar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const { data, error } = await sb
    .from('choferes')
    .insert({ nombre, device_id: S.deviceId, is_admin: false })
    .select().single();

  if (error) {
    toast('Error al guardar. Intentá de nuevo.', 'err');
    btn.disabled = false;
    btn.textContent = 'Continuar';
    return;
  }

  S.choferId = data.id;
  S.nombre   = nombre;
  S.isAdmin  = false;
  localStorage.setItem('ypf_chofer_id', data.id);
  localStorage.setItem('ypf_nombre',    nombre);
  localStorage.setItem('ypf_is_admin',  'false');

  toast(`Bienvenido, ${nombre}!`);
  renderChofer();
}

async function adminLoginSuccess(nombre) {
  if (!SUPABASE_CONFIGURED) {
    toast('Configurá las credenciales de Supabase en js/app.js primero', 'err');
    return;
  }
  setLoading('Accediendo...');

  let { data } = await sb.from('choferes').select('*').eq('device_id', S.deviceId).maybeSingle();

  if (!data) {
    const res = await sb
      .from('choferes')
      .insert({ nombre, device_id: S.deviceId, is_admin: true })
      .select().single();
    data = res.data;
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
function renderChofer() {
  S.fotosStaged = [];
  app().innerHTML = `
    <div class="screen screen-chofer">
      <header class="app-header">
        <span class="header-name">Hola, ${S.nombre} 👋</span>
      </header>
      <main class="chofer-main">

        <div class="card form-card">
          <h2 class="section-title">Cargar nuevo remito</h2>

          <div class="form-row-2">
            <div class="field">
              <label class="field-label">Fecha de carga *</label>
              <input type="date" id="f-fecha" class="inp" value="${today()}">
            </div>
            <div class="field">
              <label class="field-label">Litros cargados</label>
              <input type="number" id="f-litros" class="inp" placeholder="0.0" step="0.1" min="0">
            </div>
          </div>

          <div class="field">
            <label class="field-label">Destino ida *</label>
            <input type="text" id="f-destino-ida" class="inp" placeholder="Ciudad / empresa de destino">
          </div>

          <div class="field">
            <label class="field-label">Destino vuelta</label>
            <input type="text" id="f-destino-vuelta" class="inp" placeholder="Ciudad / empresa de regreso (opcional)">
          </div>

          <div class="field">
            <label class="field-label">Comentarios</label>
            <textarea id="f-comentarios" class="inp inp-ta" rows="3"
              placeholder="Ej: Rotura de cubierta, espera en destino, observaciones..."></textarea>
          </div>

          <div class="field">
            <label class="field-label">
              Fotos del remito &nbsp;<span class="req-badge">mínimo 1 requerida *</span>
            </label>
            <label class="foto-dropzone" id="foto-dropzone">
              <input type="file" id="f-fotos" accept="image/*" multiple class="hidden">
              <div class="foto-dropzone-inner">
                <span class="foto-icon">📷</span>
                <span>Tocá para agregar fotos</span>
              </div>
            </label>
            <div id="foto-previews" class="foto-previews"></div>
          </div>

          <button id="btn-enviar" class="btn btn-primary btn-full btn-lg" disabled>
            📤 Enviar remito
          </button>
        </div>

        <div class="card" id="mis-remitos-card">
          <h2 class="section-title">Mis últimos remitos</h2>
          <div id="mis-remitos-list"><div class="loading-inline">Cargando...</div></div>
        </div>

      </main>
    </div>
  `;

  bindChoferForm();
  loadMisRemitos();
}

function bindChoferForm() {
  const btnEnviar = $('btn-enviar');

  const checkValid = () => {
    const fecha = $('f-fecha').value;
    const ida   = $('f-destino-ida').value.trim();
    btnEnviar.disabled = !(fecha && ida && S.fotosStaged.length > 0);
  };

  $('f-fecha').addEventListener('change', checkValid);
  $('f-destino-ida').addEventListener('input', checkValid);

  const fotos = $('f-fotos');
  fotos.addEventListener('change', () => {
    S.fotosStaged = [...S.fotosStaged, ...Array.from(fotos.files)];
    fotos.value = '';
    renderFotoPreviews();
    checkValid();
  });

  function renderFotoPreviews() {
    const prev = $('foto-previews');
    prev.innerHTML = S.fotosStaged.map((f, i) => `
      <div class="foto-preview-item">
        <img src="${URL.createObjectURL(f)}" alt="preview">
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

async function submitRemito() {
  const btn = $('btn-enviar');
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  const fecha          = $('f-fecha').value;
  const destinoIda     = $('f-destino-ida').value.trim();
  const destinoVuelta  = $('f-destino-vuelta').value.trim() || null;
  const litros         = parseFloat($('f-litros').value) || null;
  const comentarios    = $('f-comentarios').value.trim() || null;

  // 1. Insertar remito
  const { data: remito, error: rErr } = await sb
    .from('remitos')
    .insert({ chofer_id: S.choferId, fecha_carga: fecha, destino_ida: destinoIda,
              destino_vuelta: destinoVuelta, litros, comentarios })
    .select().single();

  if (rErr) {
    toast('Error al enviar el remito', 'err');
    btn.disabled = false;
    btn.textContent = '📤 Enviar remito';
    return;
  }

  // 2. Subir fotos a Supabase Storage
  const fallidos = [];
  for (const file of S.fotosStaged) {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `${S.choferId}/${remito.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await sb.storage.from('remito-fotos').upload(path, file, { upsert: false });
    if (upErr) { fallidos.push(file.name); continue; }
    const { data: urlData } = sb.storage.from('remito-fotos').getPublicUrl(path);
    await sb.from('remito_fotos').insert({ remito_id: remito.id, storage_url: urlData.publicUrl });
  }

  if (fallidos.length) {
    toast(`Remito guardado. No se pudieron subir: ${fallidos.join(', ')}`, 'warn');
  } else {
    toast('Remito enviado correctamente ✓');
  }

  renderChofer();
}

async function loadMisRemitos() {
  const el = $('mis-remitos-list');
  if (!el) return;

  const { data } = await sb
    .from('remitos')
    .select('*, remito_fotos(id)')
    .eq('chofer_id', S.choferId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!el) return;

  if (!data || data.length === 0) {
    el.innerHTML = `<p class="empty-msg">Todavía no cargaste ningún remito</p>`;
    return;
  }

  el.innerHTML = data.map(r => `
    <div class="mini-remito">
      <div class="mini-remito-top">
        <span class="mini-fecha">${fmt(r.fecha_carga)}</span>
        <span class="status-badge ${r.pagado ? 'paid' : 'pending'}">${r.pagado ? '✓ Pagado' : 'Pendiente'}</span>
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

// =====================================================
// ADMIN
// =====================================================
async function renderAdmin() {
  app().innerHTML = `
    <div class="screen screen-admin">
      <header class="app-header">
        <span class="header-name">Panel Admin</span>
        <span class="admin-badge">ADMIN</span>
      </header>
      <div class="tab-bar">
        <button class="tab-btn ${S.adminTab === 'pendientes' ? 'active' : ''}" data-tab="pendientes">
          Pendientes
        </button>
        <button class="tab-btn ${S.adminTab === 'todos' ? 'active' : ''}" data-tab="todos">
          Todos
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
  await loadAdminContent();
}

async function loadAdminContent() {
  const main = $('admin-main');
  if (!main) return;
  main.innerHTML = `<div class="loading-inline">Cargando...</div>`;

  let query = sb
    .from('remitos')
    .select('*, choferes(nombre), remito_fotos(storage_url)')
    .order('created_at', { ascending: false });

  if (S.adminTab === 'pendientes') query = query.eq('pagado', false);
  if (S.filtroChofer)              query = query.eq('chofer_id', S.filtroChofer);
  if (S.filtroMes) {
    const [y, m] = S.filtroMes.split('-');
    const from = `${y}-${m}-01`;
    const to   = new Date(+y, +m, 0).toISOString().slice(0, 10);
    query = query.gte('fecha_carga', from).lte('fecha_carga', to);
  }

  const [{ data: remitos }, { data: choferes }] = await Promise.all([
    query,
    sb.from('choferes').select('id, nombre').eq('is_admin', false).order('nombre'),
  ]);

  let html = '';

  // Stats (solo en tab "todos")
  if (S.adminTab === 'todos' && remitos) {
    const mesKey  = today().slice(0, 7);
    const rMes    = remitos.filter(r => r.fecha_carga?.startsWith(mesKey));
    const litros  = rMes.reduce((a, r) => a + (r.litros || 0), 0);
    const pend    = remitos.filter(r => !r.pagado).length;
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

  // Filtros (solo en tab "todos")
  if (S.adminTab === 'todos') {
    const opts = (choferes || [])
      .map(c => `<option value="${c.id}" ${S.filtroChofer === c.id ? 'selected' : ''}>${c.nombre}</option>`)
      .join('');
    html += `
      <div class="filtros-row">
        <select id="filtro-chofer" class="inp inp-sm">
          <option value="">Todos los choferes</option>${opts}
        </select>
        <input type="month" id="filtro-mes" class="inp inp-sm" value="${S.filtroMes}">
        <button id="btn-limpiar" class="btn btn-ghost btn-sm">Limpiar</button>
      </div>
    `;
  }

  // Lista
  if (!remitos || remitos.length === 0) {
    html += `<p class="empty-msg">${S.adminTab === 'pendientes' ? '✓ Sin remitos pendientes de pago' : 'No hay remitos cargados'}</p>`;
  } else {
    html += remitos.map(renderRemitoCard).join('');
  }

  main.innerHTML = html;

  // Bind filtros
  const fc = $('filtro-chofer');
  const fm = $('filtro-mes');
  if (fc) fc.addEventListener('change', () => { S.filtroChofer = fc.value; loadAdminContent(); });
  if (fm) fm.addEventListener('change', () => { S.filtroMes    = fm.value; loadAdminContent(); });
  $('btn-limpiar')?.addEventListener('click', () => { S.filtroChofer = ''; S.filtroMes = ''; loadAdminContent(); });

  // Bind "marcar pagado"
  main.querySelectorAll('.btn-marcar-pagado').forEach(b => {
    b.addEventListener('click', () => marcarPagado(b.dataset.id));
  });

  // Bind foto thumbnails
  main.querySelectorAll('.foto-thumb').forEach(img => {
    img.addEventListener('click', () => {
      openLightbox(JSON.parse(img.dataset.urls), +img.dataset.idx);
    });
  });
}

function renderRemitoCard(r) {
  const fotos   = r.remito_fotos || [];
  const nombre  = r.choferes?.nombre || 'Desconocido';
  const allUrls = JSON.stringify(fotos.map(f => f.storage_url)).replace(/"/g, '&quot;');

  const thumbs  = fotos.slice(0, 4).map((f, i) =>
    `<img class="foto-thumb" src="${f.storage_url}" alt="foto"
      data-urls="${allUrls}" data-idx="${i}">`
  ).join('');
  const masTag  = fotos.length > 4 ? `<div class="foto-mas">+${fotos.length - 4}</div>` : '';

  return `
    <div class="remito-card ${r.pagado ? 'card-pagado' : ''}">
      <div class="remito-card-header">
        <div class="remito-meta">
          <span class="chofer-chip">${nombre}</span>
          <span class="fecha-chip">${fmt(r.fecha_carga)}</span>
        </div>
        <span class="status-badge ${r.pagado ? 'paid' : 'pending'}">${r.pagado ? '✓ Pagado' : 'Pendiente'}</span>
      </div>
      <div class="remito-destinos">
        <span class="destino-tag">📍 ${r.destino_ida}</span>
        ${r.destino_vuelta ? `<span class="dest-arrow">→</span><span class="destino-tag">${r.destino_vuelta}</span>` : ''}
      </div>
      ${r.litros  ? `<div class="remito-litros">⛽ ${r.litros}L cargados</div>` : ''}
      ${r.comentarios ? `<div class="remito-comentarios">💬 ${r.comentarios}</div>` : ''}
      ${fotos.length > 0 ? `<div class="fotos-row">${thumbs}${masTag}</div>` : ''}
      ${r.pagado && r.fecha_pago ? `<div class="fecha-pago-info">Pagado el ${fmt(r.fecha_pago)}</div>` : ''}
      ${!r.pagado ? `
        <button class="btn btn-pay btn-full mt-sm btn-marcar-pagado" data-id="${r.id}">
          Marcar como pagado
        </button>` : ''}
    </div>
  `;
}

async function marcarPagado(id) {
  if (!confirm('¿Marcar este remito como pagado?')) return;
  const { error } = await sb.from('remitos').update({ pagado: true, fecha_pago: today() }).eq('id', id);
  if (error) { toast('Error al actualizar', 'err'); return; }
  toast('Remito marcado como pagado ✓');
  loadAdminContent();
}

// =====================================================
// LIGHTBOX
// =====================================================
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
  document.addEventListener('keydown', e => {
    if ($('lightbox')?.classList.contains('hidden')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  { S.lightboxIdx = (S.lightboxIdx - 1 + S.lightboxUrls.length) % S.lightboxUrls.length; updateLightboxImg(); }
    if (e.key === 'ArrowRight') { S.lightboxIdx = (S.lightboxIdx + 1) % S.lightboxUrls.length; updateLightboxImg(); }
  });
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
// START
// =====================================================
document.addEventListener('DOMContentLoaded', init);
