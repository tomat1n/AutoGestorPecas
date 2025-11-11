(function(){
  let initialized=false; let supabase=null;
  const fmtBRL=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const fmtDate=d=>{if(!d)return'—';const dt=typeof d==='string'?new Date(d):d;return dt.toLocaleDateString('pt-BR');};
  const id=()=> (window.crypto&&crypto.randomUUID)?crypto.randomUUID():'ap_'+Math.random().toString(36).slice(2,10);
  const addDays=(dt,n)=>{const d=new Date(dt);d.setDate(d.getDate()+n);return d;};
  const toYMD = d => { const dt = new Date(d); const m = String(dt.getMonth()+1).padStart(2,'0'); const day = String(dt.getDate()).padStart(2,'0'); return `${dt.getFullYear()}-${m}-${day}`; };
  const daysUntil = date => { if(!date) return null; const d = new Date(date); const today = new Date(); const ms = toYMD(d) - toYMD(today); const diffDays = Math.floor((d - today)/(1000*60*60*24)); return diffDays; };

  window.initPayablesOnce=function(){
    if(initialized) return; initialized=true;
    try{ initSupabase?.(); }catch{}
    supabase = window.supabaseClient || null;

    const el={
      apExportBtn:document.getElementById('apExportBtn'),
      apNewPaymentBtn:document.getElementById('apNewPaymentBtn'),
      apOpenReminderBtn:document.getElementById('apOpenReminderBtn'),
      apAlertBar:document.getElementById('apAlertBar'),
      apSumPending:document.getElementById('apSumPending'),
      apSumOverdue:document.getElementById('apSumOverdue'),
      apSumPaid:document.getElementById('apSumPaid'),
      apSumWeekDue:document.getElementById('apSumWeekDue'),
      apFilterStatus:document.getElementById('apFilterStatus'),
      apFilterPriority:document.getElementById('apFilterPriority'),
      apFilterStart:document.getElementById('apFilterStart'),
      apFilterEnd:document.getElementById('apFilterEnd'),
      apSearch:document.getElementById('apSearch'),
      apTableBody:document.getElementById('apTableBody'),
      form:document.getElementById('apForm'),
      supplierName:document.getElementById('apSupplierName'),
      supplierId:document.getElementById('apSupplierId'),
      description:document.getElementById('apDescription'),
      originalValue:document.getElementById('apOriginalValue'),
      paidValue:document.getElementById('apPaidValue'),
      dueDate:document.getElementById('apDueDate'),
      issueDate:document.getElementById('apIssueDate'),
      docNumber:document.getElementById('apDocNumber'),
      category:document.getElementById('apCategory'),
      priority:document.getElementById('apPriority'),
      status:document.getElementById('apStatus'),
      observations:document.getElementById('apObservations'),
      saveBtn:document.getElementById('apSaveBtn'),
      resetBtn:document.getElementById('apResetBtn'),
      deleteBtn:document.getElementById('apDeleteBtn'),
      whatsBtn:document.getElementById('apWhatsBtn'),
      paymentModal:document.getElementById('paymentModal'),
      closePaymentModal:document.getElementById('closePaymentModal'),
      payAccountSelect:document.getElementById('payAccountSelect'),
      payValue:document.getElementById('payValue'),
      payDate:document.getElementById('payDate'),
      payMethod:document.getElementById('payMethod'),
      payReceiptNumber:document.getElementById('payReceiptNumber'),
      payObs:document.getElementById('payObs'),
      savePaymentBtn:document.getElementById('savePaymentBtn'),
      // Reminder modal
      apReminderModal:document.getElementById('apReminderModal'),
      closeApReminderModal:document.getElementById('closeApReminderModal'),
      saveApReminderSettings:document.getElementById('saveApReminderSettings'),
      apReminder7:document.getElementById('apReminder7'),
      apReminder3:document.getElementById('apReminder3'),
      apReminder1:document.getElementById('apReminder1'),
      apReminderDue:document.getElementById('apReminderDue'),
    };

    const S = window.AP_STATE = window.AP_STATE || { accounts:[], payments:[], selectedId:null, reminderSettings:{ days7:true, days3:true, days1:true, due:true } };
    if(supabase){ loadAPSupabase(el,S).catch(err=>console.warn('Supabase load AP error',err)); }
    seedDemoIfEmpty(S);
    bindHeader(el,S); bindFilters(el,S); bindForm(el,S); bindModal(el,S);
    renderAll(el,S);
  };

  function seedDemoIfEmpty(S){
    if(S.accounts && S.accounts.length) return; const t=new Date();
    S.accounts = [
      { id:id(), supplier_id:null, supplier_name:'Moura Baterias', description:'Compra de bateria 60Ah', original_value:520.00, paid_value:200.00, due_date:addDays(t,3), issue_date:addDays(t,-2), document_number:'NF-1001', category:'compra', priority:'medium', status:'partial', observations:'' },
      { id:id(), supplier_id:null, supplier_name:'Cobreq', description:'Pastilhas de freio', original_value:780.00, paid_value:0, due_date:addDays(t,-1), issue_date:addDays(t,-10), document_number:'NF-0993', category:'compra', priority:'high', status:'overdue', observations:'Negociar prazo' },
      { id:id(), supplier_id:null, supplier_name:'Mahle', description:'Filtros de ar', original_value:260.00, paid_value:260.00, due_date:addDays(t,-2), issue_date:addDays(t,-12), document_number:'NF-0981', category:'compra', priority:'low', status:'paid', observations:'Pago via PIX' }
    ];
  }

  function bindHeader(el,S){
    el.apExportBtn?.addEventListener('click',()=>exportCSV(S.accounts));
    el.apNewPaymentBtn?.addEventListener('click',()=>openPaymentModal(el,S));
    el.apOpenReminderBtn?.addEventListener('click',()=>openReminderModal(el,S));
  }

  function bindFilters(el,S){
    const rer=()=>renderTable(el,S);
    el.apSearch?.addEventListener('input',debounced(rer,250));
    el.apFilterStatus?.addEventListener('change',rer);
    el.apFilterPriority?.addEventListener('change',rer);
    el.apFilterStart?.addEventListener('change',rer);
    el.apFilterEnd?.addEventListener('change',rer);
  }

  function bindForm(el,S){
    el.saveBtn?.addEventListener('click',async()=>{
      const data=getFormData(el);
      const errors=validate(data); if(errors.length){ alert(errors.join('\n')); return; }
      applyStatus(data);
      if(S.selectedId){
        const acc=S.accounts.find(a=>a.id===S.selectedId); if(acc){ Object.assign(acc,data,{id:acc.id}); }
        if(supabase && acc){ await upsertAccountSupabase(acc,true).catch(err=>console.warn('Supabase update',err)); }
        alert('Conta atualizada.');
      }else{
        const newAcc={...data,id:id()}; S.accounts.push(newAcc); S.selectedId=newAcc.id;
        if(supabase){ const ret=await upsertAccountSupabase(newAcc,false).catch(err=>console.warn('Supabase insert',err)); if(ret?.id){ newAcc.id=ret.id; S.selectedId=ret.id; } }
        alert('Conta criada.');
      }
      renderAll(el,S);
    });

    el.resetBtn?.addEventListener('click',()=>{ clearForm(el); S.selectedId=null; });
    el.deleteBtn?.addEventListener('click',async()=>{
      if(!S.selectedId){ alert('Selecione uma conta para excluir.'); return; }
      const delId=S.selectedId; S.accounts=S.accounts.filter(a=>a.id!==delId); S.selectedId=null; clearForm(el); renderAll(el,S);
      if(supabase){ await deleteAccountSupabase(delId).catch(err=>console.warn('Supabase delete',err)); }
      alert('Conta excluída.');
    });

    el.whatsBtn?.addEventListener('click',()=>{
      const d=getFormData(el);
      if(!d.supplier_name||!d.description||!d.due_date||!d.original_value){ alert('Preencha Fornecedor, Descrição, Vencimento e Valor.'); return; }
      const msg=`Olá ${d.supplier_name}, aqui é da AutoGestor.\nLembrete: ${d.description}.\nVencimento: ${fmtDate(d.due_date)}. Valor: ${fmtBRL(d.original_value)}.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
    });
  }

  function bindModal(el,S){
    el.closePaymentModal?.addEventListener('click',()=>closePaymentModal(el));
    el.savePaymentBtn?.addEventListener('click',()=>savePayment(el,S));
    el.closeApReminderModal?.addEventListener('click',()=>closeReminderModal(el));
    el.saveApReminderSettings?.addEventListener('click',()=>{
      S.reminderSettings = {
        days7: !!el.apReminder7?.checked,
        days3: !!el.apReminder3?.checked,
        days1: !!el.apReminder1?.checked,
        due: !!el.apReminderDue?.checked,
      };
      alert('Preferências de lembrete salvas.');
      closeReminderModal(el);
    });
  }

  function renderAll(el,S){ renderSummary(el,S); renderAlertsBar(el,S); renderTable(el,S); fillPaymentAccounts(el,S); }

  function renderSummary(el,S){
    const today=new Date(),weekEnd=addDays(today,7);
    let pendingTotal=0, overdueCount=0, paidCount=0, weekDueCount=0;
    S.accounts.forEach(a=>{
      const due=new Date(a.due_date);
      const remaining=Math.max(0, Number(a.original_value||0)-Number(a.paid_value||0));
      if(a.status==='paid'||remaining<=0) paidCount+=1; else {
        pendingTotal+=remaining; if(due<today) overdueCount+=1; if(due>=today&&due<=weekEnd) weekDueCount+=1;
      }
    });
    el.apSumPending&&(el.apSumPending.textContent=fmtBRL(pendingTotal));
    el.apSumOverdue&&(el.apSumOverdue.textContent=String(overdueCount));
    el.apSumPaid&&(el.apSumPaid.textContent=String(paidCount));
    el.apSumWeekDue&&(el.apSumWeekDue.textContent=String(weekDueCount));
  }

  function renderAlertsBar(el,S){
    if(!el.apAlertBar) return;
    const today = new Date();
    let overdue = 0, due7 = 0, future = 0;
    S.accounts.forEach(a=>{
      const remaining = Math.max(0, Number(a.original_value||0)-Number(a.paid_value||0));
      if (a.status==='paid' || remaining<=0) return;
      const d = new Date(a.due_date);
      const diff = Math.floor((d - today)/(1000*60*60*24));
      if (diff < 0) overdue += 1; else if (diff <= 7) due7 += 1; else future += 1;
    });
    el.apAlertBar.innerHTML = `
      ${overdue>0?`<div class="ap-alert warning-high"><i class="fa-solid fa-exclamation-triangle"></i> ${overdue} vencidas</div>`:''}
      ${due7>0?`<div class="ap-alert warning-medium"><i class="fa-solid fa-calendar-week"></i> ${due7} vencem em ≤7 dias</div>`:''}
      ${future>0?`<div class="ap-alert warning-low"><i class="fa-solid fa-info-circle"></i> ${future} próximas</div>`:''}
    `;
  }

  function applyFilters(el,S){
    const q=(el.apSearch?.value||'').trim().toLowerCase();
    const status=el.apFilterStatus?.value||'';
    const pr=el.apFilterPriority?.value||'';
    const dStart=el.apFilterStart?.value?new Date(el.apFilterStart.value):null;
    const dEnd=el.apFilterEnd?.value?new Date(el.apFilterEnd.value):null;
    let items=S.accounts.slice();
    if(q) items=items.filter(a=> (a.supplier_name||'').toLowerCase().includes(q) || (a.description||'').toLowerCase().includes(q) || (a.document_number||'').toLowerCase().includes(q));
    if(status) items=items.filter(a=>a.status===status);
    if(pr) items=items.filter(a=>a.priority===pr);
    if(dStart) items=items.filter(a=> new Date(a.issue_date)>=dStart || new Date(a.due_date)>=dStart);
    if(dEnd) items=items.filter(a=> new Date(a.issue_date)<=dEnd || new Date(a.due_date)<=dEnd);
    return items.sort((a,b)=> new Date(a.due_date)-new Date(b.due_date));
  }

  function renderTable(el,S){
    const rows=applyFilters(el,S).map((a,idx)=>{
      const remaining=Math.max(0, Number(a.original_value||0)-Number(a.paid_value||0));
      const isOverdue=(a.status!=='paid') && (new Date(a.due_date) < new Date());
      const diffDays = a.status==='paid' ? null : Math.floor((new Date(a.due_date) - new Date())/(1000*60*60*24));
      const rowClass = diffDays==null ? '' : (diffDays<0 ? 'vencida' : (diffDays<=7 ? 'proxima' : ''));
      return `
        <tr class="conta-row ${rowClass}" data-id="${a.id}">
          <td>${idx+1}</td>
          <td>${a.supplier_name}</td>
          <td>${a.description}</td>
          <td>${fmtBRL(a.original_value)}</td>
          <td>${fmtBRL(a.paid_value)}</td>
          <td>${fmtBRL(remaining)}</td>
          <td>${fmtDate(a.due_date)} ${isOverdue?'<span class="badge badge-danger">Vencida</span>':''}</td>
          <td>${diffDays==null?'—':diffDays}</td>
          <td><span class="status-badge status-${a.status}">${mapStatusLabel(a.status)}</span></td>
          <td>${mapPriorityLabel(a.priority)}</td>
          <td>
            <button class="btn btn-secondary btn-edit" title="Editar conta"><i class="fa-solid fa-edit"></i></button>
            <button class="btn btn-success btn-pay" title="Registrar pagamento"><i class="fa-solid fa-money-bill-wave"></i></button>
            <button class="btn btn-warning btn-reminder" title="Criar lembrete"><i class="fa-solid fa-bell"></i></button>
            <button class="btn btn-danger btn-delete" title="Excluir conta"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
    }).join('');
    el.apTableBody&&(el.apTableBody.innerHTML=rows||'<tr><td colspan="11" style="text-align:center;color:#777;">Nenhuma conta encontrada.</td></tr>');
    attachRowEvents(el,S);
  }

  function attachRowEvents(el,S){
    el.apTableBody?.querySelectorAll('tr').forEach(tr=>{
      const rid=tr.getAttribute('data-id'); const acc=S.accounts.find(a=>a.id===rid);
      const btnEdit=tr.querySelector('.btn-edit'); const btnPay=tr.querySelector('.btn-pay');
      const btnReminder=tr.querySelector('.btn-reminder'); const btnDelete=tr.querySelector('.btn-delete');
      tr.addEventListener('click', (e)=>{
        if ((e.target.closest && e.target.closest('button'))) return; // ignore clicks on action buttons
        el.apTableBody?.querySelectorAll('tr').forEach(r=>r.classList.remove('selected'));
        tr.classList.add('selected'); S.selectedId = rid;
        setFormData(el, acc);
      });
      btnEdit?.addEventListener('click',()=>{ S.selectedId=rid; setFormData(el,acc); });
      btnPay?.addEventListener('click',()=>{ S.selectedId=rid; openPaymentModal(el,S,rid); });
      btnReminder?.addEventListener('click',()=>{ S.selectedId=rid; openReminderModal(el,S,rid); });
      btnDelete?.addEventListener('click',async()=>{
        if(!confirm('Excluir esta conta?')) return;
        S.accounts = S.accounts.filter(a=>a.id!==rid);
        if (supabase){ await deleteAccountSupabase(rid).catch(err=>console.warn('Supabase delete',err)); }
        renderAll(el,S);
      });
    });
  }

  function mapStatusLabel(s){ const map={pending:'Pendente',overdue:'Vencida',partial:'Parcial',paid:'Paga'}; return map[s]||s||'—'; }
  function mapPriorityLabel(p){ const map={low:'Baixa',medium:'Média',high:'Alta'}; return map[p]||p||'—'; }

  function fillPaymentAccounts(el,S){
    if(!el.payAccountSelect) return;
    const opts=S.accounts.map(a=>`<option value="${a.id}">${a.supplier_name} — ${a.description} (${fmtBRL(a.original_value)})</option>`).join('');
    el.payAccountSelect.innerHTML='<option value="">Selecione...</option>'+opts;
  }

  function openPaymentModal(el,S,accountId){
    fillPaymentAccounts(el,S);
    if(accountId && el.payAccountSelect){ el.payAccountSelect.value=accountId; }
    if(el.payDate) el.payDate.value=new Date().toISOString().slice(0,10);
    el.paymentModal?.classList.add('active');
  }
  function closePaymentModal(el){ el.paymentModal?.classList.remove('active'); }

  function openReminderModal(el,S){ el.apReminderModal?.classList.add('active'); }
  function closeReminderModal(el){ el.apReminderModal?.classList.remove('active'); }

  async function savePayment(el,S){
    const accountId=el.payAccountSelect?.value||S.selectedId;
    const acc=S.accounts.find(a=>a.id===accountId); if(!acc){ alert('Selecione uma conta válida.'); return; }
    const val=Number(el.payValue?.value||0); if(val<=0){ alert('Valor do pagamento deve ser maior que zero.'); return; }
    const dt=el.payDate?.value?new Date(el.payDate.value):new Date();
    const method=el.payMethod?.value||'Dinheiro'; const rec=el.payReceiptNumber?.value||''; const obs=el.payObs?.value||'';
    acc.paid_value=Number(acc.paid_value||0)+val;
    const remaining=Math.max(0, Number(acc.original_value||0)-Number(acc.paid_value||0));
    acc.status = remaining<=0 ? 'paid' : 'partial';
    S.payments.push({ id:id(), account_id:acc.id, payment_value:val, payment_date:dt, payment_method:method, receipt_number:rec, observations:obs, created_at:new Date().toISOString() });
    if(supabase){ await savePaymentSupabase({ account_id:acc.id, payment_value:val, payment_date:dt, payment_method:method, receipt_number:rec, observations:obs }).catch(err=>console.warn('Supabase payment',err)); await upsertAccountSupabase(acc,true).catch(err=>console.warn('Supabase account update',err)); }
    alert('Pagamento registrado.');
    closePaymentModal(el);
    renderAll(el,S);
  }

  function getFormData(el){
    const toNum=v=>Number(String(v||'').replace(',','.'))||0;
    return {
      supplier_id:el.supplierId?.value||null,
      supplier_name:(el.supplierName?.value||'').trim(),
      description:(el.description?.value||'').trim(),
      original_value:toNum(el.originalValue?.value),
      paid_value:toNum(el.paidValue?.value),
      due_date:el.dueDate?.value?new Date(el.dueDate.value):null,
      issue_date:el.issueDate?.value?new Date(el.issueDate.value):new Date(),
      document_number:(el.docNumber?.value||'').trim(),
      category:el.category?.value||'compra',
      priority:el.priority?.value||'medium',
      status:el.status?.value||'pending',
      observations:(el.observations?.value||'').trim(),
    };
  }
  function setFormData(el,a){ if(!a) return;
    el.supplierId&&(el.supplierId.value=a.supplier_id||'');
    el.supplierName&&(el.supplierName.value=a.supplier_name||'');
    el.description&&(el.description.value=a.description||'');
    el.originalValue&&(el.originalValue.value=Number(a.original_value||0).toFixed(2));
    el.paidValue&&(el.paidValue.value=Number(a.paid_value||0).toFixed(2));
    el.dueDate&&(el.dueDate.value=a.due_date?new Date(a.due_date).toISOString().slice(0,10):'');
    el.issueDate&&(el.issueDate.value=a.issue_date?new Date(a.issue_date).toISOString().slice(0,10):'');
    el.docNumber&&(el.docNumber.value=a.document_number||'');
    el.category&&(el.category.value=a.category||'compra');
    el.priority&&(el.priority.value=a.priority||'medium');
    el.status&&(el.status.value=a.status||'pending');
    el.observations&&(el.observations.value=a.observations||'');
  }
  function clearForm(el){ ['supplierId','supplierName','description','originalValue','paidValue','dueDate','issueDate','docNumber','observations'].forEach(k=>{ const e=el[k]; if(e) e.value=''; }); if(el.category) el.category.value='compra'; if(el.priority) el.priority.value='medium'; if(el.status) el.status.value='pending'; }
  function validate(d){ const errs=[]; if(!d.supplier_name) errs.push('Fornecedor é obrigatório.'); if(!d.description) errs.push('Descrição é obrigatória.'); if(!d.due_date) errs.push('Data de vencimento é obrigatória.'); if(Number(d.original_value||0)<=0) errs.push('Valor original deve ser maior que zero.'); return errs; }
  function applyStatus(a){ const rem=Math.max(0, Number(a.original_value||0)-Number(a.paid_value||0)); if(rem<=0){ a.status='paid'; a.paid_date=a.paid_date||new Date(); } else if(a.due_date && new Date(a.due_date) < new Date()){ a.status='overdue'; } else if(Number(a.paid_value||0)>0){ a.status='partial'; } else { a.status=a.status||'pending'; } return a; }

  async function loadAPSupabase(el,S){ try{ const { data } = await supabase.from('accounts_payable').select('*').order('due_date',{ascending:true}); if(Array.isArray(data)){ S.accounts = data.map(a=>({...a})); renderAll(el,S); } }catch(err){ throw err; } }
  function toDB(a){ const ymd=d=>d?new Date(d).toISOString().slice(0,10):null; const days=a.due_date?Math.ceil((new Date(a.due_date)-new Date())/86400000):null; return { supplier_id:a.supplier_id||null, supplier_name:a.supplier_name, description:a.description, original_value:Number(a.original_value||0), paid_value:Number(a.paid_value||0), due_date:ymd(a.due_date), issue_date:ymd(a.issue_date), document_number:a.document_number||null, category:a.category||'compra', priority:a.priority||'medium', status:a.status||'pending', observations:a.observations||null, days_until_due:days, paid_date:ymd(a.paid_date), payment_method:a.payment_method||null, payment_observations:a.payment_observations||null, updated_at:new Date().toISOString() }; }
  async function upsertAccountSupabase(a,isUpdate){ const payload=toDB(a); if(isUpdate){ await supabase.from('accounts_payable').update(payload).eq('id',a.id); return { id:a.id }; } else { const { data } = await supabase.from('accounts_payable').insert(payload).select('id').single(); return data||null; } }
  async function deleteAccountSupabase(id){ await supabase.from('accounts_payable').delete().eq('id',id); }
  async function savePaymentSupabase(p){ const ymd=d=>d?new Date(d).toISOString().slice(0,10):null; const payload={ account_id:p.account_id, payment_value:Number(p.payment_value||0), payment_date:ymd(p.payment_date), payment_method:p.payment_method||null, receipt_number:p.receipt_number||null, observations:p.observations||null }; await supabase.from('payable_payments').insert(payload); }

  function exportCSV(items){ if(!Array.isArray(items)||!items.length){ alert('Nada para exportar.'); return; } const headers=['Fornecedor','Descrição','Original','Pago','Restante','Vencimento','Emissão','Documento','Categoria','Prioridade','Status']; const rows=items.map(a=>[ a.supplier_name, a.description, Number(a.original_value||0).toFixed(2), Number(a.paid_value||0).toFixed(2), Math.max(0, Number(a.original_value||0)-Number(a.paid_value||0)).toFixed(2), fmtDate(a.due_date), fmtDate(a.issue_date), a.document_number||'', a.category||'', mapPriorityLabel(a.priority), mapStatusLabel(a.status) ]); const csv=[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'\"')}"`).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='contas_a_pagar.csv'; a.click(); URL.revokeObjectURL(url); }
  function debounced(fn,ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),ms); }; }
})();