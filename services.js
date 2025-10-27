// Serviços: cadastro, busca e listagem
let SERVICES_INITIALIZED = false;
window.SERV_STATE = window.SERV_STATE || { services: [], selectedServiceId: null };

function fmtBRL(value) {
  try { return (Number(value||0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  catch { return `R$ ${(Number(value||0)).toFixed(2)}`; }
}

function mapDbToAppService(row) {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    category: row.category || '',
    price: Number(row.price || 0),
    is_active: !!row.is_active,
    updated_at: row.updated_at || null,
    created_at: row.created_at || null,
  };
}

function mapAppToDbService(s) {
  const payload = {
    name: s.name || '',
    description: s.description || '',
    category: s.category || '',
    price: Number(s.price || 0),
    is_active: !!s.is_active,
  };
  if (s.id) payload.id = s.id;
  return payload;
}

function getServiceFormValues() {
  const name = document.getElementById('servName')?.value || '';
  const description = document.getElementById('servDescription')?.value || '';
  const category = document.getElementById('servCategory')?.value || '';
  const price = Number(document.getElementById('servPrice')?.value || 0);
  const activeVal = document.getElementById('servActive')?.value || 'true';
  const is_active = activeVal === 'true';
  const id = window.SERV_STATE?.selectedServiceId || null;
  return { id, name, description, category, price, is_active };
}

function setServiceFormValues(s) {
  document.getElementById('servName') && (document.getElementById('servName').value = s?.name || '');
  document.getElementById('servDescription') && (document.getElementById('servDescription').value = s?.description || '');
  document.getElementById('servCategory') && (document.getElementById('servCategory').value = s?.category || '');
  document.getElementById('servPrice') && (document.getElementById('servPrice').value = s?.price != null ? String(s.price) : '');
  if (document.getElementById('servActive')) {
    document.getElementById('servActive').value = s?.is_active ? 'true' : 'false';
  }
}

function clearServiceForm() {
  window.SERV_STATE.selectedServiceId = null;
  setServiceFormValues({ name:'', description:'', category:'', price:'', is_active:true });
}

async function loadServicesFromSupabase() {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) { console.warn('Erro ao carregar serviços:', error); return; }
    window.SERV_STATE.services = (data || []).map(mapDbToAppService);
    renderServicesList();
  } catch (e) { console.warn('Falha loadServicesFromSupabase:', e); }
}

async function saveService() {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  const form = getServiceFormValues();
  const payload = mapAppToDbService(form);
  try {
    const { error } = await supabase.from('services').upsert([payload], { onConflict: 'id' });
    if (error) { alert('Erro ao salvar serviço'); console.warn(error); return; }
    await loadServicesFromSupabase();
    const saved = window.SERV_STATE.services.find(s => s.name === form.name && s.category === form.category && Math.abs((s.price||0) - (form.price||0)) < 0.0001);
    window.SERV_STATE.selectedServiceId = saved?.id || form.id || null;
    alert('Serviço salvo!');
  } catch (e) { console.warn('Falha saveService:', e); alert('Erro inesperado ao salvar'); }
}

async function deleteService() {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  const id = window.SERV_STATE?.selectedServiceId;
  if (!id) { alert('Selecione um serviço para excluir'); return; }
  if (!confirm('Confirma excluir este serviço?')) return;
  try {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) { alert('Erro ao excluir serviço'); console.warn(error); return; }
    window.SERV_STATE.selectedServiceId = null;
    await loadServicesFromSupabase();
    clearServiceForm();
    alert('Serviço excluído!');
  } catch (e) { console.warn('Falha deleteService:', e); alert('Erro inesperado ao excluir'); }
}

function showServiceDetails(s) {
  window.SERV_STATE.selectedServiceId = s?.id || null;
  setServiceFormValues(s || {});
}

function renderServicesList() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  const q = (document.getElementById('servSearch')?.value || '').trim().toLowerCase();
  let items = (window.SERV_STATE.services || []).slice();
  if (q) items = items.filter(s => (s.name||'').toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q) || (s.category||'').toLowerCase().includes(q));
  grid.innerHTML = '';
  items.forEach(s => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-image">${`<i class=\"fa-solid fa-wrench\"></i>`}</div>
      <div class="product-name">${s.name || '—'}</div>
      <div class="product-price">${fmtBRL(s.price||0)}</div>
      <div class="product-add"><button class="btn btn-secondary">Editar</button></div>
    `;
    const btn = card.querySelector('.btn');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); showServiceDetails(s); });
    card.addEventListener('click', () => showServiceDetails(s));
    grid.appendChild(card);
  });
}

function setupServicesEvents() {
  const search = document.getElementById('servSearch');
  if (search) search.addEventListener('input', () => renderServicesList());
  const saveBtn = document.getElementById('servSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', (e) => { e.preventDefault(); saveService(); });
  const clearBtn = document.getElementById('servClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', (e) => { e.preventDefault(); clearServiceForm(); });
  const delBtn = document.getElementById('servDeleteBtn');
  if (delBtn) delBtn.addEventListener('click', (e) => { e.preventDefault(); deleteService(); });
}

function initServicesOnce() {
  if (SERVICES_INITIALIZED) return;
  SERVICES_INITIALIZED = true;
  try { setupServicesEvents(); } catch (e) { console.warn('Falha setupServicesEvents:', e); }
  try { loadServicesFromSupabase(); } catch (e) { console.warn('Falha loadServices:', e); }
}

// Expor no escopo global
window.initServicesOnce = initServicesOnce;