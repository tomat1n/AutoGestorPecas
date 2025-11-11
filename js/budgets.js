// budgets.js — Módulo de Orçamentos
// Responsável por inicializar a aba, buscar serviços/peças, gerenciar itens,
// calcular totais, listar orçamentos e converter em OS.

(() => {
  'use strict';

  // Utilidades (fallbacks)
  const fmtBRL = (window.fmtBRL || ((v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v||0))));
  const debounce = (window.debounce || ((fn, delay=300) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), delay); }; }));

  let BUDGETS_INITIALIZED = false;
  window.initBudgetsOnce = function initBudgetsOnce() {
    if (!BUDGETS_INITIALIZED) {
      BUDGETS_INITIALIZED = true;
      window.BUDGETS_DB = window.BUDGETS_DB || [];
      window.BUDGET_STATE = window.BUDGET_STATE || { current: null };
      loadBudgetsDB();
      setupBudgetsEvents();
    }
    createNewBudget();
    renderBudgetsSummary();
  };

  function loadBudgetsDB(){
    try { const raw = localStorage.getItem('BUDGETS_DB'); window.BUDGETS_DB = raw ? JSON.parse(raw) : []; }
    catch { window.BUDGETS_DB = []; }
  }
  function saveBudgetsDB(){
    try { localStorage.setItem('BUDGETS_DB', JSON.stringify(window.BUDGETS_DB||[])); } catch {}
  }

  function generateBudgetId(){ return 'B' + Date.now(); }

  function switchBudgetMode(mode){
    const f = document.getElementById('bdModeForm');
    const l = document.getElementById('bdModeList');
    if (!f || !l) return;
    if (mode === 'list'){ f.style.display = 'none'; l.style.display = 'block'; }
    else { f.style.display = 'block'; l.style.display = 'none'; }
  }

  function getChecklistList(){
    try {
      if (typeof window.getChecklists === 'function') return window.getChecklists();
      return JSON.parse(localStorage.getItem('checklists')||'[]');
    } catch { return []; }
  }

  function loadChecklistOptions(selectedId){
    const sel = document.getElementById('bdChecklistSelect');
    if (!sel) return;
    const list = getChecklistList();
    const makeOpt = (c) => {
      const fotos = (c.photos?.length||0);
      const label = `${c.plate||'(sem placa)'} • ${c.type||'-'} • Fotos: ${fotos}`;
      return `<option value="${c.id}">${label}</option>`;
    };
    sel.innerHTML = '<option value="">Selecione um checklist</option>' + list.map(makeOpt).join('');
    if (selectedId) sel.value = String(selectedId);
  }

  function renderChecklistPreview(selectedId){
    const summaryEl = document.getElementById('bdChecklistSummary');
    const photosEl = document.getElementById('bdChecklistPhotos');
    if (!summaryEl || !photosEl) return;
    const list = getChecklistList();
    const chk = list.find(c => String(c.id) === String(selectedId));
    if (!chk){
      summaryEl.textContent = 'Nenhum checklist selecionado.';
      photosEl.innerHTML = '';
      return;
    }
    const flags = [];
    if (chk.items?.lightsIssue) flags.push('Luzes');
    if (chk.items?.panelWarn) flags.push('Painel');
    if (chk.items?.bodyDamage) flags.push('Lataria');
    const flagStr = flags.length ? `Avarias: ${flags.join(', ')}` : 'Sem avarias registradas';
    const notesStr = (chk.notes ? ` • Obs.: ${chk.notes}` : '');
    summaryEl.textContent = `${chk.plate||'(sem placa)'} • ${chk.type||'-'} • ${flagStr}${notesStr}`;
    const thumbs = (chk.photos||[]).slice(0, 6).map((src, idx) => 
      `<div class="photo-item"><img src="${src}" alt="foto ${idx+1}"/></div>`
    ).join('');
    photosEl.innerHTML = thumbs || '<div style="color:#6b7280">Sem fotos</div>';
  }

  function createNewBudget(){
    const validitySel = document.getElementById('bdValidityDays');
    const days = Number(validitySel?.value || 7);
    window.BUDGET_STATE.current = {
      id: generateBudgetId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      validityDays: days,
      client: { name: '', phone: '', email: '' },
      vehicle: { type: 'carro', plate: '', model: '', year: '' },
      items: [],
      checklistId: null,
      checklistInclude: true
    };
    clearBudgetForm();
    loadChecklistOptions();
    renderChecklistPreview(null);
    renderBudgetItems();
    calcBudgetTotals();
    switchBudgetMode('form');
  }

  function clearBudgetForm(){
    const set = (id, v='') => { const el = document.getElementById(id); if (el) el.value = v; };
    set('bdClientName'); set('bdClientPhone'); set('bdClientEmail');
    set('bdVehicleType','carro'); set('bdVehiclePlate'); set('bdVehicleModel'); set('bdVehicleYear');
    set('bdChecklistSelect','');
    const incSel = document.getElementById('bdChecklistInclude'); if (incSel) incSel.value = 'true';
  }

  function setupBudgetsEvents(){
    const newBtn = document.getElementById('bdNewBtn'); if (newBtn) newBtn.addEventListener('click', createNewBudget);
    const listBtn = document.getElementById('bdListBtn'); if (listBtn) listBtn.addEventListener('click', () => { switchBudgetMode('list'); renderBudgetsList(); });
    const exportBtn = document.getElementById('bdExportBtn'); if (exportBtn) exportBtn.addEventListener('click', exportBudgetsCSV);
    const headWhatsBtn = document.getElementById('bdWhatsBtn'); if (headWhatsBtn) headWhatsBtn.addEventListener('click', sendBudgetWhats);

    const svcSearch = document.getElementById('bdServiceSearch'); if (svcSearch) svcSearch.addEventListener('input', debounce(() => searchBudgetServices(svcSearch.value.trim()), 300));
    const partSearch = document.getElementById('bdPartSearch'); if (partSearch) partSearch.addEventListener('input', debounce(() => searchBudgetParts(partSearch.value.trim()), 300));

    const saveBtn = document.getElementById('saveBudgetBtn'); if (saveBtn) saveBtn.addEventListener('click', saveBudget);
    const printBtn = document.getElementById('printBudgetBtn'); if (printBtn) printBtn.addEventListener('click', printBudgetA4);
    const pdfBtn = document.getElementById('pdfBudgetBtn'); if (pdfBtn) pdfBtn.addEventListener('click', printBudgetA4);
    const whatsBtn = document.getElementById('whatsBudgetBtn'); if (whatsBtn) whatsBtn.addEventListener('click', sendBudgetWhats);

    const chkSel = document.getElementById('bdChecklistSelect');
    if (chkSel){
      loadChecklistOptions();
      chkSel.addEventListener('change', () => {
        const b = window.BUDGET_STATE.current; if (!b) return;
        const v = chkSel.value || '';
        b.checklistId = v ? Number(v) : null;
        renderChecklistPreview(b.checklistId);
      });
    }
    const chkRefresh = document.getElementById('bdChecklistRefreshBtn'); if (chkRefresh) chkRefresh.addEventListener('click', () => loadChecklistOptions(window.BUDGET_STATE?.current?.checklistId));
    const chkOpen = document.getElementById('bdChecklistOpenBtn'); if (chkOpen) chkOpen.addEventListener('click', () => { if (typeof window.navigateTo === 'function') window.navigateTo('checklist'); });
    const chkInclude = document.getElementById('bdChecklistInclude'); if (chkInclude) chkInclude.addEventListener('change', () => { const b = window.BUDGET_STATE.current; if (b) b.checklistInclude = (chkInclude.value === 'true') || !!chkInclude.checked; });

    const fStatus = document.getElementById('bdFilterStatus'); if (fStatus) fStatus.addEventListener('change', renderBudgetsList);
    const fType = document.getElementById('bdFilterType'); if (fType) fType.addEventListener('change', renderBudgetsList);
    const fPeriod = document.getElementById('bdFilterPeriod'); if (fPeriod) fPeriod.addEventListener('change', renderBudgetsList);
    const fSearch = document.getElementById('bdSearchTerm'); if (fSearch) fSearch.addEventListener('input', debounce(renderBudgetsList, 300));
  }

  async function searchBudgetServices(term){
    const resultsEl = document.getElementById('bdServiceResults');
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    if (!term || term.length < 1) return;
    const supabase = window.supabaseClient;
    if (!supabase) return;
    const { data } = await supabase
      .from('services')
      .select('*')
      .or(`name.ilike.%${term}%,category.ilike.%${term}%,description.ilike.%${term}%`)
      .eq('is_active', true)
      .order('name', { ascending: true })
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
      if (btn) btn.addEventListener('click', () => addBudgetService({ id: svc.id, name: svc.name, price: Number(svc.price||0) }, 1));
      resultsEl.appendChild(card);
    });
  }

  async function searchBudgetParts(term){
    const resultsEl = document.getElementById('bdPartResults');
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    if (!term || term.length < 1) return;
    const supabase = window.supabaseClient;
    if (!supabase) return;
    const { data } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${term}%,description.ilike.%${term}%,barcode.eq.${term}`)
      .eq('is_active', true)
      .order('name', { ascending: true })
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
      if (btn) btn.addEventListener('click', () => addBudgetPart({ id: p.id, name: p.name, price: Number(p.price||0), product_id: p.id }, 1));
      resultsEl.appendChild(card);
    });
  }

  function addBudgetService(service, qty = 1){
    const b = window.BUDGET_STATE.current;
    if (!b) return;
    const existing = b.items.find(i => i.type==='service' && i.id === service.id);
    if (existing) existing.quantity += qty; else b.items.push({ type:'service', ...service, quantity: qty });
    renderBudgetItems(); calcBudgetTotals();
  }
  function addBudgetPart(part, qty = 1){
    const b = window.BUDGET_STATE.current;
    if (!b) return;
    const key = part.product_id||part.id;
    const existing = b.items.find(i => i.type==='part' && (i.product_id||i.id) === key);
    if (existing) existing.quantity += qty; else b.items.push({ type:'part', ...part, quantity: qty });
    renderBudgetItems(); calcBudgetTotals();
  }

  function renderBudgetItems(){
    const b = window.BUDGET_STATE.current; if (!b) return;
    const container = document.getElementById('bdItemsList'); if (!container) return;
    container.innerHTML = '';
    b.items.forEach((it, idx) => {
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
      if (dec) dec.addEventListener('click', () => { it.quantity = Math.max(1, Number(it.quantity)-1); qtyInput.value = it.quantity; renderBudgetItems(); calcBudgetTotals(); });
      if (inc) inc.addEventListener('click', () => { it.quantity = Number(it.quantity)+1; qtyInput.value = it.quantity; renderBudgetItems(); calcBudgetTotals(); });
      if (qtyInput) qtyInput.addEventListener('input', () => { const v = Math.max(1, Number(qtyInput.value||1)); it.quantity = v; renderBudgetItems(); calcBudgetTotals(); });
      if (remove) remove.addEventListener('click', () => { b.items.splice(idx,1); renderBudgetItems(); calcBudgetTotals(); });
      container.appendChild(row);
    });
  }

  function calcBudgetTotals(){
    const b = window.BUDGET_STATE.current; if (!b) return { services:0, parts:0, total:0 };
    const sv = b.items.filter(i=>i.type==='service').reduce((sum,i)=> sum + Number(i.price||0)*Number(i.quantity||1), 0);
    const pt = b.items.filter(i=>i.type==='part').reduce((sum,i)=> sum + Number(i.price||0)*Number(i.quantity||1), 0);
    const total = sv + pt;
    const setText = (id,val) => { const el = document.getElementById(id); if (el) el.textContent = fmtBRL(val); };
    setText('bdSubServices', sv); setText('bdSubParts', pt); setText('bdGrandTotal', total);
    return { services: sv, parts: pt, total };
  }

  function readBudgetFormIntoState(){
    const b = window.BUDGET_STATE.current; if (!b) return;
    const get = (id) => document.getElementById(id)?.value || '';
    b.client = { name: get('bdClientName'), phone: get('bdClientPhone'), email: get('bdClientEmail') };
    b.vehicle = { type: get('bdVehicleType')||'carro', plate: get('bdVehiclePlate'), model: get('bdVehicleModel'), year: get('bdVehicleYear') };
    b.validityDays = Number(get('bdValidityDays')||b.validityDays||7);
    const chkIdStr = get('bdChecklistSelect');
    const incStr = document.getElementById('bdChecklistInclude')?.value;
    b.checklistId = chkIdStr ? Number(chkIdStr) : null;
    b.checklistInclude = incStr ? (incStr === 'true') : (b.checklistInclude ?? true);
  }

  function saveBudget(){
    readBudgetFormIntoState();
    const b = window.BUDGET_STATE.current; if (!b) return;
    const idx = (window.BUDGETS_DB||[]).findIndex(x => x.id === b.id);
    if (idx >= 0) window.BUDGETS_DB[idx] = { ...b };
    else (window.BUDGETS_DB = window.BUDGETS_DB || []).push({ ...b });
    saveBudgetsDB();
    renderBudgetsSummary();
    switchBudgetMode('list');
    renderBudgetsList();
    try { alert('Orçamento salvo com sucesso!'); } catch {}
  }

  function renderBudgetsSummary(){
    const arr = window.BUDGETS_DB || [];
    const now = new Date();
    const expiredIds = new Set();
    arr.forEach(b => { if (b.status === 'pending') { const dt = new Date(new Date(b.createdAt).getTime() + (Number(b.validityDays||7)*86400000)); if (now > dt) expiredIds.add(b.id); } });
    const pending = arr.filter(b => b.status === 'pending' && !expiredIds.has(b.id)).length;
    const approved = arr.filter(b => b.status === 'approved').length;
    const rejected = arr.filter(b => b.status === 'rejected').length;
    const expired = arr.filter(b => b.status === 'pending' && expiredIds.has(b.id)).length + arr.filter(b => b.status === 'expired').length;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
    setVal('bdSumPending', pending); setVal('bdSumApproved', approved); setVal('bdSumRejected', rejected); setVal('bdSumExpired', expired);
  }

  function formatBudgetStatus(b){
    const now = new Date();
    const expAt = new Date(new Date(b.createdAt).getTime() + (Number(b.validityDays||7)*86400000));
    const isExpired = (b.status === 'pending' && now > expAt) || b.status === 'expired';
    if (b.status === 'approved') return 'Aprovado';
    if (b.status === 'rejected') return 'Recusado';
    return isExpired ? 'Expirado' : 'Pendente';
  }

  function renderBudgetsList(){
    const cont = document.getElementById('bdListContainer'); if (!cont) return;
    const arr = (window.BUDGETS_DB||[]).slice();
    const status = document.getElementById('bdFilterStatus')?.value || 'all';
    const type = document.getElementById('bdFilterType')?.value || 'all';
    const period = document.getElementById('bdFilterPeriod')?.value || '30d';
    const term = (document.getElementById('bdSearchTerm')?.value || '').toLowerCase();
    const sinceMs = period==='all' ? 0 : (period==='7d'?7:period==='90d'?90:30) * 86400000;
    const since = sinceMs ? new Date(Date.now() - sinceMs) : null;
    const filtered = arr.filter(b => {
      const st = formatBudgetStatus(b).toLowerCase();
      if (status!=='all' && st !== status) return false;
      if (type!=='all' && (b.vehicle?.type||'').toLowerCase() !== type) return false;
      if (since && new Date(b.createdAt) < since) return false;
      const text = `${b.id} ${b.client?.name||''} ${b.vehicle?.plate||''} ${b.vehicle?.model||''}`.toLowerCase();
      if (term && !text.includes(term)) return false;
      return true;
    });
    cont.innerHTML = '';
    if (filtered.length === 0){ cont.innerHTML = '<div class="empty-state">Nenhum orçamento encontrado.</div>'; return; }
    filtered.forEach(b => {
      const totals = b.items.reduce((sum, i) => sum + Number(i.price||0)*Number(i.quantity||1), 0);
      const card = document.createElement('div');
      card.className = 'os-result-card';
      card.innerHTML = `
        <div class="os-result-title">#${b.id} • ${b.client?.name||'Sem cliente'}</div>
        <div class="os-result-price">${fmtBRL(totals)}</div>
        <div class="os-result-add">
          <button class="btn btn-primary" data-action="open">Abrir</button>
          <button class="btn btn-secondary" data-action="dup">Duplicar</button>
          <button class="btn btn-success" data-action="approve">Aprovar</button>
          <button class="btn btn-danger" data-action="reject">Recusar</button>
          <button class="btn btn-info" data-action="tos">Converter OS</button>
        </div>
      `;
      const open = card.querySelector('[data-action="open"]');
      const dup = card.querySelector('[data-action="dup"]');
      const approve = card.querySelector('[data-action="approve"]');
      const reject = card.querySelector('[data-action="reject"]');
      const tos = card.querySelector('[data-action="tos"]');
      if (open) open.addEventListener('click', () => openBudget(b.id));
      if (dup) dup.addEventListener('click', () => duplicateBudget(b.id));
      if (approve) approve.addEventListener('click', () => updateBudgetStatus(b.id, 'approved'));
      if (reject) reject.addEventListener('click', () => updateBudgetStatus(b.id, 'rejected'));
      if (tos) tos.addEventListener('click', () => convertBudgetToOS(b.id));
      cont.appendChild(card);
    });
  }

  function openBudget(id){
    const b = (window.BUDGETS_DB||[]).find(x => x.id === id); if (!b) return;
    window.BUDGET_STATE.current = JSON.parse(JSON.stringify(b));
    const set = (id,v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('bdClientName', b.client?.name||'');
    set('bdClientPhone', b.client?.phone||'');
    set('bdClientEmail', b.client?.email||'');
    set('bdVehicleType', b.vehicle?.type||'carro');
    set('bdVehiclePlate', b.vehicle?.plate||'');
    set('bdVehicleModel', b.vehicle?.model||'');
    set('bdVehicleYear', b.vehicle?.year||'');
    set('bdValidityDays', b.validityDays||7);
    loadChecklistOptions(b.checklistId||null);
    const incSel = document.getElementById('bdChecklistInclude'); if (incSel) incSel.value = (b.checklistInclude ? 'true' : 'false');
    const chkSel = document.getElementById('bdChecklistSelect'); if (chkSel) chkSel.value = b.checklistId ? String(b.checklistId) : '';
    renderChecklistPreview(b.checklistId||null);
    renderBudgetItems(); calcBudgetTotals(); switchBudgetMode('form');
  }

  function duplicateBudget(id){
    const b = (window.BUDGETS_DB||[]).find(x => x.id === id); if (!b) return;
    const copy = { ...b, id: generateBudgetId(), status: 'pending', createdAt: new Date().toISOString() };
    (window.BUDGETS_DB = window.BUDGETS_DB||[]).push(copy);
    saveBudgetsDB(); renderBudgetsList(); renderBudgetsSummary();
  }

  function updateBudgetStatus(id, status){
    const idx = (window.BUDGETS_DB||[]).findIndex(x => x.id === id); if (idx < 0) return;
    window.BUDGETS_DB[idx].status = status;
    if (status === 'approved') window.BUDGETS_DB[idx].approvedAt = new Date().toISOString();
    if (status === 'rejected') window.BUDGETS_DB[idx].rejectedAt = new Date().toISOString();
    saveBudgetsDB(); renderBudgetsList(); renderBudgetsSummary();
  }

  function convertBudgetToOS(id){
    const b = (window.BUDGETS_DB||[]).find(x => x.id === id); if (!b) return;
    if (typeof window.navigateTo === 'function') window.navigateTo('os');
    setTimeout(() => {
      try {
        const map = [
          ['clientName', b.client?.name||''],
          ['clientPhone', b.client?.phone||''],
          ['clientEmail', b.client?.email||''],
          ['vehiclePlate', b.vehicle?.plate||''],
          ['vehicleModel', b.vehicle?.model||''],
          ['vehicleYear', b.vehicle?.year||'']
        ];
        map.forEach(([id,val]) => { const el = document.getElementById(id); if (el) el.value = val; });
        window.OS_STATE = window.OS_STATE || { services: [], parts: [], client: {}, vehicle: {} };
        window.OS_STATE.services = [];
        window.OS_STATE.parts = [];
        (b.items||[]).forEach(it => {
          if (it.type === 'service' && typeof window.addService === 'function') window.addService({ id: it.id, name: it.name, price: it.price }, Number(it.quantity||1));
          else if (it.type === 'part' && typeof window.addPart === 'function') window.addPart({ product_id: it.product_id||it.id, id: it.id, name: it.name, price: it.price }, Number(it.quantity||1));
        });
        if (typeof window.renderOSItems === 'function'){ window.renderOSItems('services'); window.renderOSItems('parts'); }
        if (typeof window.renderOSPreview === 'function') window.renderOSPreview();
      } catch (e) { console.warn('Falha na conversão para OS:', e); }
    }, 300);
  }

  function exportBudgetsCSV(){
    const rows = (window.BUDGETS_DB||[]).map(b => ({
      id: b.id,
      status: formatBudgetStatus(b),
      cliente: b.client?.name||'',
      telefone: b.client?.phone||'',
      email: b.client?.email||'',
      placa: b.vehicle?.plate||'',
      modelo: b.vehicle?.model||'',
      tipo: b.vehicle?.type||'',
      validade_dias: b.validityDays||'',
      total: (b.items||[]).reduce((sum,i)=> sum + Number(i.price||0)*Number(i.quantity||1), 0),
      checklist_id: b.checklistId || '',
      checklist_fotos: (() => { const c = getChecklistList().find(x => String(x.id) === String(b.checklistId)); return c?.photos?.length||0; })()
    }));
    const header = Object.keys(rows[0]||{id:'id'});
    const csv = [header.join(','), ...rows.map(r => header.map(k => JSON.stringify(String(r[k] ?? '')).replace(/^"|"$/g,'')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'orcamentos.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 500);
  }

  function printBudgetA4(){
    window.print?.();
  }

  function sendBudgetWhats(){
    readBudgetFormIntoState();
    const b = window.BUDGET_STATE.current; if (!b) return;
    const total = calcBudgetTotals().total;
    const lines = [
      `Orçamento #${b.id}`,
      `${b.client?.name||'Cliente'} - ${b.vehicle?.type||''} ${b.vehicle?.model||''} ${b.vehicle?.plate||''}`,
      '',
      ...(b.items||[]).map(i => `• ${i.name} x${i.quantity} — ${fmtBRL(Number(i.price||0)*Number(i.quantity||1))}`),
      '',
      `Total: ${fmtBRL(total)}`,
      `Validade: ${b.validityDays||7} dias`
    ];
    if (b.checklistInclude && b.checklistId){
      const chk = getChecklistList().find(c => String(c.id) === String(b.checklistId));
      if (chk){
        const flags = [];
        if (chk.items?.lightsIssue) flags.push('Luzes');
        if (chk.items?.panelWarn) flags.push('Painel');
        if (chk.items?.bodyDamage) flags.push('Lataria');
        lines.push('', 'Checklist do veículo:', `• Placa: ${chk.plate||'-'} • Tipo: ${chk.type||'-'}`);
        lines.push(`• Avarias: ${flags.length ? flags.join(', ') : 'Nenhuma'}`);
        if (chk.notes) lines.push(`• Observações: ${chk.notes}`);
        lines.push(`• Fotos registradas: ${chk.photos?.length||0}`);
      }
    }
    const text = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }

})();