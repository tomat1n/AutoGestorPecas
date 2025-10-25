(function(){
  let initialized = false;
  let supabase = null;
  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v||0));
  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleDateString('pt-BR');
  };
  const id = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'ar_' + Math.random().toString(36).slice(2, 10);
  const addDays = (dt, n) => { const d = new Date(dt); d.setDate(d.getDate()+n); return d; };

  window.initReceivablesOnce = function(){
    if (initialized) return;
    initialized = true;

    // Supabase init
    try { initSupabase?.(); } catch {}
    supabase = window.supabaseClient || null;

    const el = {
      arExportBtn: document.getElementById('arExportBtn'),
      arNewReceiptBtn: document.getElementById('arNewReceiptBtn'),
      arSumPending: document.getElementById('arSumPending'),
      arSumOverdue: document.getElementById('arSumOverdue'),
      arSumReceived: document.getElementById('arSumReceived'),
      arSumWeekDue: document.getElementById('arSumWeekDue'),
      filterStatus: document.getElementById('arFilterStatus'),
      filterStart: document.getElementById('arFilterStart'),
      filterEnd: document.getElementById('arFilterEnd'),
      search: document.getElementById('arSearch'),
      tableBody: document.getElementById('arTableBody'),
      form: document.getElementById('arForm'),
      clientName: document.getElementById('arClientName'),
      clientId: document.getElementById('arClientId'),
      description: document.getElementById('arDescription'),
      originalValue: document.getElementById('arOriginalValue'),
      receivedValue: document.getElementById('arReceivedValue'),
      dueDate: document.getElementById('arDueDate'),
      issueDate: document.getElementById('arIssueDate'),
      docNumber: document.getElementById('arDocNumber'),
      category: document.getElementById('arCategory'),
      status: document.getElementById('arStatus'),
      observations: document.getElementById('arObservations'),
      saveBtn: document.getElementById('arSaveBtn'),
      resetBtn: document.getElementById('arResetBtn'),
      deleteBtn: document.getElementById('arDeleteBtn'),
      whatsBtn: document.getElementById('arWhatsBtn'),
      // receipt modal
      receiptModal: document.getElementById('receiptModal'),
      closeReceiptModal: document.getElementById('closeReceiptModal'),
      rcpAccountSelect: document.getElementById('rcpAccountSelect'),
      rcpValue: document.getElementById('rcpValue'),
      rcpDate: document.getElementById('rcpDate'),
      rcpMethod: document.getElementById('rcpMethod'),
      rcpObs: document.getElementById('rcpObs'),
      saveReceiptBtn: document.getElementById('saveReceiptBtn'),
    };

    const state = window.AR_STATE = window.AR_STATE || { accounts: [], receipts: [], selectedId: null };

    // Load from Supabase if available, else seed demo
    if (supabase) { loadAccountsFromSupabase(el, state).catch(err => { console.warn('Supabase load error', err); }); }
    seedDemoIfEmpty(state);
    bindHeader(el, state);
    bindFilters(el, state);
    bindForm(el, state);
    bindModal(el, state);
    renderAll(el, state);
  };

  function seedDemoIfEmpty(state){
    if (state.accounts && state.accounts.length) return;
    const today = new Date();
    state.accounts = [
      { id:id(), client_id:null, client_name:'João Pereira', description:'Venda de pastilhas de freio', original_value:350.00, received_value:100.00, due_date:addDays(today,2), issue_date:addDays(today,-5), document_number:'VR-0001', category:'venda', status:'partial', observations:'' },
      { id:id(), client_id:null, client_name:'Maria Silva', description:'Serviço troca de óleo', original_value:120.00, received_value:0, due_date:addDays(today,-3), issue_date:addDays(today,-10), document_number:'VR-0002', category:'servico', status:'overdue', observations:'Cliente solicita prorrogação' },
      { id:id(), client_id:null, client_name:'Auto Peças Lima', description:'Venda de filtros ar/óleo', original_value:560.00, received_value:560.00, due_date:addDays(today,-1), issue_date:addDays(today,-15), document_number:'VR-0003', category:'venda', status:'paid', observations:'Pago à vista' },
      { id:id(), client_id:null, client_name:'Carlos Nunes', description:'Venda bateria 60Ah', original_value:420.00, received_value:0, due_date:addDays(today,5), issue_date:addDays(today,-2), document_number:'VR-0004', category:'venda', status:'pending', observations:'Preferência PIX' },
    ];
  }

  function bindHeader(el, state){
    el.arExportBtn?.addEventListener('click', () => exportCSV(state.accounts));
    el.arNewReceiptBtn?.addEventListener('click', () => openReceiptModal(el, state));
  }

  function bindFilters(el, state){
    const rerender = () => renderTable(el, state);
    el.search?.addEventListener('input', debounced(rerender, 250));
    el.filterStatus?.addEventListener('change', rerender);
    el.filterStart?.addEventListener('change', rerender);
    el.filterEnd?.addEventListener('change', rerender);
  }

  function bindForm(el, state){
    el.saveBtn?.addEventListener('click', async () => {
      const data = getFormData(el);
      const errors = validateAccount(data);
      if (errors.length){ alert(errors.join('\n')); return; }
      applyBusinessStatus(data);
      if (state.selectedId){
        const acc = state.accounts.find(a => a.id === state.selectedId);
        if (acc){ Object.assign(acc, data, { id: acc.id }); }
        // Supabase update
        if (supabase && acc){ await upsertAccountSupabase(acc, true).catch(err => console.warn('Supabase update error', err)); }
        alert('Conta atualizada.');
      } else {
        const newAcc = { ...data, id: id() };
        state.accounts.push(newAcc);
        state.selectedId = newAcc.id;
        // Supabase insert
        if (supabase){ const ok = await upsertAccountSupabase(newAcc, false).catch(err => console.warn('Supabase insert error', err)); if (ok?.id){ newAcc.id = ok.id; state.selectedId = ok.id; } }
        alert('Conta criada.');
      }
      renderAll(el, state);
    });

    el.resetBtn?.addEventListener('click', () => { clearForm(el); state.selectedId = null; });
    el.deleteBtn?.addEventListener('click', async () => {
      if (!state.selectedId){ alert('Selecione uma conta para excluir.'); return; }
      const delId = state.selectedId;
      state.accounts = state.accounts.filter(a => a.id !== delId);
      state.selectedId = null;
      clearForm(el);
      renderAll(el, state);
      if (supabase){ await deleteAccountSupabase(delId).catch(err => console.warn('Supabase delete error', err)); }
      alert('Conta excluída.');
    });

    el.whatsBtn?.addEventListener('click', async () => {
      const data = getFormData(el);
      if (!data.client_name || !data.description || !data.due_date || !data.original_value){
        alert('Preencha Cliente, Descrição, Vencimento e Valor antes de enviar o WhatsApp.');
        return;
      }
      const msg = `Olá ${data.client_name}, aqui é da AutoGestor.\n`+
                  `Lembrete: ${data.description}.\n`+
                  `Vencimento: ${fmtDate(data.due_date)}. Valor: ${fmtBRL(data.original_value)}.\n`+
                  `Caso já tenha pago, desconsidere. Obrigado!`;
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      if (supabase){ await logCommunicationSupabase({ client_id: data.client_id||null, account_id: state.selectedId||null, message: msg }).catch(err => console.warn('Supabase comm error', err)); }
    });
  }

  function bindModal(el, state){
    el.closeReceiptModal?.addEventListener('click', () => closeReceiptModal(el));
    el.saveReceiptBtn?.addEventListener('click', () => saveReceipt(el, state));
  }

  function getFormData(el){
    const toNum = (v) => Number(String(v||'').replace(',','.')) || 0;
    return {
      client_id: el.clientId?.value || null,
      client_name: (el.clientName?.value || '').trim(),
      description: (el.description?.value || '').trim(),
      original_value: toNum(el.originalValue?.value),
      received_value: toNum(el.receivedValue?.value),
      due_date: el.dueDate?.value ? new Date(el.dueDate.value) : null,
      issue_date: el.issueDate?.value ? new Date(el.issueDate.value) : new Date(),
      document_number: (el.docNumber?.value || '').trim(),
      category: el.category?.value || 'venda',
      status: el.status?.value || 'pending',
      observations: (el.observations?.value || '').trim(),
    };
  }

  function setFormData(el, acc){
    if (!acc) return;
    el.clientId && (el.clientId.value = acc.client_id || '');
    el.clientName && (el.clientName.value = acc.client_name || '');
    el.description && (el.description.value = acc.description || '');
    el.originalValue && (el.originalValue.value = Number(acc.original_value||0).toFixed(2));
    el.receivedValue && (el.receivedValue.value = Number(acc.received_value||0).toFixed(2));
    el.dueDate && (el.dueDate.value = acc.due_date ? new Date(acc.due_date).toISOString().slice(0,10) : '');
    el.issueDate && (el.issueDate.value = acc.issue_date ? new Date(acc.issue_date).toISOString().slice(0,10) : '');
    el.docNumber && (el.docNumber.value = acc.document_number || '');
    el.category && (el.category.value = acc.category || 'venda');
    el.status && (el.status.value = acc.status || 'pending');
    el.observations && (el.observations.value = acc.observations || '');
  }

  function clearForm(el){
    ['clientId','clientName','description','originalValue','receivedValue','dueDate','issueDate','docNumber','observations'].forEach(k => {
      const e = el[k];
      if (e) e.value = '';
    });
    if (el.category) el.category.value = 'venda';
    if (el.status) el.status.value = 'pending';
  }

  function validateAccount(data){
    const errs = [];
    if (!data.client_name) errs.push('Cliente é obrigatório.');
    if (!data.description) errs.push('Descrição é obrigatória.');
    if (!data.due_date) errs.push('Data de vencimento é obrigatória.');
    if (Number(data.original_value||0) <= 0) errs.push('Valor original deve ser maior que zero.');
    return errs;
  }

  function applyBusinessStatus(acc){
    const remaining = Math.max(0, Number(acc.original_value||0) - Number(acc.received_value||0));
    if (remaining <= 0) { acc.status = 'paid'; acc.paid_date = acc.paid_date || new Date(); }
    else if (acc.due_date && new Date(acc.due_date) < new Date()) { acc.status = 'overdue'; }
    else if (Number(acc.received_value||0) > 0) { acc.status = 'partial'; }
    else { acc.status = acc.status || 'pending'; }
    return acc;
  }

  function renderAll(el, state){
    renderSummary(el, state);
    renderTable(el, state);
    fillReceiptAccounts(el, state);
  }

  function renderSummary(el, state){
    const today = new Date();
    const weekEnd = addDays(today, 7);
    let pendingTotal = 0, overdueCount = 0, receivedCount = 0, weekDueCount = 0;
    state.accounts.forEach(a => {
      const due = new Date(a.due_date);
      const remaining = Number(a.original_value||0) - Number(a.received_value||0);
      if (a.status === 'paid' || remaining <= 0) receivedCount += 1;
      else {
        pendingTotal += Math.max(0, remaining);
        if (due < today) overdueCount += 1;
        if (due >= today && due <= weekEnd) weekDueCount += 1;
      }
    });
    if (el.arSumPending) el.arSumPending.textContent = fmtBRL(pendingTotal);
    if (el.arSumOverdue) el.arSumOverdue.textContent = String(overdueCount);
    if (el.arSumReceived) el.arSumReceived.textContent = String(receivedCount);
    if (el.arSumWeekDue) el.arSumWeekDue.textContent = String(weekDueCount);
  }

  function applyFilters(el, state){
    const q = (el.search?.value || '').trim().toLowerCase();
    const status = el.filterStatus?.value || '';
    const dStart = el.filterStart?.value ? new Date(el.filterStart.value) : null;
    const dEnd = el.filterEnd?.value ? new Date(el.filterEnd.value) : null;
    let items = state.accounts.slice();
    if (q) items = items.filter(a => (a.client_name||'').toLowerCase().includes(q) || (a.description||'').toLowerCase().includes(q) || (a.document_number||'').toLowerCase().includes(q));
    if (status) items = items.filter(a => a.status === status);
    if (dStart) items = items.filter(a => new Date(a.issue_date) >= dStart || new Date(a.due_date) >= dStart);
    if (dEnd) items = items.filter(a => new Date(a.issue_date) <= dEnd || new Date(a.due_date) <= dEnd);
    return items.sort((a,b) => new Date(a.due_date) - new Date(b.due_date));
  }

  function renderTable(el, state){
    const rows = applyFilters(el, state).map((a, idx) => {
      const remaining = Math.max(0, Number(a.original_value||0) - Number(a.received_value||0));
      const statusLabel = mapStatusLabel(a.status);
      const isOverdue = (a.status !== 'paid') && (new Date(a.due_date) < new Date());
      return `
        <tr data-id="${a.id}">
          <td>${idx+1}</td>
          <td>${a.client_name}</td>
          <td>${a.description}</td>
          <td>${fmtBRL(a.original_value)}</td>
          <td>${fmtBRL(a.received_value)}</td>
          <td>${fmtBRL(remaining)}</td>
          <td>${fmtDate(a.due_date)} ${isOverdue ? '<span class="badge badge-danger">Vencida</span>' : ''}</td>
          <td>${statusLabel}</td>
          <td>
            <button class="btn btn-secondary btn-edit">Editar</button>
            <button class="btn btn-success btn-receive">Receber</button>
          </td>
        </tr>
      `;
    }).join('');
    if (el.tableBody) el.tableBody.innerHTML = rows || '<tr><td colspan="9" style="text-align:center;color:#777;">Nenhuma conta encontrada.</td></tr>';
    attachRowEvents(el, state);
  }

  function attachRowEvents(el, state){
    el.tableBody?.querySelectorAll('tr').forEach(tr => {
      const id = tr.getAttribute('data-id');
      const acc = state.accounts.find(a => a.id === id);
      const btnEdit = tr.querySelector('.btn-edit');
      const btnReceive = tr.querySelector('.btn-receive');
      if (btnEdit) btnEdit.addEventListener('click', () => { state.selectedId = id; setFormData(el, acc); });
      if (btnReceive) btnReceive.addEventListener('click', () => { state.selectedId = id; openReceiptModal(el, state, id); });
    });
  }

  function mapStatusLabel(s){
    const map = { pending:'Pendente', overdue:'Vencida', partial:'Parcial', paid:'Recebida' };
    return map[s] || s || '—';
  }

  function fillReceiptAccounts(el, state){
    if (!el.rcpAccountSelect) return;
    const opts = state.accounts.map(a => `<option value="${a.id}">${a.client_name} — ${a.description} (${fmtBRL(a.original_value)})</option>`).join('');
    el.rcpAccountSelect.innerHTML = '<option value="">Selecione...</option>' + opts;
  }

  function openReceiptModal(el, state, accountId){
    fillReceiptAccounts(el, state);
    if (accountId && el.rcpAccountSelect){ el.rcpAccountSelect.value = accountId; }
    if (el.rcpDate) el.rcpDate.value = new Date().toISOString().slice(0,10);
    el.receiptModal?.classList.add('active');
  }

  function closeReceiptModal(el){ el.receiptModal?.classList.remove('active'); }

  async function saveReceipt(el, state){
    const accountId = el.rcpAccountSelect?.value || state.selectedId;
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc){ alert('Selecione uma conta válida.'); return; }
    const val = Number(el.rcpValue?.value || 0);
    const dt = el.rcpDate?.value ? new Date(el.rcpDate.value) : new Date();
    const method = el.rcpMethod?.value || 'Dinheiro';
    const obs = el.rcpObs?.value || '';
    if (val <= 0){ alert('Valor do recebimento deve ser maior que zero.'); return; }
    acc.received_value = Number(acc.received_value||0) + val;
    const remaining = Math.max(0, Number(acc.original_value||0) - Number(acc.received_value||0));
    if (remaining <= 0){ acc.status = 'paid'; acc.paid_date = dt; } else { acc.status = 'partial'; }
    state.receipts.push({ id:id(), account_id: acc.id, receipt_value: val, receipt_date: dt, payment_method: method, observations: obs, created_at: new Date().toISOString() });
    if (supabase){ await saveReceiptSupabase({ account_id: acc.id, receipt_value: val, receipt_date: dt, payment_method: method, observations: obs }).catch(err => console.warn('Supabase receipt error', err)); await upsertAccountSupabase({ ...acc, payment_method: method, payment_observations: obs }, true).catch(err => console.warn('Supabase account update error', err)); }
    alert('Recebimento registrado.');
    closeReceiptModal(el);
    renderAll(el, state);
  }

  function exportCSV(accounts){
    if (!Array.isArray(accounts) || accounts.length === 0){ alert('Nada para exportar.'); return; }
    const headers = ['Cliente','Descrição','Valor Original','Recebido','Restante','Vencimento','Emissão','Documento','Categoria','Status'];
    const rows = accounts.map(a => [
      a.client_name,
      a.description,
      Number(a.original_value||0).toFixed(2),
      Number(a.received_value||0).toFixed(2),
      Math.max(0, Number(a.original_value||0) - Number(a.received_value||0)).toFixed(2),
      fmtDate(a.due_date),
      fmtDate(a.issue_date),
      a.document_number||'',
      a.category||'',
      mapStatusLabel(a.status)
    ]);
    const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'\"')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contas_a_receber.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // Supabase helpers
  async function loadAccountsFromSupabase(el, state){
    try {
      const { data, error } = await supabase.from('accounts_receivable').select('*').order('due_date', { ascending:true });
      if (error) throw error;
      if (Array.isArray(data)) { state.accounts = data.map(a => ({ ...a })); renderAll(el, state); }
    } catch (err) { throw err; }
  }

  function toDBAccount(acc){
    const toYMD = (d) => d ? new Date(d).toISOString().slice(0,10) : null;
    const daysUntil = acc.due_date ? Math.ceil((new Date(acc.due_date) - new Date()) / 86400000) : null;
    return {
      client_id: acc.client_id || null,
      client_name: acc.client_name,
      description: acc.description,
      original_value: Number(acc.original_value||0),
      received_value: Number(acc.received_value||0),
      due_date: toYMD(acc.due_date),
      issue_date: toYMD(acc.issue_date),
      document_number: acc.document_number || null,
      category: acc.category || 'venda',
      status: acc.status || 'pending',
      observations: acc.observations || null,
      days_until_due: daysUntil,
      paid_date: toYMD(acc.paid_date),
      payment_method: acc.payment_method || null,
      payment_observations: acc.payment_observations || null,
      updated_at: new Date().toISOString()
    };
  }

  async function upsertAccountSupabase(acc, isUpdate){
    const payload = toDBAccount(acc);
    if (isUpdate){ await supabase.from('accounts_receivable').update(payload).eq('id', acc.id); return { id: acc.id }; }
    else { const { data } = await supabase.from('accounts_receivable').insert(payload).select('id').single(); return data || null; }
  }

  async function deleteAccountSupabase(id){ await supabase.from('accounts_receivable').delete().eq('id', id); }

  async function saveReceiptSupabase(rcp){
    const toYMD = (d) => d ? new Date(d).toISOString().slice(0,10) : null;
    const payload = { account_id: rcp.account_id, receipt_value: Number(rcp.receipt_value||0), receipt_date: toYMD(rcp.receipt_date), payment_method: rcp.payment_method||null, observations: rcp.observations||null };
    await supabase.from('receipts').insert(payload);
  }

  async function logCommunicationSupabase({ client_id, account_id, message }){
    await supabase.from('client_communications').insert({ client_id: client_id||null, account_id: account_id||null, type:'whatsapp', message, sent_by: null, sent_at: new Date().toISOString() });
  }

  function debounced(fn, ms){ let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); } }
})();