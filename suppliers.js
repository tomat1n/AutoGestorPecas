// Fornecedores (Gestão de Fornecedores)
let SUPPLIERS_INITIALIZED = false;
function initSuppliersOnce() {
  if (SUPPLIERS_INITIALIZED) return;
  SUPPLIERS_INITIALIZED = true;
  try { initSupabase?.(); } catch {}
  window.SUP_STATE = window.SUP_STATE || { suppliers: [], contacts: [], products: [], filterTerm: '' };
  window.SUP_MANAGER = new SupplierManager();
  window.SUP_MANAGER.init();
}

class SupplierManager {
  constructor() {
    this.supabase = window.supabaseClient || null;
    this.currentSupplierId = null;
    this.supplierContacts = [];
    this.supplierProducts = [];
    this.el = {
      // Header actions
      exportBtn: document.getElementById('supExportBtn'),
      importBtn: document.getElementById('supImportBtn'),
      importFile: document.getElementById('supImportFile'),
      // Form
      form: document.getElementById('supplierForm'),
      name: document.getElementById('supplierName'),
      tradeName: document.getElementById('supplierTradeName'),
      cnpj: document.getElementById('supplierCNPJ'),
      ie: document.getElementById('supplierIE'),
      phone: document.getElementById('supplierPhone'),
      email: document.getElementById('supplierEmail'),
      cep: document.getElementById('supplierCEP'),
      uf: document.getElementById('supplierState'),
      city: document.getElementById('supplierCity'),
      address: document.getElementById('supplierAddress'),
      status: document.getElementById('supplierStatus'),
      rating: document.getElementById('supplierRating'),
      saveBtn: document.getElementById('supplierSaveBtn'),
      resetBtn: document.getElementById('supplierResetBtn'),
      deleteBtn: document.getElementById('supplierDeleteBtn'),
      // Lists and actions
      contactsList: document.getElementById('supplierContactsList'),
      productsList: document.getElementById('supplierProductsList'),
      addContactBtn: document.getElementById('openContactModalBtn'),
      addProductBtn: document.getElementById('openProductModalBtn'),
      // Modals - Contacts
      contactModal: document.getElementById('contactModal'),
      contactName: document.getElementById('contactName'),
      contactRole: document.getElementById('contactRole'),
      contactDept: document.getElementById('contactDept'),
      contactPhone: document.getElementById('contactPhone'),
      contactEmail: document.getElementById('contactEmail'),
      saveContactBtn: document.getElementById('saveContactBtn'),
      closeContactModalBtn: document.getElementById('closeContactModalBtn'),
      // Modals - Products
      productModal: document.getElementById('productModal'),
      productName: document.getElementById('productName'),
      productCategory: document.getElementById('productCategory'),
      productCode: document.getElementById('productCode'),
      productNotes: document.getElementById('productNotes'),
      saveProductBtn: document.getElementById('saveProductBtn'),
      closeProductModalBtn: document.getElementById('closeProductModalBtn'),
      // WhatsApp
      whatsModal: document.getElementById('supplierWhatsModal'),
      whatsRecipient: document.getElementById('supplierWhatsRecipient'),
      whatsTemplate: document.getElementById('supplierWhatsTemplate'),
      whatsMessage: document.getElementById('supplierWhatsMessage'),
      sendWhatsBtn: document.getElementById('sendSupplierWhatsBtn'),
      closeWhatsModalBtn: document.getElementById('closeSupplierWhatsModalBtn'),
      whatsBtn: document.getElementById('supplierWhatsBtn'),
      // Grid and search
      grid: document.getElementById('suppliersGrid'),
      search: document.getElementById('supplierSearch')
    };
  }

  init(){ this.seedDemo(); this.bindForm(); this.bindModals(); this.bindImportExport(); this.bindWhats(); this.bindSearch(); this.renderGrid(); }

  seedDemo(){ const s=window.SUP_STATE; if(s.suppliers.length) return; const id=()=>this.randId(); const demo=[
    { id:id(), name:'AutoParts Brasil LTDA', trade_name:'AutoParts', cnpj:'12.345.678/0001-90', state_registration:'123.456.789.000', phone:'(11) 3500-1122', email:'contato@autoparts.com.br', cep:'01156-000', state:'SP', city:'São Paulo', address:'Av. Marquês de São Vicente, 123', status:'active', rating:4.5, total_orders:120, last_order_date:'2025-08-10', is_active:true },
    { id:id(), name:'Moura Baterias SA', trade_name:'Moura', cnpj:'45.678.912/0001-10', state_registration:'223.456.111.000', phone:'(81) 3200-0000', email:'vendas@moura.com', cep:'50030-230', state:'PE', city:'Recife', address:'Rua da União, 500', status:'active', rating:4.7, total_orders:230, last_order_date:'2025-07-28', is_active:true },
    { id:id(), name:'Cobreq Indústria', trade_name:'Cobreq', cnpj:'33.456.789/0001-44', state_registration:'334.567.222.000', phone:'(11) 3900-3344', email:'comercial@cobreq.com.br', cep:'05076-010', state:'SP', city:'São Paulo', address:'Rua Elisa, 120', status:'active', rating:4.2, total_orders:180, last_order_date:'2025-08-02', is_active:true },
    { id:id(), name:'ACDelco Peças', trade_name:'ACDelco', cnpj:'29.876.543/0001-88', state_registration:'112.233.445.566', phone:'(21) 2110-4455', email:'suporte@acdelco.com', cep:'20031-170', state:'RJ', city:'Rio de Janeiro', address:'Rua do Ouvidor, 90', status:'active', rating:4.0, total_orders:90, last_order_date:'2025-05-15', is_active:true },
    { id:id(), name:'Texaco Lubrificantes', trade_name:'Texaco', cnpj:'66.777.888/0001-22', state_registration:'998.776.554.221', phone:'(31) 3566-8899', email:'brasil@texaco.com', cep:'30112-070', state:'MG', city:'Belo Horizonte', address:'Av. Brasil, 405', status:'active', rating:4.3, total_orders:140, last_order_date:'2025-06-21', is_active:true }
  ]; const contacts=[
    { id:id(), supplier_id:demo[0].id, name:'Ana Paula', role:'Comercial', department:'Vendas', phone:'(11) 99900-1122', email:'ana.paula@autoparts.com.br' },
    { id:id(), supplier_id:demo[1].id, name:'Bruno Silva', role:'Representante', department:'Comercial', phone:'(81) 98877-2211', email:'bruno.silva@moura.com' },
    { id:id(), supplier_id:demo[2].id, name:'Carla Dias', role:'Atendimento', department:'Suporte', phone:'(11) 97766-3344', email:'carla.dias@cobreq.com.br' }
  ]; const prods=[
    { id:id(), supplier_id:demo[0].id, name:'Filtro de Óleo', category:'Filtros', supplier_code:'AP-FO-001', notes:'Linha GM'},
    { id:id(), supplier_id:demo[1].id, name:'Bateria 60Ah', category:'Elétrica', supplier_code:'MO-60A', notes:'Livre manutenção'},
    { id:id(), supplier_id:demo[2].id, name:'Pastilha Freio Dianteira', category:'Freios', supplier_code:'CB-PF-D', notes:'Onix/Prisma'}
  ]; s.suppliers=demo; s.contacts=contacts; s.products=prods; }

  bindForm(){ const e=this.el; e.cep?.addEventListener('blur', (ev)=>{ const v=(ev.target.value||'').replace(/\D/g,''); if(v.length===8) this.searchCEP(v); }); e.cnpj?.addEventListener('blur',(ev)=>this.validateCNPJ(ev.target.value)); e.form?.addEventListener('submit',(ev)=>{ ev.preventDefault(); this.saveSupplier(); }); e.resetBtn?.addEventListener('click',()=>this.clearForm()); e.deleteBtn?.addEventListener('click',()=>this.deleteSupplier()); }

  bindModals(){ const e=this.el; e.addContactBtn?.addEventListener('click',()=>this.showContactModal(true)); e.closeContactModalBtn?.addEventListener('click',()=>this.showContactModal(false)); e.saveContactBtn?.addEventListener('click',()=>{ const c={ id:this.randId(), supplier_id:this.currentSupplierId, name:(e.contactName.value||'').trim(), role:(e.contactRole.value||'').trim(), department:(e.contactDept.value||'').trim(), phone:(e.contactPhone.value||'').trim(), email:(e.contactEmail.value||'').trim() }; if(!c.name) return alert('Informe o nome do contato.'); this.supplierContacts.push(c); this.renderContactsList(); this.showContactModal(false); e.contactName.value=''; e.contactRole.value=''; e.contactDept.value=''; e.contactPhone.value=''; e.contactEmail.value=''; });
    e.addProductBtn?.addEventListener('click',()=>this.showProductModal(true)); e.closeProductModalBtn?.addEventListener('click',()=>this.showProductModal(false)); e.saveProductBtn?.addEventListener('click',()=>{ const p={ id:this.randId(), supplier_id:this.currentSupplierId, name:(e.productName.value||'').trim(), category:(e.productCategory.value||'').trim(), supplier_code:(e.productCode.value||'').trim(), notes:(e.productNotes.value||'').trim() }; if(!p.name||!p.category) return alert('Informe nome e categoria do produto.'); this.supplierProducts.push(p); this.renderProductsList(); this.showProductModal(false); e.productName.value=''; e.productCategory.value=''; e.productCode.value=''; e.productNotes.value=''; }); }

  bindImportExport(){ const e=this.el; e.exportBtn?.addEventListener('click',()=>this.exportCSV()); e.importBtn?.addEventListener('click',()=>e.importFile?.click()); e.importFile?.addEventListener('change',(ev)=>this.handleImportFile(ev)); }

  bindWhats(){ const e=this.el; e.whatsBtn?.addEventListener('click',()=>this.openWhatsModal()); e.closeWhatsModalBtn?.addEventListener('click',()=>this.closeWhatsModal()); e.whatsTemplate?.addEventListener('change',()=>{ const s=this.getCurrentSupplier(); const tpl=e.whatsTemplate.value; e.whatsMessage.value = tpl==='cotacao'?`Olá ${s?.trade_name||s?.name||''}, segue cotação atualizada.`: tpl==='pedido'?`Olá ${s?.trade_name||s?.name||''}, pedido confirmado.`: tpl==='cobranca'?`Olá ${s?.trade_name||s?.name||''}, segue cobrança pendente.`: tpl==='followup'?`Olá ${s?.trade_name||s?.name||''}, acompanhando solicitação.`:''; }); e.sendWhatsBtn?.addEventListener('click',()=>this.sendWhatsMessage()); }

  bindSearch(){ const e=this.el; e.search?.addEventListener('input', debounce((ev)=>{ window.SUP_STATE.filterTerm=(ev.target.value||'').trim().toLowerCase(); this.renderGrid(); }, 200)); }

  async searchCEP(cep){ try{ const cleanCEP=String(cep).replace(/\D/g,''); const resp=await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`); const data=await resp.json(); if(!data.erro){ this.el.address.value = `${data.logradouro||''}, ${data.bairro||''}`.trim(); this.el.city.value = data.localidade||''; this.el.uf.value = data.uf||''; } else { alert('CEP não encontrado'); } } catch(err){ alert('Erro ao buscar CEP'); } }

  validateCNPJ(cnpj){ const c=String(cnpj).replace(/\D/g,''); if(c.length!==14){ alert('CNPJ deve ter 14 dígitos'); return false; } if(/^([0-9])\1+$/.test(c)){ alert('CNPJ inválido'); return false; } const calc=(base)=>{ let sum=0; const weights=base.length===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2]; for(let i=0;i<weights.length;i++){ sum+=Number(base[i])*weights[i]; } const mod=sum%11; return mod<2?0:11-mod; }; const d1=calc(c.slice(0,12)); const d2=calc(c.slice(0,12)+d1); const valid = d1===Number(c[12]) && d2===Number(c[13]); if(!valid) alert('CNPJ inválido'); return valid; }

  getCurrentSupplier(){ return (window.SUP_STATE.suppliers||[]).find(s=>s.id===this.currentSupplierId)||null; }

  fillForm(s){ const e=this.el; this.currentSupplierId=s?.id||null; e.name.value=s?.name||''; e.tradeName.value=s?.trade_name||''; e.cnpj.value=s?.cnpj||''; e.ie.value=s?.state_registration||''; e.phone.value=s?.phone||''; e.email.value=s?.email||''; e.cep.value=s?.cep||''; e.uf.value=s?.state||''; e.city.value=s?.city||''; e.address.value=s?.address||''; e.status.value=s?.status||'active'; e.rating.value=s?.rating??4.0; this.supplierContacts=(window.SUP_STATE.contacts||[]).filter(c=>c.supplier_id===s?.id); this.supplierProducts=(window.SUP_STATE.products||[]).filter(p=>p.supplier_id===s?.id); this.renderContactsList(); this.renderProductsList(); }

  clearForm(){ this.fillForm({ id:null, name:'', trade_name:'', cnpj:'', state_registration:'', phone:'', email:'', cep:'', state:'', city:'', address:'', status:'active', rating:4.0 }); }

  async saveSupplier(){ const e=this.el; const sdata={ id:this.currentSupplierId||this.randId(), name:(e.name.value||'').trim(), trade_name:(e.tradeName.value||'').trim(), cnpj:(e.cnpj.value||'').trim(), state_registration:(e.ie.value||'').trim(), phone:(e.phone.value||'').trim(), email:(e.email.value||'').trim(), cep:(e.cep.value||'').trim(), state:(e.uf.value||'').trim(), city:(e.city.value||'').trim(), address:(e.address.value||'').trim(), status:(e.status.value||'').trim()||'active', rating:Number(e.rating.value||4.0), updated_at:new Date().toISOString(), is_active:true };
    if(!sdata.name||!sdata.trade_name||!sdata.cnpj||!sdata.phone) return alert('Preencha Razão Social, Fantasia, CNPJ e Telefone.'); if(!this.validateCNPJ(sdata.cnpj)) return;
    const S=window.SUP_STATE; const i=S.suppliers.findIndex(x=>x.id===sdata.id); if(i>=0) S.suppliers[i] = { ...S.suppliers[i], ...sdata }; else S.suppliers.push({ ...sdata, total_orders:0, last_order_date:null });
    S.contacts=(S.contacts||[]).filter(c=>c.supplier_id!==sdata.id).concat(this.supplierContacts.map(c=>({ ...c, supplier_id:sdata.id })));
    S.products=(S.products||[]).filter(p=>p.supplier_id!==sdata.id).concat(this.supplierProducts.map(p=>({ ...p, supplier_id:sdata.id })));
    if(this.supabase){ try{ const base={...sdata, id:undefined}; if(i>=0){ await this.supabase.from('suppliers').update(base).eq('id', sdata.id); } else { const { data } = await this.supabase.from('suppliers').insert(base).select('id').single(); if(data?.id){ sdata.id=data.id; this.currentSupplierId=data.id; } }
      await this.supabase.from('supplier_contacts').delete().eq('supplier_id', sdata.id);
      await this.supabase.from('supplier_products').delete().eq('supplier_id', sdata.id);
      const toContacts=this.supplierContacts.map(c=>({ supplier_id:sdata.id, name:c.name, role:c.role, department:c.department, phone:c.phone, email:c.email })); if(toContacts.length) await this.supabase.from('supplier_contacts').insert(toContacts);
      const toProducts=this.supplierProducts.map(p=>({ supplier_id:sdata.id, name:p.name, category:p.category, supplier_code:p.supplier_code, notes:p.notes })); if(toProducts.length) await this.supabase.from('supplier_products').insert(toProducts);
    } catch(err){ console.warn('Supabase save error', err); } }
    this.renderGrid(); this.fillForm(sdata); alert('Fornecedor salvo com sucesso!'); }

  deleteSupplier(){ if(!this.currentSupplierId) return alert('Selecione um fornecedor.'); const S=window.SUP_STATE; S.suppliers=S.suppliers.filter(x=>x.id!==this.currentSupplierId); S.contacts=S.contacts.filter(c=>c.supplier_id!==this.currentSupplierId); S.products=S.products.filter(p=>p.supplier_id!==this.currentSupplierId); if(this.supabase){ this.supabase.from('suppliers').delete().eq('id', this.currentSupplierId).then(()=>{}); this.supabase.from('supplier_contacts').delete().eq('supplier_id', this.currentSupplierId).then(()=>{}); this.supabase.from('supplier_products').delete().eq('supplier_id', this.currentSupplierId).then(()=>{}); } this.clearForm(); this.renderGrid(); alert('Fornecedor excluído.'); }

  renderContactsList(){ const list=this.el.contactsList; if(!list) return; list.innerHTML=''; (this.supplierContacts||[]).forEach(c=>{ const row=document.createElement('div'); row.className='contact-row'; row.innerHTML=`<div>${c.name} • ${c.role||''} • ${c.department||''} • ${c.phone||''}</div>`; list.appendChild(row); }); this.populateWhatsRecipients(); }
  renderProductsList(){ const list=this.el.productsList; if(!list) return; list.innerHTML=''; (this.supplierProducts||[]).forEach(p=>{ const row=document.createElement('div'); row.className='product-row'; row.innerHTML=`<div>${p.name} • ${p.category||''} • ${p.supplier_code||''}</div>`; list.appendChild(row); }); }

  renderGrid(){ const grid=this.el.grid; if(!grid) return; grid.innerHTML=''; const S=window.SUP_STATE; const term=(S.filterTerm||'').toLowerCase(); let items=(S.suppliers||[]).slice(); if(term) items=items.filter(s=>[s.name,s.trade_name,s.cnpj,s.phone,s.email,s.city,s.state].some(x=>String(x||'').toLowerCase().includes(term))); items.forEach(s=>{ const el=document.createElement('div'); el.className='supplier-card'; el.innerHTML=`
      <div class="supplier-title">${s.trade_name} <span class="supplier-sub">(${s.name})</span></div>
      <div class="supplier-info">CNPJ: ${s.cnpj} • IE: ${s.state_registration||'—'} • Tel: ${s.phone}</div>
      <div class="supplier-stats"><div>Status: <strong>${s.status||'active'}</strong></div><div>Rating: <strong>${(s.rating||0).toFixed(1)}</strong></div><div>Pedidos: <strong>${s.total_orders||0}</strong></div><div>Último: ${s.last_order_date?new Date(s.last_order_date).toLocaleDateString('pt-BR'):'—'}</div></div>
      <div class="supplier-actions"><button class="btn btn-secondary btn-details"><i class="fa-solid fa-id-card"></i> Detalhes</button><button class="btn btn-success btn-whats"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button></div>`; el.querySelector('.btn-details')?.addEventListener('click',()=>this.fillForm(s)); el.addEventListener('click',()=>this.fillForm(s)); el.querySelector('.btn-whats')?.addEventListener('click',(ev)=>{ ev.stopPropagation(); this.fillForm(s); this.openWhatsModal(); }); grid.appendChild(el); }); }

  showContactModal(show){ const m=this.el.contactModal; if(!m) return; if(show) m.classList.add('active'); else m.classList.remove('active'); }
  showProductModal(show){ const m=this.el.productModal; if(!m) return; if(show) m.classList.add('active'); else m.classList.remove('active'); }
  openWhatsModal(){ const m=this.el.whatsModal; if(!m) return; this.populateWhatsRecipients(); m.classList.add('active'); }
  closeWhatsModal(){ const m=this.el.whatsModal; if(!m) return; m.classList.remove('active'); }

  populateWhatsRecipients(){ const sel=this.el.whatsRecipient; if(!sel) return; const s=this.getCurrentSupplier(); const contacts=this.supplierContacts||[]; sel.innerHTML=''; const optMain=document.createElement('option'); optMain.value='__supplier'; optMain.textContent=`Fornecedor: ${s?.trade_name||s?.name||''}`; sel.appendChild(optMain); contacts.forEach(c=>{ const opt=document.createElement('option'); opt.value=c.phone||''; opt.textContent=`Contato: ${c.name} (${c.phone||''})`; sel.appendChild(opt); }); }

  async sendWhatsMessage(){ const s=this.getCurrentSupplier(); if(!s) return alert('Selecione um fornecedor.'); const sel=this.el.whatsRecipient; const msg=(this.el.whatsMessage.value||''); let phone=''; if(sel?.value==='__supplier'){ phone=(s.phone||'').replace(/\D/g,''); } else { phone=String(sel?.value||'').replace(/\D/g,''); } if(!phone) return alert('Telefone inválido.'); const url=`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`; window.open(url,'_blank'); if(this.supabase){ try{ await this.supabase.from('supplier_orders').insert({ supplier_id:s.id, order_number:`MSG-${Date.now()}`, total_amount:0, status:'pending', order_date:new Date().toISOString().slice(0,10), expected_delivery:null }); }catch(err){ console.warn('Supabase log error', err); } } this.closeWhatsModal(); }

  exportCSV(){ const rows=[["name","trade_name","cnpj","state_registration","phone","email","cep","state","city","address","status","rating","total_orders","last_order_date","is_active"]]; (window.SUP_STATE.suppliers||[]).forEach(s=>{ rows.push([s.name,s.trade_name,s.cnpj,s.state_registration||'',s.phone,s.email||'',s.cep||'',s.state||'',s.city||'',s.address||'',s.status||'active',String(s.rating||0),String(s.total_orders||0),s.last_order_date||'',s.is_active?'true':'false']); }); const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='fornecedores.csv'; a.click(); URL.revokeObjectURL(url); }

  handleImportFile(ev){ const f=ev.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const txt=r.result; const lines=String(txt).split(/\r?\n/).filter(l=>l.trim().length); const head=lines.shift(); const cols=head.split(',').map(h=>h.replace(/(^\"|\"$)/g,'').trim()); const idx=n=>cols.indexOf(n); const imp=lines.map(line=>{ const cells=line.split(',').map(c=>c.replace(/(^\"|\"$)/g,'').replace(/""/g,'"')); return { id:this.randId(), name:cells[idx('name')]||'', trade_name:cells[idx('trade_name')]||'', cnpj:cells[idx('cnpj')]||'', state_registration:cells[idx('state_registration')]||'', phone:cells[idx('phone')]||'', email:cells[idx('email')]||'', cep:cells[idx('cep')]||'', state:cells[idx('state')]||'', city:cells[idx('city')]||'', address:cells[idx('address')]||'', status:cells[idx('status')]||'active', rating:Number(cells[idx('rating')]||0), total_orders:Number(cells[idx('total_orders')]||0), last_order_date:cells[idx('last_order_date')]||'', is_active:(cells[idx('is_active')]||'true')==='true' }; }); window.SUP_STATE.suppliers=imp; this.renderGrid(); }; r.readAsText(f,'utf-8'); ev.target.value=''; }

  // Utils
  randId(){ if(window.crypto&&crypto.randomUUID) return crypto.randomUUID(); return 'sup-'+Math.random().toString(36).slice(2); }
}