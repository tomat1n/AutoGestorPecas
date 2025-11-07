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
  if (!supabase) {
    console.warn('Supabase client não disponível');
    return;
  }
  try {
    console.log('Carregando serviços do Supabase...');
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.warn('Erro ao carregar serviços:', error);
      return;
    }
    
    console.log('Dados brutos do Supabase:', data);
    console.log('Número de serviços carregados:', data?.length || 0);
    
    window.SERV_STATE.services = (data || []).map(mapDbToAppService);
    console.log('Serviços mapeados:', window.SERV_STATE.services);
    
    renderServicesList();
    populateCategoryFilter(); // Atualizar o filtro de categorias
  } catch (e) {
    console.warn('Falha loadServicesFromSupabase:', e);
  }
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

function populateCategoryFilter() {
  const categorySelect = document.getElementById('servFilterCategory');
  if (!categorySelect) return;
  
  // Obter categorias únicas dos serviços
  const categories = [...new Set(window.SERV_STATE.services
    .filter(s => s.category && s.category.trim())
    .map(s => s.category.trim())
    .sort()
  )];
  
  // Manter a opção "Todas as categorias" e adicionar novas
  const currentValue = categorySelect.value;
  categorySelect.innerHTML = '<option value="">Todas as categorias</option>';
  
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
  
  // Restaurar o valor selecionado se ainda existir
  if (currentValue && categories.includes(currentValue)) {
    categorySelect.value = currentValue;
  }
}

function renderServicesList() {
  console.log('Renderizando lista de serviços...');
  const grid = document.getElementById('servicesGrid');
  if (!grid) {
    console.warn('Elemento servicesGrid não encontrado');
    return;
  }
  
  const q = (document.getElementById('servSearch')?.value || '').trim().toLowerCase();
  const categoryFilter = document.getElementById('servFilterCategory')?.value || '';
  const statusFilter = document.getElementById('servFilterStatus')?.value || '';
  
  let items = (window.SERV_STATE.services || []).slice();
  
  // Aplicar filtros
  if (q) {
    items = items.filter(s => 
      (s.name||'').toLowerCase().includes(q) || 
      (s.description||'').toLowerCase().includes(q) || 
      (s.category||'').toLowerCase().includes(q)
    );
  }
  
  if (categoryFilter) {
    items = items.filter(s => (s.category||'').toLowerCase() === categoryFilter.toLowerCase());
  }
  
  if (statusFilter === 'active') {
    items = items.filter(s => s.is_active);
  } else if (statusFilter === 'inactive') {
    items = items.filter(s => !s.is_active);
  }
  
  console.log('Serviços para renderizar:', items.length);
  
  grid.innerHTML = '';
  
  if (items.length === 0) {
    grid.innerHTML = `
      <div class="no-services">
        <p>📋 ${q || categoryFilter || statusFilter ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}</p>
        <small>${q || categoryFilter || statusFilter ? 'Tente ajustar os filtros de pesquisa' : 'Clique em "Novo Serviço" para adicionar o primeiro serviço'}</small>
      </div>
    `;
    return;
  }
  
  items.forEach(s => {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Ícone baseado na primeira letra do nome
    const firstLetter = (s.name || '').charAt(0).toUpperCase() || 'S';
    
    card.innerHTML = `
      <div class="service-image">
        ${firstLetter}
        ${!s.is_active ? '<span class="service-inactive-badge">INATIVO</span>' : ''}
      </div>
      <div class="product-info">
        <h4 class="product-name" title="${s.name || '—'}">${s.name || '—'}</h4>
        ${s.category ? `<span class="product-category">${s.category}</span>` : ''}
        ${s.description ? `<p class="product-description" title="${s.description}">${s.description}</p>` : ''}
        <span class="product-price">${fmtBRL(s.price||0)}</span>
      </div>
      <div class="product-actions">
        <button class="btn btn-primary btn-sm" title="Editar serviço" onclick="event.stopPropagation(); showServiceDetails(${JSON.stringify(s).replace(/"/g, '&quot;')})">
          <i class="fa-solid fa-edit"></i> Editar
        </button>
      </div>
    `;
    
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
  
  const categoryFilter = document.getElementById('servFilterCategory');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', renderServicesList);
  }
  
  const statusFilter = document.getElementById('servFilterStatus');
  if (statusFilter) {
    statusFilter.addEventListener('change', renderServicesList);
  }
}

function initServicesOnce() {
  console.log('Inicializando serviços...');
  if (SERVICES_INITIALIZED) {
    console.log('Serviços já inicializados');
    return;
  }
  SERVICES_INITIALIZED = true;
  try { setupServicesEvents(); } catch (e) { console.warn('Falha setupServicesEvents:', e); }
  try { loadServicesFromSupabase(); } catch (e) { console.warn('Falha loadServices:', e); }
}

// Expor no escopo global
window.initServicesOnce = initServicesOnce;