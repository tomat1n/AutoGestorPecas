(function(){
  let init=false, curId=null, type='pf';
  window.initClientsOnce=function(){
    if(init) return; init=true;
    try{initSupabase?.();}catch{}
    const supa=window.supabaseClient||null;
    const s=window.CLIENTS_STATE=window.CLIENTS_STATE||{clients:[]};
    const section=document.getElementById('clientsSection');
    const q=(id)=> section ? section.querySelector('#'+id) : document.getElementById(id);
    const e={form:q('clientForm'), save:q('clientSaveBtn'), reset:q('clientResetBtn'), del:q('clientDeleteBtn'), whats:q('clientWhatsBtn'), name:q('clientName'), doc:q('clientDocument'), phone:q('clientPhone'), email:q('clientEmail'), cep:q('clientCEP'), uf:q('clientState'), city:q('clientCity'), addr:q('clientAddress'), search:q('clientSearch'), grid:q('clientsGrid'), typeToggle:section?.querySelector('.type-toggle'), vehiclesList:q('clientVehiclesList'), openVeh:q('openVehicleModalBtn')};
    const vehicleModal=document.getElementById('vehicleModal');
    const vehPlate=document.getElementById('vehPlate');
    const vehModel=document.getElementById('vehModel');
    const vehYear=document.getElementById('vehYear');
    const vehColor=document.getElementById('vehColor');
    const saveVehBtn=document.getElementById('saveVehicleBtn');
    const closeVehBtn=document.getElementById('closeVehicleModalBtn');

    // Helper: identifica se o id já é do banco (evita ids locais C-xxxxx)
    function isDbId(v){ return !!v && !String(v).startsWith('C-'); }

    if(e.form) e.form.addEventListener('submit',ev=>{ev.preventDefault(); save();});
    if(e.save) e.save.addEventListener('click',ev=>{ev.preventDefault(); save();});
    if(e.reset) e.reset.addEventListener('click',clear);
    if(e.del) e.del.addEventListener('click',remove);
    if(e.whats) e.whats.addEventListener('click',()=>{
      const ph=(e.phone?.value||'').replace(/\D/g,''); if(!ph){alert('Informe o telefone.');return;} window.open(`https://wa.me/55${ph}`,'_blank');
    });
    if(e.search) e.search.addEventListener('input',render);
    if(e.typeToggle) e.typeToggle.querySelectorAll('.type-option').forEach(o=>o.addEventListener('click',()=>{ e.typeToggle.querySelectorAll('.type-option').forEach(t=>t.classList.remove('active')); o.classList.add('active'); type=o.dataset.type||'pf'; }));

    // Carregar apenas do Supabase quando disponível; fallback para localStorage caso indisponível
    render();
    if(supa){ loadClientsFromSupabase().catch(err=>console.warn('Falha ao carregar clientes do Supabase:', err)); }
    else { try{ const raw=localStorage.getItem('clients'); if(raw){ s.clients=JSON.parse(raw)||[]; render(); } }catch{} }

    function get(){ return { id:curId, type, name:(e.name?.value||'').trim(), document:(e.doc?.value||'').trim(), phone:(e.phone?.value||'').trim(), email:(e.email?.value||'').trim(), cep:(e.cep?.value||'').trim(), state:(e.uf?.value||'').trim(), city:(e.city?.value||'').trim(), address:(e.addr?.value||'').trim(), is_active:true }; }
    function set(c){ curId=c.id; type=c.type||'pf'; if(e.typeToggle){ e.typeToggle.querySelectorAll('.type-option').forEach(t=>t.classList.toggle('active',(t.dataset.type||'pf')===type)); } if(e.name) e.name.value=c.name||''; if(e.doc) e.doc.value=c.document||''; if(e.phone) e.phone.value=c.phone||''; if(e.email) e.email.value=c.email||''; if(e.cep) e.cep.value=c.cep||''; if(e.uf) e.uf.value=c.state||''; if(e.city) e.city.value=c.city||''; if(e.addr) e.addr.value=c.address||''; renderVehicles(); }
    function clear(){ curId=null; ['name','doc','phone','email','cep','uf','city','addr'].forEach(k=>{ const m={name:e.name,doc:e.doc,phone:e.phone,email:e.email,cep:e.cep,uf:e.uf,city:e.city,addr:e.addr}[k]; if(m) m.value=''; }); e.vehiclesList && (e.vehiclesList.innerHTML=''); }
    function store(){ try{ localStorage.setItem('clients', JSON.stringify(s.clients)); }catch{} }
    function render(){
      if(!e.grid) return;
      const term=(e.search?.value||'').trim().toLowerCase();
      const list=s.clients.filter(c=>!term||[c.name,c.document,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(term)));
      if(list.length===0){
        e.grid.innerHTML='<div class="empty">Nenhum cliente</div>';
        return;
      }
      e.grid.innerHTML = `
        <table class="ar-table" id="clientsTable">
          <thead>
            <tr>
              <th>Nome/Razão Social</th>
              <th>CPF/CNPJ</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Veículos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="clientsTableBody"></tbody>
        </table>
      `;
      const tbody = e.grid.querySelector('#clientsTableBody');
      const rowsHtml = list.map(c => `
        <tr data-id="${c.id}">
          <td>${c.name||'—'}</td>
          <td>${c.document||''}</td>
          <td>${c.phone||''}</td>
          <td>${c.email||''}</td>
          <td>${Array.isArray(c.vehicles)?c.vehicles.length:0}</td>
          <td><button class="btn btn-secondary btn-select" data-id="${c.id}">Selecionar</button></td>
        </tr>
      `).join('');
      if(tbody) tbody.innerHTML = rowsHtml;
      tbody?.querySelectorAll('tr').forEach(row=>{
        row.addEventListener('click', (ev)=>{
          if(ev.target && ev.target.matches('.btn-select')) return;
          const id=row.getAttribute('data-id');
          const c = s.clients.find(x=>String(x.id)===String(id));
          if(c) set(c);
        });
      });
      tbody?.querySelectorAll('.btn-select').forEach(btn=>{
        btn.addEventListener('click', (ev)=>{
          ev.stopPropagation();
          const id=btn.getAttribute('data-id');
          const c = s.clients.find(x=>String(x.id)===String(id));
          if(c) set(c);
        });
      });
    }
    async function loadClientsFromSupabase(){
      try{
        const { data: clients, error: errClients } = await supa.from('clients').select('*').eq('is_active', true).order('name', { ascending: true });
        if(errClients) throw errClients;
        let vehiclesByClient = {};
        try{
          const { data: vehicles, error: errVeh } = await supa.from('client_vehicles').select('*').eq('is_active', true);
          if(errVeh) throw errVeh;
          vehiclesByClient = (vehicles||[]).reduce((acc,v)=>{ const cid=v.client_id; (acc[cid]=acc[cid]||[]).push({ id:v.id, plate:v.plate, model:v.model, year:v.year, color:v.color, is_active: v.is_active!==false }); return acc; },{});
        }catch(e){ vehiclesByClient = {}; }
        s.clients = (clients||[]).map(row=>({
          id: row.id,
          type: row.type||'pf',
          name: row.name||'',
          document: row.doc || row.document || '',
          phone: row.phone||'',
          email: row.email||'',
          cep: row.cep||'',
          state: row.state||'',
          city: row.city||'',
          address: row.address||'',
          is_active: row.is_active!==false,
          vehicles: vehiclesByClient[row.id]||[]
        }));
        try{ store(); }catch{}
        render();
      }catch(err){ console.warn('Falha ao carregar clientes do Supabase:', err); }
    }

    async function save(){
      const c=get();
      if(!c.name||!c.document||!c.phone){ alert('Preencha Nome, Documento e Telefone.'); return; }
      const supa = window.supabaseClient || null;
      // Fluxo DB-first quando Supabase está disponível
      if(supa){
        try{
          const now = new Date().toISOString();
          const payload = { name: c.name, type: c.type||type, doc: c.document, phone: c.phone, email: c.email, is_active: true, updated_at: now };
          let dbId = curId;
          if(isDbId(curId)){
            // Atualiza registro existente
            const { data, error } = await supa.from('clients').update(payload).eq('id', curId).select('id').single();
            if(error) throw error;
            dbId = data?.id || curId;
          } else {
            // Insere novo registro, id gerado pelo banco (uuid)
            const { data, error } = await supa.from('clients').insert(payload).select('id').single();
            if(error) throw error;
            dbId = data?.id;
          }
          if(!dbId){ throw new Error('Falha ao obter id do cliente no Supabase.'); }
          c.id = dbId; curId = dbId;
          // Atualiza estado local e recarrega da base para refletir somente o que está no Supabase
          const i=s.clients.findIndex(x=>x.id===dbId);
          if(i>=0) s.clients[i] = { ...s.clients[i], ...c };
          else s.clients.push({ ...c, vehicles: s.clients.find(x=>x.id===dbId)?.vehicles || [] });
          try{ store(); }catch{}
          await (typeof loadClientsFromSupabase==='function' ? loadClientsFromSupabase() : Promise.resolve());
          const saved = (window.CLIENTS_STATE?.clients||[]).find(x=>x.id===dbId) || c;
          render(); set(saved);
          alert('Cliente salvo com sucesso!');
          return;
        } catch(ex){
          console.warn('Erro ao salvar cliente no Supabase:', ex);
          alert('Falha ao salvar cliente no Supabase: ' + (ex?.message||ex));
          return;
        }
      }
      // Fallback local quando Supabase indisponível
      if(!c.id){ c.id='C-'+Math.floor(100000+Math.random()*900000); curId=c.id; }
      const id=c.id;
      const i=s.clients.findIndex(x=>x.id===id);
      if(i>=0) s.clients[i]={...s.clients[i],...c}; else s.clients.push({...c, vehicles:[]});
      store(); render(); set(c);
      alert('Cliente salvo localmente. Conecte ao Supabase para sincronizar.');
    }
    function remove(){ if(!curId){ alert('Selecione um cliente para excluir.'); return; } s.clients=s.clients.filter(c=>c.id!==curId); store(); if(supa){ supa.from('clients').update({is_active:false}).eq('id',curId).catch(()=>{}); } clear(); render(); alert('Cliente excluído.'); }
    // Bind vehicle modal actions
    e.openVeh?.addEventListener('click', openVehicleModal);
    closeVehBtn?.addEventListener('click', closeVehicleModal);
    saveVehBtn?.addEventListener('click', saveVehicle);
    function renderVehicles(){ const list=e.vehiclesList; if(!list) return; list.innerHTML=''; const client=(window.CLIENTS_STATE?.clients||[]).find(c=>c.id===curId); const vehicles=(client?.vehicles||[]).slice(); if(vehicles.length===0){ list.innerHTML='<div class="empty">Nenhum veículo</div>'; return; } vehicles.forEach(v=>{ const row=document.createElement('div'); row.className='vehicle-row'; row.innerHTML=`<div>${v.plate||'—'} • ${v.model||'—'} ${v.year?('• '+v.year):''} ${v.color?('• '+v.color):''}</div>`; list.appendChild(row); }); }
    function openVehicleModal(){ vehicleModal?.classList.add('active'); }
    function closeVehicleModal(){ vehicleModal?.classList.remove('active'); }
    async function saveVehicle(){
      const plate=(vehPlate?.value||'').trim().toUpperCase();
      const model=(vehModel?.value||'').trim();
      const year=vehYear?.value?Number(vehYear.value):null;
      const color=(vehColor?.value||'').trim();
      if(!plate||!model){ alert('Informe Placa e Modelo.'); return; }
      const supa = window.supabaseClient || null;
      if(!isDbId(curId)){
        // Garante que o cliente tenha um id do banco antes de salvar veículo
        await save();
        if(!isDbId(curId)){ alert('Falha ao obter ID do cliente no banco.'); return; }
      }
      const idx=s.clients.findIndex(c=>c.id===curId);
      if(idx<0){ alert('Selecione/salve o cliente antes de adicionar veículo.'); return; }
      const cli=s.clients[idx];
      cli.vehicles=cli.vehicles||[];
      let veh=cli.vehicles.find(v=>String(v.plate||'').toUpperCase()===plate);
      if(veh){ Object.assign(veh,{ model, year, color }); }
      else { veh={ id:'V-'+Math.floor(100000+Math.random()*900000), plate, model, year, color, is_active:true }; cli.vehicles.push(veh); }

      // Supabase sync (obrigatória para refletir no Table Editor)
      if(supa){
        try{
          const payload={
            client_id: curId,
            plate,
            model,
            year,
            color,
            is_active: true,
            updated_at: new Date().toISOString()
          };
          const { data, error } = await supa.from('client_vehicles').upsert(payload,{ onConflict:'client_id,plate' }).select('id').single();
          if(error) throw error;
          if(data?.id){ veh.id = data.id; }
          try{ store(); }catch{}
          await (typeof loadClientsFromSupabase==='function' ? loadClientsFromSupabase() : Promise.resolve());
          renderVehicles();
          closeVehicleModal();
          if(vehPlate) vehPlate.value=''; if(vehModel) vehModel.value=''; if(vehYear) vehYear.value=''; if(vehColor) vehColor.value='';
          alert('Veículo salvo com sucesso!');
          return;
        }catch(ex){
          console.warn('Erro ao salvar veículo no Supabase:', ex);
          alert('Falha ao salvar veículo no Supabase: ' + (ex?.message||ex));
          return;
        }
      }

      // Fallback local
      try{ localStorage.setItem('clients', JSON.stringify(s.clients)); }catch{}
      renderVehicles();
      closeVehicleModal();
      if(vehPlate) vehPlate.value=''; if(vehModel) vehModel.value=''; if(vehYear) vehYear.value=''; if(vehColor) vehColor.value='';
      alert('Veículo salvo localmente. Conecte ao Supabase para sincronizar.');
    }

  };
})();