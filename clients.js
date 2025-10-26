(function(){
  let init=false, curId=null, type='pf';
  window.initClientsOnce=function(){
    if(init) return; init=true;
    try{initSupabase?.();}catch{}
    const supa=window.supabaseClient||null;
    const s=window.CLIENTS_STATE=window.CLIENTS_STATE||{clients:[]};
    const section=document.getElementById('clientsSection');
    const q=(id)=> section ? section.querySelector('#'+id) : document.getElementById(id);
    const e={form:q('clientForm'), save:q('clientSaveBtn'), reset:q('clientResetBtn'), del:q('clientDeleteBtn'), whats:q('clientWhatsBtn'), name:q('clientName'), doc:q('clientDocument'), phone:q('clientPhone'), email:q('clientEmail'), cep:q('clientCEP'), uf:q('clientState'), city:q('clientCity'), addr:q('clientAddress'), search:q('clientSearch'), grid:q('clientsGrid'), typeToggle:section?.querySelector('.type-toggle')};

    if(e.form) e.form.addEventListener('submit',ev=>{ev.preventDefault(); save();});
    if(e.save) e.save.addEventListener('click',ev=>{ev.preventDefault(); save();});
    if(e.reset) e.reset.addEventListener('click',clear);
    if(e.del) e.del.addEventListener('click',remove);
    if(e.whats) e.whats.addEventListener('click',()=>{
      const ph=(e.phone?.value||'').replace(/\D/g,''); if(!ph){alert('Informe o telefone.');return;} window.open(`https://wa.me/55${ph}`,'_blank');
    });
    if(e.search) e.search.addEventListener('input',render);
    if(e.typeToggle) e.typeToggle.querySelectorAll('.type-option').forEach(o=>o.addEventListener('click',()=>{ e.typeToggle.querySelectorAll('.type-option').forEach(t=>t.classList.remove('active')); o.classList.add('active'); type=o.dataset.type||'pf'; }));

    try{ const raw=localStorage.getItem('clients'); if(raw){ s.clients=JSON.parse(raw)||[]; } }catch{}
    render();

    function get(){ return { id:curId, type, name:(e.name?.value||'').trim(), document:(e.doc?.value||'').trim(), phone:(e.phone?.value||'').trim(), email:(e.email?.value||'').trim(), cep:(e.cep?.value||'').trim(), state:(e.uf?.value||'').trim(), city:(e.city?.value||'').trim(), address:(e.addr?.value||'').trim(), is_active:true }; }
    function set(c){ curId=c.id; type=c.type||'pf'; if(e.typeToggle){ e.typeToggle.querySelectorAll('.type-option').forEach(t=>t.classList.toggle('active',(t.dataset.type||'pf')===type)); } if(e.name) e.name.value=c.name||''; if(e.doc) e.doc.value=c.document||''; if(e.phone) e.phone.value=c.phone||''; if(e.email) e.email.value=c.email||''; if(e.cep) e.cep.value=c.cep||''; if(e.uf) e.uf.value=c.state||''; if(e.city) e.city.value=c.city||''; if(e.addr) e.addr.value=c.address||''; }
    function clear(){ curId=null; ['name','doc','phone','email','cep','uf','city','addr'].forEach(k=>{ const m={name:e.name,doc:e.doc,phone:e.phone,email:e.email,cep:e.cep,uf:e.uf,city:e.city,addr:e.addr}[k]; if(m) m.value=''; }); }
    function store(){ try{ localStorage.setItem('clients', JSON.stringify(s.clients)); }catch{} }
    function render(){ if(!e.grid) return; const term=(e.search?.value||'').trim().toLowerCase(); const list=s.clients.filter(c=>!term||[c.name,c.document,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(term))); e.grid.innerHTML=list.length?'':'<div class="empty">Nenhum cliente</div>'; list.forEach(c=>{ const d=document.createElement('div'); d.className='client-card'; d.innerHTML=`<div class="client-title">${c.name||'—'}</div><div class="client-sub">${c.document||''} • ${c.phone||''}</div><div class="client-sub">${c.email||''}</div>`; d.addEventListener('click',()=>set(c)); e.grid.appendChild(d); }); }
    async function save(){ const c=get(); if(!c.name||!c.document||!c.phone){ alert('Preencha Nome, Documento e Telefone.'); return; } if(!c.id){ c.id='C-'+Math.floor(100000+Math.random()*900000); curId=c.id; } let id=c.id; if(supa){ const payload={...c, updated_at:new Date().toISOString()}; try{ const { data, error }=await supa.from('clients').upsert(payload,{onConflict:'id'}).select('id').single(); if(!error && data?.id){ id=data.id; c.id=data.id; curId=data.id; } }catch(ex){ console.warn('Supabase upsert clientes:', ex); } } const i=s.clients.findIndex(x=>x.id===id); if(i>=0) s.clients[i]={...s.clients[i],...c}; else s.clients.push({...c}); store(); render(); set(c); alert('Cliente salvo com sucesso!'); }
    function remove(){ if(!curId){ alert('Selecione um cliente para excluir.'); return; } s.clients=s.clients.filter(c=>c.id!==curId); store(); if(supa){ supa.from('clients').update({is_active:false}).eq('id',curId).catch(()=>{}); } clear(); render(); alert('Cliente excluído.'); }
  };
})();