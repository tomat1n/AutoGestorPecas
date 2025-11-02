document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa Supabase
  try { initSupabase?.(); } catch {}

  // Gate de autenticação mínimo
  try {
    const supabase = window.supabaseClient;
    if (!supabase) {
      // Sem cliente, levar para login
      try { window.location.replace('auth.html'); return; } catch {}
    } else {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        try { window.location.replace('auth.html'); return; } catch {}
      }
    }
  } catch (e) { console.warn('Falha ao verificar autenticação:', e); }

  // Ativa menu e navegação
  setupMenuActiveState();
  // Ações de header e atualização de data/hora
  setupHeaderActions();
  setupSidebarToggle();
  setupDateTimeUpdater();
  // Atalhos rápidos
  setupQuickShortcuts();
  
  // Atualiza cards do dashboard com dados do Supabase
  try {
    if (window.dashboardData && typeof window.dashboardData.updateDashboardCards === 'function') {
      await window.dashboardData.updateDashboardCards();
    }
  } catch (error) {
    console.warn('Erro ao atualizar dashboard:', error);
  }
  
  // Abre Dashboard como padrão
  navigateTo('dashboard');
});

function setupMenuActiveState() {
  const items = document.querySelectorAll('.menu-item');
  items.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');
      items.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      navigateTo(page);
    });
  });
}

function setupQuickShortcuts() {
  const cards = document.querySelectorAll('.quick-card');
  const map = {
    'ordem de serviço':'os',
    'venda (pdv)':'pdv',
    'estoque':'estoque',
    'notas fiscais':'nf',
    'clientes':'clientes',
    'a receber':'receber',
    'a pagar':'pagar'
  };
  cards.forEach(card => {
    const m = (card.getAttribute('data-module')||'').toLowerCase();
    const page = map[m];
    if (page){
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const menuItem = document.querySelector(`.menu-item[data-page="${page}"]`);
        if (menuItem) menuItem.click(); else navigateTo(page);
      });
    }
  });
}

async function navigateTo(page) {
  const pdvSection = document.getElementById('pdvSection');
  const osSection = document.getElementById('osSection');
  const inventorySection = document.getElementById('inventorySection');
  const receivablesSection = document.getElementById('receivablesSection');
  const payablesSection = document.getElementById('payablesSection');
  const reportsSection = document.getElementById('reportsSection');
  const clientsSection = document.getElementById('clientsSection');
  const suppliersSection = document.getElementById('suppliersSection');
  const nfSection = document.getElementById('nfSection');
  const settingsSection = document.getElementById('configSection') || document.getElementById('config-section');
  const checklistSection = document.getElementById('checklistSection');

  const sections = [pdvSection, osSection, inventorySection, receivablesSection, payablesSection, reportsSection, clientsSection, suppliersSection, nfSection, checklistSection, settingsSection];
  sections.forEach(sec => { if (sec) sec.classList.add('hidden'); });

  const quickSection = document.querySelector('.quick-section');
  if (quickSection) {
    if (page === 'dashboard') quickSection.classList.remove('hidden');
    else quickSection.classList.add('hidden');
  }

  switch (page) {
    case 'dashboard':
      break;
    case 'pdv':
      if (pdvSection) pdvSection.classList.remove('hidden');
      try { initPDVOnce?.(); } catch {}
      break;
    case 'os':
      if (osSection) osSection.classList.remove('hidden');
      try { initOSOnce?.(); } catch {}
      break;
    case 'estoque':
      if (inventorySection) inventorySection.classList.remove('hidden');
      try { initInventoryOnce?.(); } catch {}
      break;
    case 'receber':
      if (receivablesSection) receivablesSection.classList.remove('hidden');
      try { initReceivablesOnce?.(); } catch {}
      break;
    case 'pagar':
      if (payablesSection) payablesSection.classList.remove('hidden');
      try { initPayablesOnce?.(); } catch {}
      break;
    case 'relatorios':
      if (reportsSection) reportsSection.classList.remove('hidden');
      try { initReportsOnce?.(); } catch {}
      break;
    case 'checklist':
      if (checklistSection) checklistSection.classList.remove('hidden');
      try { initChecklistOnce?.(); } catch {}
      break;
    case 'clientes':
      if (clientsSection) clientsSection.classList.remove('hidden');
      try { initClientsOnce?.(); } catch {}
      break;
    case 'fornecedores':
      if (suppliersSection) suppliersSection.classList.remove('hidden');
      try { initSuppliersOnce?.(); } catch {}
      break;
    case 'nf':
      if (nfSection) nfSection.classList.remove('hidden');
      try { initInvoicesOnce?.(); } catch {}
      break;
    case 'config':
      if (settingsSection) settingsSection.classList.remove('hidden');
      try { initSettingsOnce?.(); } catch {}
      break;
    case 'logout':
      try { await window.supabaseClient?.auth?.signOut?.(); } catch (e) { console.warn('Falha ao sair:', e); }
      try { window.location.replace('auth.html'); return; } catch {}
      return;
    default:
      if (pdvSection) pdvSection.classList.remove('hidden');
      try { initPDVOnce?.(); } catch {}
  }
}

// Add header actions: gear icon opens Configurações
function setupHeaderActions(){
  try{
    const gear = document.querySelector('.header-right .fa-gear.header-icon');
    if (gear){
      gear.style.cursor = 'pointer';
      gear.addEventListener('click', () => {
        const cfgItem = document.querySelector('.menu-item[data-page="config"]');
        if (cfgItem) cfgItem.click(); else navigateTo('config');
      });
    }
  }catch(e){ console.warn('Falha ao configurar ações de header:', e); }
}

// Date/Time updater for #datetime
function setupDateTimeUpdater(){
  const el = document.getElementById('datetime');
  if (!el) return;
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const pad = (n) => String(n).padStart(2,'0');
  const render = () => {
    const now = new Date();
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    el.textContent = `${day} de ${monthName} de ${year}, ${hours}:${minutes}`;
  };
  render();
  const now = new Date();
  const msToNextMinute = (60 - now.getSeconds())*1000 - now.getMilliseconds();
  setTimeout(() => { render(); setInterval(render, 60000); }, Math.max(msToNextMinute, 0));
}

// PDV init único e carrinho
let PDV_INITIALIZED = false;
function initPDVOnce() {
  if (PDV_INITIALIZED) return;
  PDV_INITIALIZED = true;
  initShoppingCart();
  setupPDVEvents();
  // Render inicial do grid do PDV
  try { renderPDVProducts?.(); } catch (_) {}
}

function setupPDVEvents() {
  const payOptions = document.querySelectorAll('#payOptions .pay-option');
  const cashPaymentSection = document.getElementById('cashPaymentSection');
  const amountPaidInput = document.getElementById('amountPaidInput');
  const changeAmount = document.getElementById('changeAmount');
  
  payOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      payOptions.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Mostrar/ocultar seção de pagamento em dinheiro
      const paymentMethod = btn.getAttribute('data-method');
      if (paymentMethod === 'Dinheiro') {
        cashPaymentSection.style.display = 'block';
      } else {
        cashPaymentSection.style.display = 'none';
        // Limpar campos quando não for dinheiro
        amountPaidInput.value = '';
        changeAmount.textContent = 'R$ 0,00';
      }
    });
  });

  // Calcular troco automaticamente
  if (amountPaidInput) {
    amountPaidInput.addEventListener('input', () => {
      const amountPaid = parseFloat(amountPaidInput.value) || 0;
      const totalElement = document.getElementById('totalAmount');
      const totalText = totalElement ? totalElement.textContent : 'R$ 0,00';
      const total = parseFloat(totalText.replace('R$', '').replace(',', '.').trim()) || 0;
      
      const change = Math.max(0, amountPaid - total);
      changeAmount.textContent = `R$ ${change.toFixed(2).replace('.', ',')}`;
    });
  }

  const clearBtn = document.getElementById('btnClearCart');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (window.cart && confirm('Limpar carrinho?')) window.cart.clear();
    });
  }

  const finalizeBtn = document.getElementById('finalizeSaleBtn');
  if (finalizeBtn) finalizeBtn.addEventListener('click', finalizeSale);

  // Busca do PDV
  const searchInput = document.getElementById('productSearch');
  if (searchInput) {
    const doRender = () => { try { renderPDVProducts?.(); } catch (_) {} };
    searchInput.addEventListener('input', debounce(doRender, 300));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const term = (searchInput.value || '').trim();
        const s = window.INV_STATE;
        const prod = s?.products?.find(p => String(p.barcode || '') === term);
        if (prod) { window.addToCart(prod, 1); searchInput.select(); }
        else doRender();
      }
    });
  }

  // Categorias
  const catBtns = document.querySelectorAll('#categories .category');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      try { renderPDVProducts?.(); } catch (_) {}
    });
  });
}

// Renderização dos produtos do PDV
function renderPDVProducts() {
  const s = window.INV_STATE;
  const grid = document.getElementById('productsGrid');
  if (!s || !grid) return;
  const q = (document.getElementById('productSearch')?.value || '').trim().toLowerCase();
  const activeCat = document.querySelector('#categories .category.active')?.getAttribute('data-cat') || 'Todos';

  let items = (s.products || []).slice();
  if (q) items = items.filter(p => (p.name||'').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q) || String(p.barcode||'').toLowerCase().includes(q));
  if (activeCat && activeCat !== 'Todos') items = items.filter(p => p.category === activeCat);

  grid.innerHTML = '';
  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-image">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" onerror="this.style.display='none'">` : `<i class="fa-solid fa-box"></i>`}
      </div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">${fmtBRL(p.price||0)}</div>
      <div class="product-add"><button class="btn btn-primary">Adicionar</button></div>
    `;
    const btn = card.querySelector('.btn');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); window.addToCart(p, 1); });
    card.addEventListener('click', () => window.addToCart(p, 1));
    grid.appendChild(card);
  });
}

class ShoppingCart {
  constructor() {
    this.items = [];
    this.load();
  }
  save() {
    try { localStorage.setItem('pdv_cart', JSON.stringify(this.items)); } catch (e) {}
  }
  load() {
    try {
      const raw = localStorage.getItem('pdv_cart');
      if (raw) this.items = JSON.parse(raw) || [];
    } catch (e) { this.items = []; }
  }
  add(product, quantity = 1) {
    const id = String(product.id || product.barcode || product.name);
    const price = Number(product.price || 0);
    const name = product.name || 'Produto';
    const barcode = product.barcode || '';
    const existing = this.items.find(i => i.id === id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push({ id, name, price, quantity, barcode, image_url: product.image_url || '' });
    }
    this.save();
    this.render();
  }
  updateQuantity(id, delta) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.quantity = Math.max(0, item.quantity + delta);
    if (item.quantity <= 0) {
      this.items = this.items.filter(i => i.id !== id);
    }
    this.save();
    this.render();
  }
  removeItem(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
    this.render();
  }
  clear() {
    this.items = [];
    this.save();
    this.render();
  }
  render() {
    const cartItems = document.getElementById('cartItems');
    const subtotal = document.getElementById('subtotalAmount');
    const discount = document.getElementById('discountAmount');
    const total = document.getElementById('totalAmount');

    const subtotalValue = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalValue = subtotalValue;

    if (!cartItems) return;

    if (this.items.length === 0) {
      cartItems.innerHTML = `
        <div class="empty-cart" style="text-align: center; color: var(--gray); padding: 40px;">
          <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 15px;"></i>
          <p>Carrinho vazio</p>
          <p style="font-size: 0.9rem;">Adicione produtos clicando nos itens</p>
        </div>
      `;
    } else {
      cartItems.innerHTML = this.items.map(item => `
        <div class="cart-item">
          <div class="item-image">
            ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" onerror="this.style.display='none'">` : `<i class="fas fa-box"></i>`}
          </div>
          <div class="item-details">
            <div class="item-name">${item.name}</div>
            <div class="item-price">R$ ${item.price.toFixed(2)}</div>
          </div>
          <div class="item-quantity">
            <button class="qty-btn" onclick="cart.updateQuantity('${item.id}', -1)">-</button>
            <input type="text" class="qty-input" value="${item.quantity}" readonly>
            <button class="qty-btn" onclick="cart.updateQuantity('${item.id}', 1)">+</button>
          </div>
          <div class="item-total">R$ ${(item.price * item.quantity).toFixed(2)}</div>
          <div class="remove-item" onclick="cart.removeItem('${item.id}')">
            <i class="fas fa-trash"></i>
          </div>
        </div>
      `).join('');
    }

    if (subtotal) subtotal.textContent = `R$ ${subtotalValue.toFixed(2)}`;
    if (discount) discount.textContent = `R$ ${0.00.toFixed(2)}`;
    if (total) total.textContent = `R$ ${totalValue.toFixed(2)}`;
  }
}

function initShoppingCart() {
  window.cart = new ShoppingCart();
  window.addToCart = (product, quantity = 1) => {
    const id = String(product.id || product.barcode || product.name);
    const existing = window.cart?.items?.find(i => i.id === id);
    const existingQty = existing ? existing.quantity : 0;
    const stock = Number(product.stock ?? Infinity);
    const allowed = Math.min(quantity, Math.max(0, stock - existingQty));
    if (allowed <= 0) {
      alert('Estoque insuficiente para adicionar mais unidades.');
      return;
    }
    window.cart.add(product, allowed);
  };
  window.cart.render();
}

async function finalizeSale() {
  const cart = window.cart;
  if (!cart || cart.items.length === 0) {
    alert('Carrinho vazio.');
    return;
  }
  if (!confirm('Confirmar finalização da venda?')) return;

  const supabase = window.supabaseClient;
  if (!supabase) {
    alert('Supabase não configurado.');
    return;
  }

  const activeMethodEl = document.querySelector('#payOptions .pay-option.active');
  const paymentMethod = activeMethodEl ? activeMethodEl.getAttribute('data-method') : 'Dinheiro';

  const subtotalValue = cart.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const totalValue = subtotalValue; // ajuste se aplicar descontos/juros
  const saleData = {
    subtotal: subtotalValue,
    discount: 0,
    total: totalValue,
    payment_method: paymentMethod,
    created_at: new Date().toISOString(),
  };

  try {
    // 1) Registrar a venda
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(saleData)
      .select('*')
      .single();
    if (saleError) throw saleError;

    // 2) Registrar os itens da venda (produtos e serviços)
    const itemsPayload = cart.items.map(item => ({
      sale_id: sale.id,
      item_type: item.type === 'service' ? 'service' : 'product',
      product_id: item.type === 'service' ? null : String(item.id || ''),
      service_id: item.type === 'service' ? String(item.id || '') : null,
      name: String(item.name || ''),
      description: String(item.description || ''),
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.price || 0),
      line_total: Number(item.price || 0) * Number(item.quantity || 1),
      created_at: new Date().toISOString(),
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(itemsPayload);
    if (itemsError) throw itemsError;

    // 3) Baixar estoque dos produtos e registrar movimentos
    const productItems = cart.items.filter(i => i.type !== 'service');
    const productIds = productItems.map(i => i.id).filter(Boolean);
    if (productIds.length) {
      const { data: stocksData, error: stocksErr } = await supabase
        .from('products')
        .select('id, stock')
        .in('id', productIds);
      if (stocksErr) throw stocksErr;

      const stockMap = new Map((stocksData || []).map(r => [String(r.id), Number(r.stock || 0)]));
      for (const item of productItems) {
        const curKey = String(item.id);
        const current = stockMap.has(curKey) ? Number(stockMap.get(curKey)) : 0;
        const newStock = Math.max(0, current - Number(item.quantity || 0));
        // Atualiza o estoque
        const { error: updErr } = await supabase
          .from('products')
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', item.id);
        if (updErr) throw updErr;
        // Registra movimento de saída (venda)
        try {
          await supabase.from('stock_movements').insert({
            product_id: String(item.id),
            type: 'sale',
            quantity: Number(item.quantity || 0),
            notes: 'Venda PDV',
            created_at: new Date().toISOString()
          });
        } catch (_) { /* tabela pode não existir; ignora */ }
      }
    }

    alert('Venda finalizada com sucesso!');
    cart.clear();
  } catch (e) {
    console.error('Erro ao finalizar venda:', e);
    alert('Falha ao finalizar venda. Verifique a conexão com o Supabase.');
  }
}

// Supabase
function initSupabase() {
  let cfgLS = {};
  try { cfgLS = JSON.parse(localStorage.getItem('cfg') || '{}'); } catch {}
  const isValidUrl = (u) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(String(u||'').trim());
  const isValidKey = (k) => typeof k === 'string' && k.trim().split('.').length === 3;
  const urlCandidate = cfgLS?.cfgSupabaseUrl;
  const keyCandidate = cfgLS?.cfgSupabaseAnonKey;
  const url = (isValidUrl(urlCandidate) ? urlCandidate : '').trim();
  const key = (isValidKey(keyCandidate) ? keyCandidate : '').trim();
  // Guarda cfg atual para diagnósticos/fallbacks
  window.SUPA_CFG = { url, key };
  // Evitar conflitos com sessões antigas do supabase-js
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) keysToRemove.push(k);
      if (k.includes('supabase.auth.token')) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
  } catch {}

  const supaOptions = { auth: { persistSession: true, autoRefreshToken: false } };
  if (url && key && window.supabase) {
    window.supabaseClient = window.supabase.createClient(url, key, supaOptions);
  } else {
    window.supabaseClient = null;
  }

  // Inicializar cliente admin (service_role) se disponível — apenas desenvolvimento
  const svcCandidate = cfgLS?.cfgSupabaseServiceKey;
  const serviceKey = (isValidKey(svcCandidate) ? svcCandidate : '').trim();
  if (url && serviceKey && window.supabase) {
    try {
      window.adminSupabaseClient = window.supabase.createClient(url, serviceKey, supaOptions);
      window.ADMIN_SUPA_CFG = { url, key: serviceKey };
    } catch (e) {
      console.warn('Falha ao inicializar cliente admin do Supabase:', e?.message || e);
      window.adminSupabaseClient = null;
    }
  } else {
    window.adminSupabaseClient = null;
  }
}

// ==============================
// OS (Ordem de Serviço)
// ==============================
let OS_INITIALIZED = false;
function initOSOnce() {
  if (OS_INITIALIZED) return;
  OS_INITIALIZED = true;
  window.OS_STATE = {
    client: { name: '', document: '', phone: '', email: '' },
    vehicle: { plate: '', model: '', year: '', color: '', km: '', chassis: '' },
    services: [],
    parts: [],
    observations: ''
  };
  setupOSEvents();
  renderOSPreview();
}

function setupOSEvents() {
  const s = window.OS_STATE;
  // Troca de modo (lista vs nova)
  const btnList = document.getElementById('osListBtn');
  const btnNew = document.getElementById('osNewBtn');
  const modeForm = document.getElementById('osModeForm');
  const modeList = document.getElementById('osModeList');
  if (btnList) btnList.addEventListener('click', () => { modeForm.classList.add('hidden'); modeList.classList.remove('hidden'); loadOSList(); });
  if (btnNew) btnNew.addEventListener('click', () => { modeList.classList.add('hidden'); modeForm.classList.remove('hidden'); });

  // Inputs cliente
  bindInput('clientName', (v) => { s.client.name = v; renderOSPreview(); });
  bindInput('clientDocument', (v) => { s.client.document = v; renderOSPreview(); });
  bindInput('clientPhone', (v) => { s.client.phone = v; renderOSPreview(); });
  bindInput('clientEmail', (v) => { s.client.email = v; renderOSPreview(); });

  // Inputs veículo
  bindInput('vehiclePlate', (v) => { s.vehicle.plate = v; renderOSPreview(); });
  bindInput('vehicleModel', (v) => { s.vehicle.model = v; renderOSPreview(); });
  bindInput('vehicleYear', (v) => { s.vehicle.year = v; renderOSPreview(); });
  bindInput('vehicleColor', (v) => { s.vehicle.color = v; renderOSPreview(); });
  bindInput('vehicleKm', (v) => { s.vehicle.km = v; renderOSPreview(); });
  bindInput('vehicleChassis', (v) => { s.vehicle.chassis = v; renderOSPreview(); });

  // Observações
  bindInput('osObservations', (v) => { s.observations = v; renderOSPreview(); }, true);

  // Busca serviços
  const serviceSearch = document.getElementById('serviceSearch');
  if (serviceSearch) serviceSearch.addEventListener('input', debounce(async (e) => {
    const term = e.target.value.trim();
    await searchServices(term);
  }, 300));

  // Busca peças
  const partSearch = document.getElementById('partSearch');
  if (partSearch) partSearch.addEventListener('input', debounce(async (e) => {
    const term = e.target.value.trim();
    await searchParts(term);
  }, 300));

  // Salvar OS
  const saveBtn = document.getElementById('saveOSBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveOS);
}

function bindInput(id, onChange, isTextarea = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => onChange(el.value));
  // Inicializa preview com valor default
  onChange(el.value || '');
}

function debounce(fn, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }
function fmtBRL(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v||0)); }

async function searchServices(term) {
  const resultsEl = document.getElementById('serviceResults');
  if (!resultsEl) return;
  resultsEl.innerHTML = '';
  if (!term || term.length < 2) return;
  const supabase = window.supabaseClient;
  if (!supabase) return;
  const { data } = await supabase
    .from('services')
    .select('*')
    .or(`name.ilike.%${term}%,category.ilike.%${term}%`)
    .eq('is_active', true)
    .limit(20);
  (data||[]).forEach(svc => {
    const card = document.createElement('div');
    card.className = 'os-result-card';
    card.innerHTML = `
      <div class="os-result-title">${svc.name}</div>
      <div class="os-result-price">${fmtBRL(svc.price||0)}</div>
      <div class="os-result-add"><button class="btn btn-primary">Adicionar</button></div>
    `;
    const btn = card.querySelector('.btn');
    if (btn) btn.addEventListener('click', () => addService({ id: svc.id, name: svc.name, price: Number(svc.price||0) }, 1));
    resultsEl.appendChild(card);
  });
}

async function searchParts(term) {
  const resultsEl = document.getElementById('partResults');
  if (!resultsEl) return;
  resultsEl.innerHTML = '';
  if (!term || term.length < 2) return;
  const supabase = window.supabaseClient;
  if (!supabase) return;
  const { data } = await supabase
    .from('products')
    .select('*')
    .or(`name.ilike.%${term}%,description.ilike.%${term}%,barcode.eq.${term}`)
    .eq('is_active', true)
    .limit(20);
  (data||[]).forEach(p => {
    const card = document.createElement('div');
    card.className = 'os-result-card';
    card.innerHTML = `
      <div class="os-result-title">${p.name}</div>
      <div class="os-result-price">${fmtBRL(p.price||0)}</div>
      <div class="os-result-add"><button class="btn btn-primary">Adicionar</button></div>
    `;
    const btn = card.querySelector('.btn');
    if (btn) btn.addEventListener('click', () => addPart({ id: p.id, name: p.name, price: Number(p.price||0), product_id: p.id }, 1));
    resultsEl.appendChild(card);
  });
}

function addService(service, qty = 1) {
  const s = window.OS_STATE;
  const existing = s.services.find(i => i.id === service.id);
  if (existing) existing.quantity += qty; else s.services.push({ ...service, quantity: qty });
  renderOSItems('services');
  renderOSPreview();
}

function addPart(part, qty = 1) {
  const s = window.OS_STATE;
  const existing = s.parts.find(i => i.product_id === (part.product_id||part.id));
  if (existing) existing.quantity += qty; else s.parts.push({ ...part, quantity: qty });
  renderOSItems('parts');
  renderOSPreview();
}

function renderOSItems(type) {
  const s = window.OS_STATE;
  const items = type === 'services' ? s.services : s.parts;
  const container = document.getElementById(type === 'services' ? 'osServices' : 'osParts');
  if (!container) return;
  container.innerHTML = '';
  items.forEach((it, idx) => {
    const total = Number(it.price||0) * Number(it.quantity||1);
    const row = document.createElement('div');
    row.className = 'os-item';
    row.innerHTML = `
      <div class="os-item-name">${it.name}</div>
      <div class="os-item-price">${fmtBRL(it.price||0)}</div>
      <div class="os-item-qty">
        <button class="os-qty-btn" data-action="dec">-</button>
        <input class="os-qty-input" type="number" min="1" value="${it.quantity}" />
        <button class="os-qty-btn" data-action="inc">+</button>
      </div>
      <div class="os-item-total">${fmtBRL(total)}</div>
      <div class="os-item-remove" title="Remover">✕</div>
    `;
    const dec = row.querySelector('[data-action="dec"]');
    const inc = row.querySelector('[data-action="inc"]');
    const qtyInput = row.querySelector('.os-qty-input');
    const remove = row.querySelector('.os-item-remove');
    if (dec) dec.addEventListener('click', () => { it.quantity = Math.max(1, Number(it.quantity)-1); qtyInput.value = it.quantity; renderOSItems(type); renderOSPreview(); });
    if (inc) inc.addEventListener('click', () => { it.quantity = Number(it.quantity)+1; qtyInput.value = it.quantity; renderOSItems(type); renderOSPreview(); });
    if (qtyInput) qtyInput.addEventListener('input', () => { const v = Math.max(1, Number(qtyInput.value||1)); it.quantity = v; renderOSItems(type); renderOSPreview(); });
    if (remove) remove.addEventListener('click', () => { items.splice(idx,1); renderOSItems(type); renderOSPreview(); });
    container.appendChild(row);
  });
}

function calcTotals() {
  const s = window.OS_STATE;
  const sv = s.services.reduce((sum,i)=> sum + Number(i.price||0)*Number(i.quantity||1), 0);
  const pt = s.parts.reduce((sum,i)=> sum + Number(i.price||0)*Number(i.quantity||1), 0);
  return { services: sv, parts: pt, total: sv + pt };
}

function renderOSPreview() {
  const s = window.OS_STATE;
  const pc = document.getElementById('previewClient');
  const pv = document.getElementById('previewVehicle');
  const ps = document.getElementById('previewServices');
  const pp = document.getElementById('previewParts');
  const pt = document.getElementById('previewTotals');
  if (pc) pc.textContent = `${s.client.name||'-'} | ${s.client.document||'-'} | ${s.client.phone||'-'} | ${s.client.email||'-'}`;
  if (pv) pv.textContent = `${s.vehicle.plate||'-'} | ${s.vehicle.model||'-'} | ${s.vehicle.year||'-'} | ${s.vehicle.color||'-'} | KM: ${s.vehicle.km||'-'} | Chassi: ${s.vehicle.chassis||'-'}`;
  if (ps) ps.innerHTML = s.services.map(i => `${i.name} x${i.quantity} — ${fmtBRL(i.price)}`).join('<br>') || '—';
  if (pp) pp.innerHTML = s.parts.map(i => `${i.name} x${i.quantity} — ${fmtBRL(i.price)}`).join('<br>') || '—';
  const totals = calcTotals();
  if (pt) pt.innerHTML = `Serviços: <b>${fmtBRL(totals.services)}</b><br>Peças: <b>${fmtBRL(totals.parts)}</b><br>Total: <b>${fmtBRL(totals.total)}</b>`;
}

async function saveOS() {
  const s = window.OS_STATE;
  const supabase = window.supabaseClient;
  if (!supabase) { alert('Supabase não configurado.'); return; }
  if (!s.client.name || !s.vehicle.plate || !s.vehicle.model) {
    alert('Preencha Nome do Cliente, Placa e Modelo do Veículo.');
    return;
  }
  const totals = calcTotals();
  const payload = {
    client_id: null,
    client_name: s.client.name,
    client_document: s.client.document||null,
    client_phone: s.client.phone||null,
    client_email: s.client.email||null,
    vehicle_plate: s.vehicle.plate,
    vehicle_model: s.vehicle.model,
    vehicle_year: s.vehicle.year ? Number(s.vehicle.year) : null,
    vehicle_color: s.vehicle.color||null,
    vehicle_km: s.vehicle.km ? Number(s.vehicle.km) : null,
    vehicle_chassis: s.vehicle.chassis||null,
    status: 'pending',
    total_amount: Number(totals.total||0),
    observations: s.observations||null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  try {
    const { data: order, error } = await supabase
      .from('service_orders')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;

    const servicesRows = s.services.map(it => ({
      service_order_id: order.id,
      service_name: it.name,
      service_price: Number(it.price||0),
      quantity: Number(it.quantity||1)
    }));
    if (servicesRows.length > 0) {
      const { error: svcErr } = await supabase.from('os_services').insert(servicesRows);
      if (svcErr) throw svcErr;
    }

    const partsRows = s.parts.map(it => ({
      service_order_id: order.id,
      product_id: it.product_id || it.id || null,
      part_name: it.name,
      part_price: Number(it.price||0),
      quantity: Number(it.quantity||1),
      stock_used: false
    }));
    if (partsRows.length > 0) {
      const { error: prtErr } = await supabase.from('os_parts').insert(partsRows);
      if (prtErr) throw prtErr;
    }

    alert('OS salva com sucesso!');
    // Limpar estado
    window.OS_STATE = { client: { name: '', document: '', phone: '', email: '' }, vehicle: { plate: '', model: '', year: '', color: '', km: '', chassis: '' }, services: [], parts: [], observations: '' };
    // Limpar UI
    ['clientName','clientDocument','clientPhone','clientEmail','vehiclePlate','vehicleModel','vehicleYear','vehicleColor','vehicleKm','vehicleChassis','osObservations'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('serviceResults')?.replaceChildren();
    document.getElementById('partResults')?.replaceChildren();
    renderOSItems('services');
    renderOSItems('parts');
    renderOSPreview();
  } catch (e) {
    console.error('Falha ao salvar OS', e);
    alert('Falha ao salvar OS. Verifique conexão com Supabase e tabelas.');
  }
}

async function loadOSList() {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  const tbody = document.querySelector('#osTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const { data } = await supabase
    .from('service_orders')
    .select('id, os_number, client_name, vehicle_plate, status, total_amount, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  (data||[]).forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.os_number || '-'}</td>
      <td>${row.client_name}</td>
      <td>${row.vehicle_plate}</td>
      <td>${row.status}</td>
      <td>${fmtBRL(row.total_amount || 0)}</td>
      <td>${new Date(row.created_at).toLocaleString('pt-BR')}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================
// Estoque (Gestão de Estoque)
// ==============================
let INV_INITIALIZED = false;
function initInventoryOnce() {
  if (INV_INITIALIZED) return;
  INV_INITIALIZED = true;

  window.INV_STATE = {
    products: [],
    selectedProductId: null,
    stockMovements: []
  };

  (async () => {
    const loaded = await loadInventoryFromSupabase();
    window.INV_STATE.products = Array.isArray(loaded) && loaded.length ? loaded : initDemoInventoryData();
    renderInventoryFilters();
    renderInventoryList();
    setupInventoryEvents();
    try { renderPDVProducts?.(); } catch (_) {}
  })();
}

function initDemoInventoryData() {
  return [
    { id:'P-1001', name:'Filtro de Óleo GM', description:'Filtro AC Delco para motores GM', barcode:'78910001001', category:'Filtros', supplier:'ACDelco', price:49.9, stock:12, minStock:3 },
    { id:'P-1002', name:'Pastilha de Freio Dianteira', description:'Onix 2013-2019 — jogo dianteiro', barcode:'78910001002', category:'Freios', supplier:'Cobreq', price:159.9, stock:8, minStock:2 },
    { id:'P-1003', name:'Bateria 60Ah', description:'Livre de manutenção — 12V', barcode:'78910001003', category:'Elétrica', supplier:'Moura', price:599.0, stock:4, minStock:2 },
    { id:'P-1004', name:'Lâmpada H7 55W', description:'Farol baixo — halógena', barcode:'78910001004', category:'Iluminação', supplier:'Osram', price:39.9, stock:25, minStock:5 },
    { id:'P-1005', name:'Aditivo Radiador Long Life', description:'1L concentrado, proteção longa', barcode:'78910001005', category:'Fluidos', supplier:'Texaco', price:29.9, stock:18, minStock:4 },
    { id:'P-1006', name:'Filtro de Ar Motor', description:'HB20 1.0/1.6 — substituição OEM', barcode:'78910001006', category:'Filtros', supplier:'Mahle', price:69.9, stock:10, minStock:3 }
  ];
}

async function loadInventoryFromSupabase() {
  const supabase = window.supabaseClient;
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .limit(1000);
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0];
      window.INV_DB_FIELDS = {
        image_url: Object.prototype.hasOwnProperty.call(sample, 'image_url'),
        cost_price: Object.prototype.hasOwnProperty.call(sample, 'cost_price'),
        markup_percent: Object.prototype.hasOwnProperty.call(sample, 'markup_percent'),
      };
    } else {
      window.INV_DB_FIELDS = window.INV_DB_FIELDS || { image_url: false, cost_price: false, markup_percent: false };
    }
    return (data || []).map(mapDbToAppProduct);
  } catch (e) {
    console.warn('Falha ao carregar estoque do Supabase:', e);
    return null;
  }
}

function mapDbToAppProduct(row) {
  return {
    id: row.id || row.product_id || row.barcode || `P-${Math.floor(1000 + Math.random()*9000)}`,
    name: row.name || '',
    description: row.description || '',
    barcode: row.barcode || '',
    category: row.category || '',
    supplier: row.supplier || '',
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    minStock: Number(row.min_stock ?? row.minStock ?? 0),
    image_url: row.image_url || '',
    costPrice: Number(row.cost_price || 0),
    markupPercent: Number(row.markup_percent || 0)
  };
}

function mapAppToDbProduct(p) {
  const payload = {
    name: p.name || null,
    description: p.description || null,
    barcode: p.barcode || null,
    category: p.category || null,
    supplier: p.supplier || null,
    price: Number(p.price || 0),
    stock: Number(p.stock || 0),
    min_stock: Number(p.minStock || 0),
    is_active: true,
    updated_at: new Date().toISOString()
  };
  const fields = window.INV_DB_FIELDS || {};
  if (fields.image_url) payload.image_url = p.image_url || null;
  if (fields.cost_price) payload.cost_price = Number(p.costPrice || 0);
  if (fields.markup_percent) payload.markup_percent = Number(p.markupPercent || 0);
  // Inclui id apenas quando existir; em inserts omitimos para usar o default do banco
  if (p.id) payload.id = p.id;
  return payload;
}

async function saveProductSupabase(data) {
  const supabase = window.supabaseClient;
  if (!supabase) return null;
  const payload = mapAppToDbProduct(data);
  try {
    const { data: existingArr, error: selErr } = await supabase
      .from('products')
      .select('id')
      .eq('barcode', payload.barcode)
      .limit(1);
    if (selErr) console.warn('Verificação de produto falhou:', selErr);
    if (existingArr && existingArr.length > 0) {
      const id = existingArr[0].id;
      const { data: updData, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return mapDbToAppProduct(updData);
    } else {
      payload.created_at = new Date().toISOString();
      const { data: insData, error } = await supabase
        .from('products')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return mapDbToAppProduct(insData);
    }
  } catch (e) {
    alert('Falha ao salvar no Supabase: ' + (e.message || e));
    return null;
  }
}

async function deleteProductSupabase(identifier) {
  const supabase = window.supabaseClient;
  if (!supabase) return false;
  try {
    let q = supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() });
    if (identifier?.id) q = q.eq('id', identifier.id);
    else if (identifier?.barcode) q = q.eq('barcode', identifier.barcode);
    else if (typeof identifier === 'string') q = q.eq('id', identifier);
    const { error } = await q;
    if (error) throw error;
    return true;
  } catch (e) {
    alert('Falha ao excluir no Supabase: ' + (e.message || e));
    return false;
  }
}

function backupInventoryIfEnabled() {
  try {
    const cfg = JSON.parse(localStorage.getItem('cfg') || '{}');
    if (!cfg?.cfgBackupAutoToggle) return;
    createInventoryBackup();
  } catch {}
}

function createInventoryBackup() {
  try {
    const s = window.INV_STATE || { products: [], stockMovements: [] };
    const snap = { at: new Date().toISOString(), products: s.products, stockMovements: s.stockMovements };
    const hist = JSON.parse(localStorage.getItem('inv.backups') || '[]');
    hist.unshift({ name: 'inv-' + new Date().toISOString(), createdAt: snap.at, count: s.products.length });
    localStorage.setItem('inv.backups', JSON.stringify(hist.slice(0, 50)));
    localStorage.setItem('inv.lastBackup', JSON.stringify(snap));
  } catch (e) {
    console.warn('Falha ao criar backup de estoque:', e);
  }
}

function renderInventoryFilters() {
  const s = window.INV_STATE;
  const catSel = document.getElementById('invFilterCategory');
  const supSel = document.getElementById('invFilterSupplier');
  if (!s || !catSel || !supSel) return;

  const cats = Array.from(new Set(s.products.map(p => p.category).filter(Boolean))).sort();
  const sups = Array.from(new Set(s.products.map(p => p.supplier).filter(Boolean))).sort();

  catSel.innerHTML = '<option value="">Todas as categorias</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  supSel.innerHTML = '<option value="">Todos os fornecedores</option>' + sups.map(v => `<option value="${v}">${v}</option>`).join('');
}

function renderInventoryList() {
  const s = window.INV_STATE;
  const grid = document.getElementById('invProductsGrid');
  if (!s || !grid) return;
  const q = (document.getElementById('invSearch')?.value || '').trim().toLowerCase();
  const fCat = document.getElementById('invFilterCategory')?.value || '';
  const fSup = document.getElementById('invFilterSupplier')?.value || '';
  const fStock = document.getElementById('invFilterStock')?.value || '';

  let items = s.products.slice();
  if (q) items = items.filter(p => (p.name||'').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q) || (p.barcode||'').toLowerCase().includes(q));
  if (fCat) items = items.filter(p => p.category === fCat);
  if (fSup) items = items.filter(p => p.supplier === fSup);
  if (fStock === 'low') items = items.filter(p => Number(p.stock||0) <= Number(p.minStock||0) && Number(p.stock||0) > 0);
  if (fStock === 'zero') items = items.filter(p => Number(p.stock||0) === 0);

  grid.innerHTML = '';
  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    const stockLabel = Number(p.stock||0) === 0 ? '<span style="color:#dc3545;font-weight:600;">Zerado</span>' : Number(p.stock||0) <= Number(p.minStock||0) ? '<span style="color:#fd7e14;font-weight:600;">Baixo</span>' : '<span style="color:#28a745;font-weight:600;">OK</span>';
    card.innerHTML = `
      <div class="product-image">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" onerror="this.style.display='none'">` : `<i class="fa-solid fa-box"></i>`}
      </div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">${fmtBRL(p.price||0)}</div>
      <div class="product-add">
        <button class="btn btn-secondary">Detalhes</button>
      </div>
      <div style="font-size:12px; color:#777; margin-top:6px;">Cod: ${p.barcode || '—'} • Estoque: ${Number(p.stock||0)} (${stockLabel})</div>
    `;
    const btn = card.querySelector('.btn');
    if (btn) btn.addEventListener('click', () => showInventoryProductDetails(p));
    card.addEventListener('click', () => showInventoryProductDetails(p));
    grid.appendChild(card);
  });
}

function showInventoryProductDetails(p) {
  window.INV_STATE.selectedProductId = p.id;
  setInventoryFormValues(p);
}

function setInventoryFormValues(p) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val ?? ''); };
  set('invBarcode', p.barcode);
  set('invName', p.name);
  set('invDescription', p.description);
  set('invCategory', p.category);
  set('invSupplier', p.supplier);
  set('invPrice', Number(p.price||0));
  set('invStock', Number(p.stock||0));
  set('invMinStock', Number(p.minStock||0));
  set('invImageUrl', p.image_url || '');
  set('invCost', Number(p.costPrice||0));
  set('invMarkupPercent', Number(p.markupPercent||0));
  const modeEl = document.getElementById('invPriceMode');
  if (modeEl) modeEl.value = (Number(p.markupPercent||0) > 0 ? 'percent' : 'fixed');
  const preview = document.getElementById('invImagePreview');
  if (preview) {
    if (p.image_url) { preview.src = p.image_url; preview.style.display = 'block'; }
    else { preview.src = ''; preview.style.display = 'none'; }
  }
  updatePricingUI();
}

function getInventoryFormValues() {
  const get = id => document.getElementById(id)?.value || '';
  const toNum = v => Number(v || 0);
  const mode = get('invPriceMode');
  const cost = toNum(get('invCost'));
  let price = toNum(get('invPrice'));
  const markup = toNum(get('invMarkupPercent'));
  if (mode === 'percent') {
    price = Number((cost * (1 + (markup/100))).toFixed(2));
    const priceEl = document.getElementById('invPrice');
    if (priceEl) priceEl.value = price;
  }
  return {
    id: window.INV_STATE.selectedProductId || null,
    barcode: get('invBarcode').trim(),
    name: get('invName').trim(),
    description: get('invDescription').trim(),
    category: get('invCategory').trim(),
    supplier: get('invSupplier').trim(),
    price,
    stock: toNum(get('invStock')),
    minStock: toNum(get('invMinStock')),
    image_url: get('invImageUrl').trim(),
    costPrice: cost,
    markupPercent: markup
  };
}

function updatePricingUI() {
  const get = id => document.getElementById(id);
  const costEl = get('invCost');
  const priceEl = get('invPrice');
  const modeEl = get('invPriceMode');
  const markupEl = get('invMarkupPercent');
  const infoEl = get('invMarginInfo');
  if (!priceEl || !costEl || !modeEl || !markupEl || !infoEl) return;
  const cost = Number(costEl.value || 0);
  let price = Number(priceEl.value || 0);
  const mode = modeEl.value;
  const markup = Number(markupEl.value || 0);
  if (mode === 'percent') {
    price = Number((cost * (1 + (markup/100))).toFixed(2));
    priceEl.value = price;
  }
  const profit = Number((price - cost).toFixed(2));
  const marginPercent = price > 0 ? Number(((profit / price) * 100).toFixed(2)) : 0;
  infoEl.textContent = `Preço: ${fmtBRL(price)} | Custo: ${fmtBRL(cost)} | Lucro: ${fmtBRL(profit)} | Margem: ${marginPercent}%`;
}

async function uploadProductImage(file, baseName = '') {
  try {
    const supabase = window.supabaseClient;
    if (!supabase?.storage) throw new Error('Storage indisponível');
    const bucket = supabase.storage.from('product-images');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeBase = (baseName || 'produto').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    const nowName = Date.now();
    const path = `${safeBase}/${nowName}.${ext}`;
    const ct = file.type || 'image/jpeg';
    const { data, error } = await bucket.upload(path, file, { contentType: ct });
    if (error) throw error;
    const { data: pub } = bucket.getPublicUrl(path);
    return pub?.publicUrl || null;
  } catch (e) {
    // Diagnósticos detalhados
    console.warn('Falha ao enviar imagem:', e);
    const status = e?.statusCode || e?.status || null;
    const code = e?.code || e?.error?.code || null;
    const msg = (e && (e.message || e.error?.message)) ? (e.message || e.error?.message) : String(e);
    let hint = '';
    if (/not found|bucket/i.test(msg)) hint = 'Bucket product-images não existe ou não está público.';
    else if (/policy|row-level|security|permission|RLS/i.test(msg)) hint = 'RLS não permite INSERT. Crie políticas para o bucket.';
    else if (/content[- ]?type/i.test(msg)) hint = 'Content-Type inválido. Tente imagem JPEG/PNG.';
    // Fallback via fetch para investigar o 400
    try {
      const baseUrl = window.SUPA_CFG?.url;
      const anonKey = window.SUPA_CFG?.key;
      if (baseUrl && anonKey && file) {
        const supabase = window.supabaseClient;
        const bucket = supabase?.storage?.from('product-images');
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const safeBase = (baseName || 'produto').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
        const nowName = Date.now();
        const path = `${safeBase}/${nowName}.${ext}`;
        const ct = file.type || 'image/jpeg';
        const reqUrl = `${baseUrl}/storage/v1/object/product-images/${path}`;
        const res = await fetch(reqUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': ct,
            'x-upsert': 'false'
          },
          body: file
        });
        let json = null;
        try { json = await res.clone().json(); } catch {}
        console.warn('Fallback upload resposta:', res.status, json);
        if (res.ok) {
          const { data: pub2 } = bucket?.getPublicUrl(path) || { data: null };
          return pub2?.publicUrl || null;
        } else {
          const errMsg = json?.message || `HTTP ${res.status}`;
          const errCode = json?.code || null;
          alert(`Falha no upload (fallback) — Storage.\nStatus: ${res.status}${errCode ? `\nCode: ${errCode}` : ''}\nMensagem: ${errMsg}`);
        }
      }
    } catch (fe) {
      console.warn('Fallback upload também falhou:', fe);
    }
    alert(`Não foi possível enviar a imagem ao Storage.\nStatus: ${status ?? 'desconhecido'}${code ? `\nCode: ${code}` : ''}\nMensagem: ${msg}\nDica: ${hint || 'Verifique URL/Anon Key, bucket e políticas.'}`);
    return null;
  }
}

function clearInventoryForm() {
  window.INV_STATE.selectedProductId = null;
  ['invBarcode','invName','invDescription','invCategory','invSupplier','invPrice','invStock','invMinStock']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function setupInventoryEvents() {
  const exportBtn = document.getElementById('invExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    alert('Exportar CSV demo: gerei dados em memória; integração pendente.');
  });

  // Imagem: arquivo, URL e busca externa
  const imgFile = document.getElementById('invImageFile');
  if (imgFile) imgFile.addEventListener('change', () => {
    const file = imgFile.files?.[0];
    const prev = document.getElementById('invImagePreview');
    if (file && prev) {
      const reader = new FileReader();
      reader.onload = e => { prev.src = e.target.result; prev.style.display='block'; };
      reader.readAsDataURL(file);
      window.INV_STATE.pendingImageFile = file;
    }
  });
  const imgUrl = document.getElementById('invImageUrl');
  if (imgUrl) imgUrl.addEventListener('input', () => {
    const url = imgUrl.value.trim();
    const prev = document.getElementById('invImagePreview');
    if (prev) {
      if (url) { prev.src = url; prev.style.display='block'; }
      else { prev.src=''; prev.style.display='none'; }
    }
  });
  const imgSearchBtn = document.getElementById('invImageSearchBtn');
  if (imgSearchBtn) imgSearchBtn.addEventListener('click', () => {
    const q = document.getElementById('invImageSearchQuery')?.value || document.getElementById('invName')?.value || '';
    const url = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q);
    window.open(url, '_blank');
  });

  // Precificação e margem
  ['invPriceMode','invCost','invMarkupPercent','invPrice'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updatePricingUI);
      el.addEventListener('change', updatePricingUI);
    }
  });

  const importFile = document.getElementById('invImportFile');
  if (importFile) importFile.addEventListener('change', () => {
    alert('Importar CSV demo: integração pendente.');
  });

  const scanBtn = document.getElementById('invScanBtn');
  if (scanBtn) scanBtn.addEventListener('click', () => {
    if (window.barcodeScanner) {
      window.barcodeScanner.onDetected = (result) => {
        const code = result?.codeResult?.code;
        if (code) {
          const input = document.getElementById('invBarcode');
          if (input) input.value = code;
          const found = window.INV_STATE.products.find(p => (p.barcode||'') === code);
          if (found) showInventoryProductDetails(found);
        }
        window.barcodeScanner.stopBarcodeScanner();
      };
      window.barcodeScanner.startBarcodeScanner();
    } else {
      alert('Leitor de código de barras indisponível.');
    }
  });

  const saveBtn = document.getElementById('invSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const data = getInventoryFormValues();
    if (!data.name) { alert('Informe o nome do produto.'); return; }

    // Upload de imagem pendente ao Storage
    if (window.INV_STATE?.pendingImageFile && window.supabaseClient) {
      const baseName = data.barcode || data.name || 'produto';
      const uploadedUrl = await uploadProductImage(window.INV_STATE.pendingImageFile, baseName);
      if (uploadedUrl) {
        data.image_url = uploadedUrl;
        const urlEl = document.getElementById('invImageUrl');
        if (urlEl) urlEl.value = uploadedUrl;
        const prev = document.getElementById('invImagePreview');
        if (prev) { prev.src = uploadedUrl; prev.style.display='block'; }
      }
      window.INV_STATE.pendingImageFile = null;
    }

    const s = window.INV_STATE;
    backupInventoryIfEnabled();
    let existing = null;
    if (data.id) existing = s.products.find(p => p.id === data.id);
    if (!existing && data.barcode) existing = s.products.find(p => (p.barcode||'') === data.barcode);
    let saved = null;
    if (window.supabaseClient) {
      const payload = existing ? { ...existing, ...data, id: existing.id } : data;
      saved = await saveProductSupabase(payload);
    }
    if (existing) {
      const updated = saved || { ...existing, ...data, id: existing.id };
      Object.assign(existing, updated);
      alert(saved ? 'Produto atualizado no Supabase.' : 'Produto atualizado localmente.');
    } else {
      const created = saved || { ...data, id: `P-${Math.floor(1000 + Math.random()*9000)}` };
      s.products.push(created);
      window.INV_STATE.selectedProductId = created.id;
      alert(saved ? 'Produto criado no Supabase.' : 'Produto criado localmente (Supabase indisponível).');
    }
    renderInventoryFilters();
    renderInventoryList();
  });

  const resetBtn = document.getElementById('invResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    clearInventoryForm();
  });

  const deleteBtn = document.getElementById('invDeleteBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', async () => {
    const s = window.INV_STATE;
    const id = s.selectedProductId;
    if (!id) { alert('Selecione um produto antes de excluir.'); return; }
    const product = s.products.find(p => p.id === id);
    backupInventoryIfEnabled();
    let ok = true;
    if (window.supabaseClient) {
      ok = await deleteProductSupabase(product);
    }
    s.products = s.products.filter(p => p.id !== id);
    clearInventoryForm();
    renderInventoryFilters();
    renderInventoryList();
    alert(ok ? 'Produto excluído.' : 'Produto excluído localmente (Supabase falhou).');
  });

  const applyBtn = document.getElementById('invApplyMovementBtn');
  if (applyBtn) applyBtn.addEventListener('click', async () => {
    const s = window.INV_STATE;
    const id = s.selectedProductId;
    if (!id) { alert('Selecione um produto para movimentar.'); return; }
    const type = document.getElementById('invMovementType')?.value || 'adjust';
    const qty = Number(document.getElementById('invMovementQty')?.value || 0);
    const reason = document.getElementById('invMovementReason')?.value || '';
    const product = s.products.find(p => p.id === id);
    if (!product) return;
    if (type === 'in') product.stock = Number(product.stock||0) + qty;
    else if (type === 'out') product.stock = Math.max(0, Number(product.stock||0) - qty);
    else product.stock = qty;
    backupInventoryIfEnabled();
    if (window.supabaseClient) {
      await saveProductSupabase(product);
      try {
        const supabase = window.supabaseClient;
        await supabase.from('stock_movements').insert({
          product_id: product.id,
          type,
          quantity: qty,
          reason,
          at: new Date().toISOString()
        });
      } catch (e) { /* tabela pode não existir; ignora */ }
    }
    s.stockMovements.push({ product_id:id, type, qty, reason, at: new Date().toISOString() });
    setInventoryFormValues(product);
    renderInventoryList();
    alert('Movimentação aplicada.');
  });

  const searchInput = document.getElementById('invSearch');
  if (searchInput) searchInput.addEventListener('input', debounce(renderInventoryList, 300));

  const fc = document.getElementById('invFilterCategory');
  const fs = document.getElementById('invFilterSupplier');
  const fsk = document.getElementById('invFilterStock');
  [fc, fs, fsk].forEach(sel => {
    if (sel) sel.addEventListener('change', renderInventoryList);
  });
}

function setupSidebarToggle() {
  const btn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('mainSidebar');
  const overlay = document.getElementById('mobileOverlay');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => {
    const collapsed = sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    if (overlay) overlay.classList.toggle('active', !collapsed);
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
    overlay.classList.remove('active');
  });
}