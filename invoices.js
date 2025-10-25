// ==============================
// Notas Fiscais (NF-e)  módulo
// ==============================

let NF_INITIALIZED = false;
let NF_STATE = {
  invoices: [],
  filtered: [],
  selectedId: null,
  filters: {
    q: '',
    type: '',
    status: '',
    start: null,
    end: null,
  }
};

function initInvoicesOnce() {
  if (NF_INITIALIZED) return;
  NF_INITIALIZED = true;
  try {
    initNFDefaultDates();
    NF_STATE.invoices = initDemoInvoices();
    setupNFEvents();
    applyNFFiltersAndRender();
  } catch (e) {
    console.error('Falha ao inicializar Notas Fiscais:', e);
  }
}

function initNFDefaultDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = d => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const startEl = document.getElementById('nfFilterStart');
  const endEl = document.getElementById('nfFilterEnd');
  if (startEl) startEl.value = fmt(start);
  if (endEl) endEl.value = fmt(end);
  NF_STATE.filters.start = startEl?.value || null;
  NF_STATE.filters.end = endEl?.value || null;
}

function setupNFEvents() {
  const byId = id => document.getElementById(id);
  byId('nfSearch')?.addEventListener('input', e => {
    NF_STATE.filters.q = e.target.value.trim();
    applyNFFiltersAndRender();
  });
  byId('nfFilterType')?.addEventListener('change', e => {
    NF_STATE.filters.type = e.target.value;
    applyNFFiltersAndRender();
  });
  byId('nfFilterStatus')?.addEventListener('change', e => {
    NF_STATE.filters.status = e.target.value;
    applyNFFiltersAndRender();
  });
  byId('nfFilterStart')?.addEventListener('change', e => {
    NF_STATE.filters.start = e.target.value || null;
    applyNFFiltersAndRender();
  });
  byId('nfFilterEnd')?.addEventListener('change', e => {
    NF_STATE.filters.end = e.target.value || null;
    applyNFFiltersAndRender();
  });
  byId('nfNewBtn')?.addEventListener('click', () => {
    alert('Emissão de NF-e: funcionalidade será integrada ao fluxo de venda/OS.');
  });
  byId('nfExportBtn')?.addEventListener('click', exportNFToCSV);
  byId('nfImportFile')?.addEventListener('change', handleNFImportXML);
  byId('nfDownloadXMLBtn')?.addEventListener('click', downloadNFSelectedXML);
  byId('nfPrintDanfeBtn')?.addEventListener('click', printNFSelectedDanfe);
}

function applyNFFiltersAndRender() {
  const { q, type, status, start, end } = NF_STATE.filters;
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;

  let items = [...NF_STATE.invoices];
  if (q) {
    const term = normalizeStr(q);
    items = items.filter(nf => {
      return [nf.number, nf.series, nf.key, nf.party]
        .map(normalizeStr)
        .some(v => v.includes(term));
    });
  }
  if (type) items = items.filter(nf => nf.type === type);
  if (status) items = items.filter(nf => nf.status === status);
  if (startDate) items = items.filter(nf => new Date(nf.issue) >= startDate);
  if (endDate) items = items.filter(nf => new Date(nf.issue) <= endDate);

  items.sort((a,b) => new Date(b.issue) - new Date(a.issue));
  NF_STATE.filtered = items;

  renderNFSummary(items);
  renderNFTable(items);
  renderNFDetails(NF_STATE.selectedId);
}

function renderNFSummary(items) {
  const count = items.length;
  const total = items.reduce((sum, nf) => sum + (nf.total || 0), 0);
  const cancelled = items.filter(nf => nf.status === 'cancelada').length;
  const authorized = items.filter(nf => nf.status === 'autorizada').length;
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText('nfSumCount', String(count));
  setText('nfSumTotal', formatBRL(total));
  setText('nfSumCancelled', String(cancelled));
  setText('nfSumAuthorized', String(authorized));
}

function renderNFTable(items) {
  const tbody = document.getElementById('nfTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (items.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.textContent = 'Nenhuma nota encontrada para os filtros.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  items.forEach((nf, idx) => {
    const tr = document.createElement('tr');
    tr.className = nf.id === NF_STATE.selectedId ? 'selected' : '';
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${nf.number}/${nf.series}</td>
      <td>${nf.type === 'saida' ? 'Saída' : 'Entrada'}</td>
      <td>${nf.party}</td>
      <td class="mono">${nf.key || ''}</td>
      <td>${formatDate(nf.issue)}</td>
      <td>${formatBRL(nf.total)}</td>
      <td>${nfStatusLabel(nf.status)}</td>
      <td>
        <button class="btn btn-xs" data-action="view"><i class="fa-solid fa-eye"></i></button>
      </td>
    `;
    tr.addEventListener('click', () => {
      NF_STATE.selectedId = nf.id;
      renderNFDetails(nf.id);
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
    });
    const actionBtn = tr.querySelector('button[data-action="view"]');
    actionBtn?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      NF_STATE.selectedId = nf.id;
      renderNFDetails(nf.id);
    });
    tbody.appendChild(tr);
  });
}

function renderNFDetails(id) {
  const nf = NF_STATE.filtered.find(n => n.id === id) || NF_STATE.invoices.find(n => n.id === id);
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value ?? ''; };
  if (!nf) {
    set('nfDetNumber', '');
    set('nfDetSeries', '');
    set('nfDetType', '');
    set('nfDetEmit', '');
    set('nfDetDest', '');
    set('nfDetKey', '');
    set('nfDetIssue', '');
    set('nfDetTotal', '');
    const itemsBody = document.getElementById('nfItemsBody');
    if (itemsBody) itemsBody.innerHTML = '';
    return;
  }
  set('nfDetNumber', nf.number);
  set('nfDetSeries', nf.series);
  set('nfDetType', nf.type === 'saida' ? 'Saída' : 'Entrada');
  set('nfDetEmit', nf.emitter || '');
  set('nfDetDest', nf.recipient || '');
  set('nfDetKey', nf.key || '');
  set('nfDetIssue', formatDate(nf.issue));
  set('nfDetTotal', formatBRL(nf.total));

  const itemsBody = document.getElementById('nfItemsBody');
  if (itemsBody) {
    itemsBody.innerHTML = '';
    (nf.items || []).forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${item.code}</td>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td>${formatBRL(item.unit)}</td>
        <td>${formatBRL(item.total)}</td>
      `;
      itemsBody.appendChild(tr);
    });
  }
}

function handleNFImportXML(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const xml = String(reader.result || '').replace(/\r?\n/g,'');
    try {
      const parsed = parseBasicNFeXML(xml);
      if (!parsed) throw new Error('XML não reconhecido ou incompleto.');
      NF_STATE.invoices.push(parsed);
      alert('XML importado com sucesso. Nota adicionada.');
      applyNFFiltersAndRender();
      // Reset input
      e.target.value = '';
    } catch (err) {
      console.error('Falha ao importar XML:', err);
      alert('Falha ao importar XML. Verifique o arquivo.');
    }
  };
  reader.onerror = () => alert('Falha ao ler arquivo XML.');
  reader.readAsText(file, 'utf-8');
}

function parseBasicNFeXML(xml) {
  // Extração simples (best effort) sem validar schema  apenas campos básicos
  const get = (re) => (xml.match(re) || [null, null])[1]?.trim();
  const number = get(/<nNF>(.*?)<\/nNF>/);
  const series = get(/<serie>(.*?)<\/serie>/);
  const key = get(/<infNFe\s+Id=\"NFe(\d{44})\"/);
  const issue = get(/<dhEmi>(.*?)<\/dhEmi>/) || get(/<dEmi>(.*?)<\/dEmi>/);
  const total = parseFloat(get(/<vNF>(.*?)<\/vNF>/) || '0') || 0;
  const emitName = get(/<emit>[\s\S]*?<xNome>(.*?)<\/xNome>[\s\S]*?<\/emit>/);
  const destName = get(/<dest>[\s\S]*?<xNome>(.*?)<\/xNome>[\s\S]*?<\/dest>/);

  if (!number || !series || !issue) return null;
  const items = [];
  const detRegex = /<det[\s\S]*?<cProd>(.*?)<\/cProd>[\s\S]*?<xProd>(.*?)<\/xProd>[\s\S]*?<qCom>(.*?)<\/qCom>[\s\S]*?<vUnCom>(.*?)<\/vUnCom>[\s\S]*?<vProd>(.*?)<\/vProd>[\s\S]*?<\/det>/g;
  let m;
  while ((m = detRegex.exec(xml)) !== null) {
    const [code, desc, q, unit, tot] = [m[1], m[2], parseFloat(m[3]||'0'), parseFloat(m[4]||'0'), parseFloat(m[5]||'0')];
    items.push({ code, description: desc, quantity: q, unit, total: tot });
  }

  return {
    id: `NF-${Date.now()}`,
    number,
    series,
    type: 'saida',
    party: destName || emitName || '-',
    key: key || '',
    issue: issue,
    total,
    status: 'emitida',
    emitter: emitName || '-',
    recipient: destName || '-',
    items
  };
}

function exportNFToCSV() {
  const rows = [
    ['numero','serie','tipo','cliente_fornecedor','chave','emissao','valor','status']
  ];
  NF_STATE.filtered.forEach(nf => {
    rows.push([
      nf.number,
      nf.series,
      nf.type,
      nf.party,
      nf.key,
      nf.issue,
      nf.total,
      nf.status
    ]);
  });
  const csv = rows.map(r => r.map(v => String(v).replace(/"/g,'""')).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notas-fiscais-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

function downloadNFSelectedXML() {
  const nf = NF_STATE.invoices.find(n => n.id === NF_STATE.selectedId);
  if (!nf) { alert('Selecione uma nota.'); return; }
  const xml = buildBasicXMLForNF(nf);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NF-${nf.number}-${nf.series}.xml`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

function buildBasicXMLForNF(nf) {
  const esc = s => String(s||'').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  const items = (nf.items||[]).map((it,i) => `
    <det nItem="${i+1}">
      <prod>
        <cProd>${esc(it.code)}</cProd>
        <xProd>${esc(it.description)}</xProd>
        <qCom>${it.quantity}</qCom>
        <vUnCom>${it.unit.toFixed(2)}</vUnCom>
        <vProd>${it.total.toFixed(2)}</vProd>
      </prod>
    </det>
  `).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
  <nfeProc>
    <NFe>
      <infNFe Id="NFe${esc(nf.key||'')}" versao="4.00">
        <ide>
          <nNF>${esc(nf.number)}</nNF>
          <serie>${esc(nf.series)}</serie>
          <dhEmi>${esc(nf.issue)}</dhEmi>
        </ide>
        <emit><xNome>${esc(nf.emitter||'-')}</xNome></emit>
        <dest><xNome>${esc(nf.recipient||'-')}</xNome></dest>
        ${items}
        <total><ICMSTot><vNF>${(nf.total||0).toFixed(2)}</vNF></ICMSTot></total>
      </infNFe>
    </NFe>
  </nfeProc>`;
}

function printNFSelectedDanfe() {
  const nf = NF_STATE.invoices.find(n => n.id === NF_STATE.selectedId);
  if (!nf) { alert('Selecione uma nota.'); return; }
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <html><head><title>DANFE NF ${nf.number}/${nf.series}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px; font-size: 12px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    </style>
    </head><body>
    <h1>DANFE  NF ${nf.number}/${nf.series}</h1>
    <div>Emitente: ${nf.emitter || '-'}</div>
    <div>Destinatário: ${nf.recipient || '-'}</div>
    <div>Chave: <span class="mono">${nf.key || '-'}</span></div>
    <div>Emissão: ${formatDate(nf.issue)}</div>
    <div>Total: ${formatBRL(nf.total)}</div>
    <h3>Itens</h3>
    <table>
      <thead><tr><th>Código</th><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead>
      <tbody>
        ${(nf.items||[]).map(it => `<tr><td class="mono">${it.code}</td><td>${it.description}</td><td>${it.quantity}</td><td>${formatBRL(it.unit)}</td><td>${formatBRL(it.total)}</td></tr>`).join('')}
      </tbody>
    </table>
    <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
    </body></html>
  `);
  win.document.close();
}

function initDemoInvoices() {
  // Dados de demonstração
  const padKey = () => Array.from({length:44}, () => Math.floor(Math.random()*10)).join('');
  const today = new Date();
  const d = (offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate()-offset).toISOString();
  const mkItem = (code, desc, q, unit) => ({ code, description: desc, quantity: q, unit, total: q*unit });
  return [
    { id:'NF-1001', number:'1001', series:'1', type:'saida', party:'Carlos Silva', key:padKey(), issue:d(1), total:349.9, status:'autorizada', emitter:'Auto Gestor Peças LTDA', recipient:'Carlos Silva', items:[mkItem('P-1002','Pastilha de Freio Dianteira',1,159.9), mkItem('P-1001','Filtro de Óleo GM',1,49.9), mkItem('Serv-001','Mão de obra',1,140.0)] },
    { id:'NF-1002', number:'1002', series:'1', type:'saida', party:'Maria Souza', key:padKey(), issue:d(3), total:599.0, status:'emitida', emitter:'Auto Gestor Peças LTDA', recipient:'Maria Souza', items:[mkItem('P-1003','Bateria 60Ah',1,599.0)] },
    { id:'NF-1003', number:'1003', series:'1', type:'entrada', party:'Moura SA', key:padKey(), issue:d(5), total:1897.5, status:'autorizada', emitter:'Moura SA', recipient:'Auto Gestor Peças LTDA', items:[mkItem('P-1003','Bateria 60Ah',5,379.5)] },
    { id:'NF-1004', number:'1004', series:'1', type:'saida', party:'João Pedro', key:padKey(), issue:d(6), total:89.9, status:'cancelada', emitter:'Auto Gestor Peças LTDA', recipient:'João Pedro', items:[mkItem('P-1004','Lâmpada H7 55W',2,39.9), mkItem('Serv-002','Instalação',1,10.1)] },
    { id:'NF-1005', number:'1005', series:'1', type:'entrada', party:'Cobreq', key:padKey(), issue:d(8), total:855.4, status:'autorizada', emitter:'Cobreq', recipient:'Auto Gestor Peças LTDA', items:[mkItem('P-1002','Pastilha de Freio Dianteira',6,142.567)] },
    { id:'NF-1006', number:'1006', series:'2', type:'saida', party:'Empresa X', key:padKey(), issue:d(10), total:229.9, status:'emitida', emitter:'Auto Gestor Peças LTDA', recipient:'Empresa X', items:[mkItem('P-1006','Filtro de Ar Motor',2,69.9), mkItem('P-1005','Aditivo Long Life',3,29.9)] },
    { id:'NF-1007', number:'1007', series:'2', type:'saida', party:'Fulano de Tal', key:padKey(), issue:d(11), total:159.9, status:'autorizada', emitter:'Auto Gestor Peças LTDA', recipient:'Fulano de Tal', items:[mkItem('P-1002','Pastilha de Freio Dianteira',1,159.9)] },
    { id:'NF-1008', number:'1008', series:'3', type:'entrada', party:'Mahle', key:padKey(), issue:d(14), total:699.0, status:'autorizada', emitter:'Mahle', recipient:'Auto Gestor Peças LTDA', items:[mkItem('P-1006','Filtro de Ar Motor',10,69.9)] },
  ];
}

// ==============================
// Utilitários
// ==============================
function formatBRL(v) {
  try { return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return `R$ ${(v ?? 0).toFixed(2)}`; }
}
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  } catch { return iso; }
}
function nfStatusLabel(s) {
  switch (s) {
    case 'autorizada': return 'Autorizada';
    case 'emitida': return 'Emitida';
    case 'cancelada': return 'Cancelada';
    case 'denegada': return 'Denegada';
    default: return s || '';
  }
}
function normalizeStr(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

// Expor init no escopo global
window.initInvoicesOnce = initInvoicesOnce;
