(function(){
  let initialized = false;
  let supabase = null;

  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v||0));
  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleDateString('pt-BR');
  };
  const toYMD = (d) => d ? new Date(d).toISOString().slice(0,10) : null;
  const startOfMonth = (dt) => { const d = new Date(dt); d.setDate(1); d.setHours(0,0,0,0); return d; };
  const endOfMonth = (dt) => { const d = new Date(dt); d.setMonth(d.getMonth()+1,0); d.setHours(23,59,59,999); return d; };

  window.initReportsOnce = function(){
    if (initialized) return;
    initialized = true;
    try { initSupabase?.(); } catch {}
    supabase = window.supabaseClient || null;

    const el = {
      repStart: document.getElementById('repStart'),
      repEnd: document.getElementById('repEnd'),
      repSumBalance: document.getElementById('repSumBalance'),
      repSumArPending: document.getElementById('repSumArPending'),
      repSumApPending: document.getElementById('repSumApPending'),
      repSumOverdue: document.getElementById('repSumOverdue'),
      repCashFlowBody: document.getElementById('repCashFlowBody'),
      repMethodsReceiptsBody: document.getElementById('repMethodsReceiptsBody'),
      repMethodsPaymentsBody: document.getElementById('repMethodsPaymentsBody'),
      repTopClientsBody: document.getElementById('repTopClientsBody'),
      repTopSuppliersBody: document.getElementById('repTopSuppliersBody'),
      repCategoriesBody: document.getElementById('repCategoriesBody'),
      repArPendingBody: document.getElementById('repArPendingBody'),
      repApPendingBody: document.getElementById('repApPendingBody'),
      repExportFlowBtn: document.getElementById('repExportFlowBtn'),
      repExportDetailsBtn: document.getElementById('repExportDetailsBtn'),
      repCashProjectionCanvas: document.getElementById('repCashProjectionChart'),
      repRevenueClientCanvas: document.getElementById('repRevenueByClientChart'),
      repRevenueClientDetails: document.getElementById('repRevenueClientDetails'),
    };

    const today = new Date();
    if (el.repStart) el.repStart.value = toYMD(startOfMonth(today));
    if (el.repEnd) el.repEnd.value = toYMD(endOfMonth(today));

    el.repStart?.addEventListener('change', () => loadAndRender(el));
    el.repEnd?.addEventListener('change', () => loadAndRender(el));
    el.repExportFlowBtn?.addEventListener('click', () => exportCashFlowCSV(window.REP_STATE?.cashflow || []));
    el.repExportDetailsBtn?.addEventListener('click', () => exportDetailsCSV(window.REP_STATE));

    loadAndRender(el);
  };

  async function loadAndRender(el){
    const start = el.repStart?.value ? new Date(el.repStart.value) : startOfMonth(new Date());
    const end = el.repEnd?.value ? new Date(el.repEnd.value) : endOfMonth(new Date());
    const state = window.REP_STATE = window.REP_STATE || { receipts:[], payments:[], arAccounts:[], apAccounts:[], cashflow:[] };

    if (supabase){
      try {
        const { data: receipts } = await supabase
          .from('receipts')
          .select('id, account_id, receipt_value, receipt_date, payment_method')
          .gte('receipt_date', toYMD(start))
          .lte('receipt_date', toYMD(end))
          .limit(2000);
        state.receipts = receipts || [];

        const { data: payments } = await supabase
          .from('payments')
          .select('id, account_id, payment_value, payment_date, payment_method')
          .gte('payment_date', toYMD(start))
          .lte('payment_date', toYMD(end))
          .limit(2000);
        state.payments = payments || [];

        const { data: ar } = await supabase
          .from('accounts_receivable')
          .select('*')
          .order('due_date', { ascending: true })
          .limit(5000);
        state.arAccounts = ar || [];

        const { data: ap } = await supabase
          .from('accounts_payable')
          .select('*')
          .order('due_date', { ascending: true })
          .limit(5000);
        state.apAccounts = ap || [];
      } catch (e){ console.warn('Supabase load error (reports)', e); }
    } else {
      // Fallbacks: usa estados locais se existirem
      const ARS = window.AR_STATE || { accounts: [], receipts: [] };
      state.arAccounts = ARS.accounts || [];
      state.receipts = (ARS.receipts || []).filter(r => inRange(new Date(r.receipt_date), start, end));
      const APS = window.AP_STATE || { accounts: [], payments: [] };
      state.apAccounts = APS.accounts || [];
      state.payments = (APS.payments || []).filter(p => inRange(new Date(p.payment_date), start, end));
    }

    renderSummary(el, state, start, end);
    renderCashFlow(el, state, start, end);
    renderBreakdowns(el, state);
    renderLists(el, state, start, end);
    renderCashProjectionChart(el, state, start, end);
    renderRevenueByClientChart(el, state, start, end);
  }

  function inRange(d, start, end){ const dt = new Date(d); return dt >= start && dt <= end; }

  function renderSummary(el, state, start, end){
    const pendingArValue = state.arAccounts
      .filter(a => a.status !== 'paid' && a.due_date && inRange(new Date(a.due_date), start, end))
      .reduce((sum, a) => sum + Math.max(0, Number(a.original_value||0) - Number(a.received_value||0)), 0);
    const pendingApValue = state.apAccounts
      .filter(a => a.status !== 'paid' && a.due_date && inRange(new Date(a.due_date), start, end))
      .reduce((sum, a) => sum + Math.max(0, Number(a.original_value||0) - Number(a.paid_value||0)), 0);

    const receiptsTotal = state.receipts.reduce((s, r) => s + Number(r.receipt_value||0), 0);
    const paymentsTotal = state.payments.reduce((s, p) => s + Number(p.payment_value||0), 0);
    const balance = receiptsTotal - paymentsTotal;

    const today = new Date();
    const overdueArCount = state.arAccounts.filter(a => a.status !== 'paid' && a.due_date && new Date(a.due_date) < today).length;
    const overdueApCount = state.apAccounts.filter(a => a.status !== 'paid' && a.due_date && new Date(a.due_date) < today).length;

    el.repSumBalance && (el.repSumBalance.textContent = fmtBRL(balance));
    el.repSumArPending && (el.repSumArPending.textContent = fmtBRL(pendingArValue));
    el.repSumApPending && (el.repSumApPending.textContent = fmtBRL(pendingApValue));
    el.repSumOverdue && (el.repSumOverdue.textContent = `${overdueArCount} / ${overdueApCount}`);
  }

  function renderCashFlow(el, state, start, end){
    const days = enumerateDays(start, end);
    const rByDay = groupByDay(state.receipts.map(r => ({ date: new Date(r.receipt_date), value: Number(r.receipt_value||0) })));
    const pByDay = groupByDay(state.payments.map(p => ({ date: new Date(p.payment_date), value: Number(p.payment_value||0) })));
    const rows = days.map(d => {
      const key = toYMD(d);
      const rec = rByDay[key] || 0;
      const pay = pByDay[key] || 0;
      return { date: d, receipts: rec, payments: pay, balance: rec - pay };
    });
    state.cashflow = rows;
    if (el.repCashFlowBody){
      el.repCashFlowBody.innerHTML = rows.map(r => `
        <tr>
          <td>${fmtDate(r.date)}</td>
          <td>${fmtBRL(r.receipts)}</td>
          <td>${fmtBRL(r.payments)}</td>
          <td>${fmtBRL(r.balance)}</td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align:center;color:#777;">Sem dados no período.</td></tr>';
    }
  }

  function enumerateDays(start, end){
    const days = []; const d = new Date(start); d.setHours(0,0,0,0);
    const e = new Date(end); e.setHours(0,0,0,0);
    const MAX_DAYS = 180;
    // Se o intervalo estiver invertido, corrige
    if (d > e){ const tmp = new Date(d); d.setTime(e.getTime()); e.setTime(tmp.getTime()); }
    let count = 0;
    while (d <= e && count < MAX_DAYS){
      days.push(new Date(d));
      d.setDate(d.getDate()+1);
      count++;
    }
    return days;
  }
  function groupByDay(items){
    const map = {};
    items.forEach(it => { const key = toYMD(it.date); map[key] = (map[key]||0) + Number(it.value||0); });
    return map;
  }

  function renderBreakdowns(el, state){
    // Métodos
    const recTotal = state.receipts.reduce((s, r) => s + Number(r.receipt_value||0), 0);
    const payTotal = state.payments.reduce((s, p) => s + Number(p.payment_value||0), 0);
    const recMeth = aggregateBy(state.receipts, r => r.payment_method || '—', r => Number(r.receipt_value||0));
    const payMeth = aggregateBy(state.payments, p => p.payment_method || '—', p => Number(p.payment_value||0));
    if (el.repMethodsReceiptsBody){
      el.repMethodsReceiptsBody.innerHTML = Object.entries(recMeth).map(([m, val]) => `
        <tr><td>${m}</td><td>${fmtBRL(val)}</td><td>${percent(val, recTotal)}</td></tr>
      `).join('') || '<tr><td colspan="3" style="text-align:center;color:#777;">Sem recebimentos.</td></tr>';
    }
    if (el.repMethodsPaymentsBody){
      el.repMethodsPaymentsBody.innerHTML = Object.entries(payMeth).map(([m, val]) => `
        <tr><td>${m}</td><td>${fmtBRL(val)}</td><td>${percent(val, payTotal)}</td></tr>
      `).join('') || '<tr><td colspan="3" style="text-align:center;color:#777;">Sem pagamentos.</td></tr>';
    }

    // Top Clientes por valor recebido (mapeia conta -> cliente)
    const arIndex = indexBy(state.arAccounts, a => String(a.id||''));
    const topClientsMap = aggregateBy(state.receipts, r => (arIndex[String(r.account_id||'')]?.client_name || '—'), r => Number(r.receipt_value||0));
    const topClients = sortEntries(topClientsMap).slice(0, 5);
    if (el.repTopClientsBody){ el.repTopClientsBody.innerHTML = topClients.map(([name, val]) => `
      <tr><td>${name}</td><td>${fmtBRL(val)}</td></tr>
    `).join('') || '<tr><td colspan="2" style="text-align:center;color:#777;">Sem dados.</td></tr>'; }

    // Top Fornecedores por valor pago
    const apIndex = indexBy(state.apAccounts, a => String(a.id||''));
    const topSuppliersMap = aggregateBy(state.payments, p => (apIndex[String(p.account_id||'')]?.supplier_name || '—'), p => Number(p.payment_value||0));
    const topSuppliers = sortEntries(topSuppliersMap).slice(0, 5);
    if (el.repTopSuppliersBody){ el.repTopSuppliersBody.innerHTML = topSuppliers.map(([name, val]) => `
      <tr><td>${name}</td><td>${fmtBRL(val)}</td></tr>
    `).join('') || '<tr><td colspan="2" style="text-align:center;color:#777;">Sem dados.</td></tr>'; }

    // Categorias de despesa
    const catMap = aggregateBy(state.payments, p => (apIndex[String(p.account_id||'')]?.category || '—'), p => Number(p.payment_value||0));
    const catEntries = sortEntries(catMap);
    const totalCats = catEntries.reduce((s, [,v]) => s+Number(v||0), 0);
    if (el.repCategoriesBody){ el.repCategoriesBody.innerHTML = catEntries.map(([cat, val]) => `
      <tr><td>${cat}</td><td>${fmtBRL(val)}</td><td>${percent(val, totalCats)}</td></tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center;color:#777;">Sem dados.</td></tr>'; }
  }

  function renderLists(el, state, start, end){
    const arPend = state.arAccounts.filter(a => a.status !== 'paid' && a.due_date && inRange(new Date(a.due_date), start, end));
    const apPend = state.apAccounts.filter(a => a.status !== 'paid' && a.due_date && inRange(new Date(a.due_date), start, end));
    if (el.repArPendingBody){ el.repArPendingBody.innerHTML = arPend.map(a => {
      const remaining = Math.max(0, Number(a.original_value||0) - Number(a.received_value||0));
      const isOverdue = new Date(a.due_date) < new Date();
      return `
        <tr>
          <td>${a.client_name||'—'}</td>
          <td>${a.description||'—'}</td>
          <td>${fmtBRL(remaining)}</td>
          <td>${fmtDate(a.due_date)} ${isOverdue ? '<span class="badge badge-danger">Vencida</span>' : ''}</td>
          <td>${mapStatusLabel(a.status)}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#777;">Nenhuma conta.</td></tr>'; }

    if (el.repApPendingBody){ el.repApPendingBody.innerHTML = apPend.map(a => {
      const remaining = Math.max(0, Number(a.original_value||0) - Number(a.paid_value||0));
      const isOverdue = new Date(a.due_date) < new Date();
      return `
        <tr>
          <td>${a.supplier_name||'—'}</td>
          <td>${a.description||'—'}</td>
          <td>${fmtBRL(remaining)}</td>
          <td>${fmtDate(a.due_date)} ${isOverdue ? '<span class="badge badge-danger">Vencida</span>' : ''}</td>
          <td>${mapStatusLabel(a.status)}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#777;">Nenhuma conta.</td></tr>'; }
  }

  function aggregateBy(arr, keyFn, valFn){ const map = {}; (arr||[]).forEach(it => { const k = keyFn(it); map[k] = (map[k]||0) + Number(valFn(it)||0); }); return map; }
  function indexBy(arr, keyFn){ const m = {}; (arr||[]).forEach(it => { m[keyFn(it)] = it; }); return m; }
  function sortEntries(obj){ return Object.entries(obj).sort((a,b) => Number(b[1]||0) - Number(a[1]||0)); }
  function percent(val, total){ const v = Number(val||0), t = Number(total||0); if (!t) return '0%'; return `${(v*100/t).toFixed(1)}%`; }
  function mapStatusLabel(s){ const map = { pending:'Pendente', overdue:'Vencida', partial:'Parcial', paid:'Paga' }; return map[s] || s || '—'; }

  function exportCashFlowCSV(rows){
    if (!Array.isArray(rows) || rows.length === 0){ alert('Sem dados para exportar.'); return; }
    const headers = ['Data','Recebimentos','Pagamentos','Saldo'];
    const lines = rows.map(r => [fmtDate(r.date), Number(r.receipts||0).toFixed(2), Number(r.payments||0).toFixed(2), Number(r.balance||0).toFixed(2)]);
    downloadCSV('fluxo_caixa.csv', [headers, ...lines]);
  }
  function exportDetailsCSV(state){
    const recMeth = aggregateBy(state.receipts, r => r.payment_method || '—', r => Number(r.receipt_value||0));
    const payMeth = aggregateBy(state.payments, p => p.payment_method || '—', p => Number(p.payment_value||0));
    const lines = [['Tipo','Chave','Valor']]
      .concat(Object.entries(recMeth).map(([k,v]) => ['Recebimentos (Método)', k, Number(v||0).toFixed(2)]))
      .concat(Object.entries(payMeth).map(([k,v]) => ['Pagamentos (Método)', k, Number(v||0).toFixed(2)]));
    downloadCSV('detalhes_relatorio.csv', lines);
  }
  function downloadCSV(filename, rows){
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'\"')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function renderCashProjectionChart(el, state, start, end){
    const canvas = el.repCashProjectionCanvas;
    if (!canvas || typeof Chart === 'undefined') return;
    window.REP_CHARTS = window.REP_CHARTS || {};
    if (window.REP_CHARTS.cashProjection){ window.REP_CHARTS.cashProjection.destroy(); }

    const days = enumerateDays(start, end);
    const arMap = {}; const apMap = {};
    (state.arAccounts||[]).forEach(a => {
      if (a.status === 'paid' || !a.due_date) return;
      const d = new Date(a.due_date); if (d < start || d > end) return;
      const k = toYMD(d); const rem = Math.max(0, Number(a.original_value||0) - Number(a.received_value||0));
      arMap[k] = (arMap[k]||0) + rem;
    });
    (state.apAccounts||[]).forEach(a => {
      if (a.status === 'paid' || !a.due_date) return;
      const d = new Date(a.due_date); if (d < start || d > end) return;
      const k = toYMD(d); const rem = Math.max(0, Number(a.original_value||0) - Number(a.paid_value||0));
      apMap[k] = (apMap[k]||0) + rem;
    });

    const labels = days.map(d => d.toLocaleDateString('pt-BR'));
    const arVals = days.map(d => arMap[toYMD(d)]||0);
    const apVals = days.map(d => apMap[toYMD(d)]||0);
    const netVals = arVals.map((v, i) => v - (apVals[i]||0));

    // Fix canvas size to avoid responsive resize loops
    const containerWidth = canvas.parentElement ? canvas.parentElement.clientWidth : canvas.clientWidth;
    canvas.width = (containerWidth && containerWidth > 0) ? containerWidth : 600;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');
    window.REP_CHARTS.cashProjection = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Receber', data: arVals, borderColor: '#28a745', backgroundColor: 'rgba(40,167,69,0.15)', tension: 0.2 },
          { label: 'Pagar', data: apVals, borderColor: '#dc3545', backgroundColor: 'rgba(220,53,69,0.15)', tension: 0.2 },
          { label: 'Saldo', data: netVals, borderColor: '#007bff', backgroundColor: 'rgba(0,123,255,0.12)', tension: 0.2 }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { ticks: { maxTicksLimit: 12, autoSkip: true }, grid: { display: false } },
          y: { ticks: { callback: (val) => `R$ ${Number(val||0).toFixed(0)}` }, beginAtZero: true }
        }
      }
    });
  }

  function renderRevenueByClientChart(el, state, start, end){
    const canvas = el.repRevenueClientCanvas;
    const details = el.repRevenueClientDetails;
    if (!canvas || typeof Chart === 'undefined') return;
    window.REP_CHARTS = window.REP_CHARTS || {};
    if (window.REP_CHARTS.revenueByClient){ window.REP_CHARTS.revenueByClient.destroy(); }

    const arIndex = indexBy(state.arAccounts, a => String(a.id||''));
    const map = aggregateBy(state.receipts, r => (arIndex[String(r.account_id||'')]?.client_name || '—'), r => Number(r.receipt_value||0));
    const entries = sortEntries(map).slice(0, 10);
    const labels = entries.map(([name]) => name);
    const values = entries.map(([,val]) => Number(val||0));

    const ctx = canvas.getContext('2d');
    const chart = window.REP_CHARTS.revenueByClient = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Receita', data: values, backgroundColor: '#007bff' }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (val) => `R$ ${Number(val||0).toFixed(0)}` } } }
      }
    });

    canvas.onclick = (evt) => {
      const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
      if (!points.length) return;
      const idx = points[0].index; const client = labels[idx];
      const rows = (state.receipts||[]).filter(r => (arIndex[String(r.account_id||'')]?.client_name||'—') === client);
      if (details){
        details.innerHTML = `
          <div class="drill-header">${client} • ${rows.length} recebimentos</div>
          <table>
            <thead><tr><th>Data</th><th>Método</th><th>Valor</th></tr></thead>
            <tbody>
              ${rows.map(r => `<tr><td>${fmtDate(r.receipt_date)}</td><td>${r.payment_method||'—'}</td><td>${fmtBRL(r.receipt_value)}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
    };
  }
})();