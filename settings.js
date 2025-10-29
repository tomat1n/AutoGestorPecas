let settingsInit=false;
function initSettingsOnce(){
  if(settingsInit) return; settingsInit=true;
  const section=document.getElementById('configSection'); if(!section) return;
  const nav=[...section.querySelectorAll('.cfg-nav-item')];
  const cards=[...section.querySelectorAll('.cfg-card')];
  const showTab=(tab)=>{
    nav.forEach(n=>n.classList.toggle('active',n.dataset.cfgTab===tab));
    cards.forEach(c=>c.classList.toggle('hidden',c.dataset.tab!==tab));
    localStorage.setItem('cfg.activeTab',tab);
  };
  nav.forEach(n=>n.addEventListener('click',()=>showTab(n.dataset.cfgTab)));
  showTab(localStorage.getItem('cfg.activeTab')||'company');
  section.querySelector('#cfgSaveAllBtn')?.addEventListener('click',saveAll);
  section.querySelector('#cfgExportBtn')?.addEventListener('click',exportCfg);
  section.querySelector('#cfgImportFile')?.addEventListener('change',importCfg);
  populate();
}
function getCfg(){try{return JSON.parse(localStorage.getItem('cfg')||'{}')}catch(e){return {}}}
function setCfg(obj){localStorage.setItem('cfg',JSON.stringify(obj))}
function populate(){
  const cfg=getCfg();
  // Obter configurações do config.js como fallback
  const globalCfg = window.AUTO_GESTOR_CONFIG || {};
  
  const set=(id,val)=>{const el=document.getElementById(id); if(!el) return; if(el.type==='checkbox') el.checked=!!val; else if(el.type==='file'){} else el.value=(val??'');};
  
  // Função para obter valor com fallback do config.js
  const getValueWithFallback = (id, cfgValue) => {
    if (cfgValue !== undefined && cfgValue !== '') return cfgValue;
    // Usar valores do config.js como fallback para campos específicos do Supabase
    if (id === 'cfgSupabaseUrl') return globalCfg.supabaseUrl || '';
    if (id === 'cfgSupabaseAnonKey') return globalCfg.supabaseAnonKey || '';
    return cfgValue;
  };
  
  const ids=['cfgCompanyLegalName','cfgCompanyTradeName','cfgCompanyCNPJ','cfgCompanyIE','cfgCompanyAddress','cfgCompanyCity','cfgCompanyState','cfgCompanyPhone','cfgCompanyEmail','cfgNotifEmails','cfgPDVMaxDiscount','cfgPDVCouponMessage','cfgFiscalEnv','cfgFiscalCertPass','cfgFiscalSerie','cfgFiscalNumero','cfgFiscalCSC','cfgStockMinDefault','cfgStockMaxDefault','cfgCategoriesList','cfgBrandsList','cfgSecLoginAttempts','cfgSecLockTime','cfgSecSessionTime','cfgSupabaseUrl','cfgSupabaseAnonKey'];
  ids.forEach(id=>set(id,getValueWithFallback(id, cfg[id])));
  ['cfgNotifEmail','cfgNotifLowStock','cfgNotifDue','cfgNotifAutoReports','cfgPDVAutoPrint','cfgPDVPriceLookup','cfgPDVMaxDiscountToggle','cfgStockControl','cfgStockAllowNoStock','cfgBackupAutoToggle','cfgSecTwoFactor','cfgSecLockAfterAttempts'].forEach(id=>set(id,cfg[id]));
}
function collect(){
  const g=id=>document.getElementById(id);
  const v=id=>{const el=g(id); if(!el) return undefined; if(el.type==='checkbox') return el.checked; else return el.value};
  const data={};
  ['cfgCompanyLegalName','cfgCompanyTradeName','cfgCompanyCNPJ','cfgCompanyIE','cfgCompanyAddress','cfgCompanyCity','cfgCompanyState','cfgCompanyPhone','cfgCompanyEmail','cfgNotifEmails','cfgPDVMaxDiscount','cfgPDVCouponMessage','cfgFiscalEnv','cfgFiscalCertPass','cfgFiscalSerie','cfgFiscalNumero','cfgFiscalCSC','cfgStockMinDefault','cfgStockMaxDefault','cfgCategoriesList','cfgBrandsList','cfgSecLoginAttempts','cfgSecLockTime','cfgSecSessionTime','cfgSupabaseUrl','cfgSupabaseAnonKey'].forEach(id=>data[id]=v(id));
  ['cfgNotifEmail','cfgNotifLowStock','cfgNotifDue','cfgNotifAutoReports','cfgPDVAutoPrint','cfgPDVPriceLookup','cfgPDVMaxDiscountToggle','cfgStockControl','cfgStockAllowNoStock','cfgBackupAutoToggle','cfgSecTwoFactor','cfgSecLockAfterAttempts'].forEach(id=>data[id]=v(id));
  return data;
}
function saveAll(){ const cfgPrev=getCfg(); if(cfgPrev?.cfgBackupAutoToggle) createBackup(); setCfg(collect()); alert('Configurações salvas.'); }
function exportCfg(){ const blob=new Blob([JSON.stringify(getCfg(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='configuracoes.json'; a.click(); URL.revokeObjectURL(a.href); }
function importCfg(e){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); setCfg(data); populate(); alert('Configurações importadas.'); }catch(err){ alert('Falha ao importar JSON.'); } }; r.readAsText(f); e.target.value=''; }
function openModal(id){ const el=document.getElementById(id); if(el) el.classList.add('active'); }
function closeModal(id){ const el=document.getElementById(id); if(el) el.classList.remove('active'); }

const sectionKeys={
  company:['cfgCompanyLegalName','cfgCompanyTradeName','cfgCompanyCNPJ','cfgCompanyIE','cfgCompanyAddress','cfgCompanyCity','cfgCompanyState','cfgCompanyPhone','cfgCompanyEmail'],
  users:[],
  notif:['cfgNotifEmail','cfgNotifLowStock','cfgNotifDue','cfgNotifAutoReports','cfgNotifEmails'],
  pdv:['cfgPDVAutoPrint','cfgPDVPriceLookup','cfgPDVMaxDiscountToggle','cfgPDVMaxDiscount','cfgPDVCouponMessage'],
  fiscal:['cfgFiscalEnv','cfgFiscalCertPass','cfgFiscalSerie','cfgFiscalNumero','cfgFiscalCSC'],
  stock:['cfgStockControl','cfgStockAllowNoStock','cfgStockMinDefault','cfgStockMaxDefault'],
  categories:['cfgCategoriesList','cfgBrandsList'],
  security:['cfgSecTwoFactor','cfgSecLockAfterAttempts','cfgSecLoginAttempts','cfgSecLockTime','cfgSecSessionTime'],
  integrations:['cfgSupabaseUrl','cfgSupabaseAnonKey']
};

function saveSection(section){
  const keys=sectionKeys[section]||[];
  const all=collect(); const cfg=getCfg(); const updates={};
  keys.forEach(k=>{ updates[k]=all[k]; });
  if(cfg?.cfgBackupAutoToggle) createBackup();
  setCfg({...cfg,...updates});
  alert('Seção salva.');
}

function renderUsersList(){
  // Esta função agora é gerenciada pelo UserManager
  if (window.userManager) {
    window.userManager.renderUsersList();
  } else {
    const container=document.getElementById('cfgUsersList'); 
    if(container) container.innerHTML='<p>Carregando usuários...</p>';
  }
}
function escapeHTML(str){ return String(str).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m])); }

function addNewUser(){
  // Esta função agora é gerenciada pelo UserManager
  if (window.userManager) {
    window.userManager.saveUser();
  } else {
    alert('Sistema de usuários não está disponível.');
  }
}

function removeUser(userId){
  // Esta função agora é gerenciada pelo UserManager
  if (window.userManager) {
    const user = window.userManager.users.find(u => u.id === userId);
    if (user) {
      window.userManager.confirmDeleteUser(userId, user.name);
    }
  } else {
    alert('Sistema de usuários não está disponível.');
  }
}

function createBackup(){
  const cfg=getCfg();
  const stamp=new Date();
  const name=`backup-${stamp.getFullYear()}${String(stamp.getMonth()+1).padStart(2,'0')}${String(stamp.getDate()).padStart(2,'0')}-${String(stamp.getHours()).padStart(2,'0')}${String(stamp.getMinutes()).padStart(2,'0')}${String(stamp.getSeconds()).padStart(2,'0')}.json`;
  const blob=new Blob([JSON.stringify(cfg,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href);
  const hist=JSON.parse(localStorage.getItem('cfg.backups')||'[]');
  hist.unshift({name,createdAt:stamp.toISOString(),size:JSON.stringify(cfg).length});
  localStorage.setItem('cfg.backups',JSON.stringify(hist.slice(0,20)));
  renderBackups();
}

function renderBackups(){
  const el=document.getElementById('cfgBackupHistory'); if(!el) return;
  const hist=JSON.parse(localStorage.getItem('cfg.backups')||'[]'); if(!Array.isArray(hist)||hist.length===0){ el.innerHTML='<p>Nenhum backup encontrado.</p>'; return; }
  el.innerHTML=hist.map(b=>`<div style=\"padding:8px;border:1px solid #e5e7eb;border-radius:8px;display:flex;justify-content:space-between;align-items:center;\"><div>${escapeHTML(b.name)}<br><small>${new Date(b.createdAt).toLocaleString()}</small></div><a class=\"btn btn-secondary\" href=\"#\" onclick=\"return false\">Baixar</a></div>`).join('');
}

function restoreBackup(){
  const file=document.getElementById('cfgRestoreFile')?.files?.[0];
  const type=document.getElementById('cfgRestoreType')?.value||'completo';
  const pre=document.getElementById('cfgRestorePreBackup')?.checked;
  if(!file){ alert('Selecione um arquivo de backup (.json).'); return; }
  if(pre) createBackup();
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      if(type==='completo'){
        setCfg(data);
      }else{
        const merged={...getCfg(),...data};
        setCfg(merged);
      }
      populate();
      closeModal('cfgRestoreModal');
      alert('Backup restaurado.');
    }catch(err){
      alert('Arquivo de backup inválido.');
    }
  };
  r.readAsText(file);
}

function hookSettingsActions(){
  const bind=(id,fn)=>document.getElementById(id)?.addEventListener('click',fn);
  bind('cfgCompanySaveBtn',()=>saveSection('company'));
  bind('cfgUsersSaveBtn',()=>saveSection('users'));
  bind('cfgNotifSaveBtn',()=>saveSection('notif'));
  bind('cfgPDVSaveBtn',()=>saveSection('pdv'));
  bind('cfgFiscalSaveBtn',()=>saveSection('fiscal'));
  bind('cfgStockSaveBtn',()=>saveSection('stock'));
  bind('cfgCategoriesSaveBtn',()=>saveSection('categories'));
  bind('cfgSecSaveBtn',()=>saveSection('security'));
  bind('cfgSupabaseTestBtn',testSupabaseConn);
  bind('cfgSupabaseSaveBtn',()=>{ saveSection('integrations'); try{ initSupabase?.(); }catch{} alert('Supabase configurado.'); });

  bind('cfgNewUserCreateBtn',()=>openModal('cfgUserModal'));
  bind('userModalCancel',()=>closeModal('cfgUserModal'));
  bind('userModalCloseX',()=>closeModal('cfgUserModal'));
  document.getElementById('userModalAdd')?.addEventListener('click',addNewUser);

  bind('cfgBackupManualBtn',createBackup);
  bind('cfgBackupRestoreBtn',()=>openModal('cfgRestoreModal'));
  bind('restoreModalCancel',()=>closeModal('cfgRestoreModal'));
  bind('restoreModalCloseX',()=>closeModal('cfgRestoreModal'));
  document.getElementById('restoreModalConfirm')?.addEventListener('click',restoreBackup);
}

document.addEventListener('DOMContentLoaded',()=>{ initSettingsOnce(); hookSettingsActions(); renderUsersList(); renderBackups(); });

function testSupabaseConn(){
  const url=document.getElementById('cfgSupabaseUrl')?.value||'';
  const key=document.getElementById('cfgSupabaseAnonKey')?.value||'';
  const status=document.getElementById('cfgSupabaseStatus');
  if(!url||!key||!window.supabase){ status&&(status.textContent='Preencha URL e chave.'); alert('Preencha URL e Anon Key do Supabase.'); return; }
  try{
    const client=window.supabase.createClient(url.trim(), key.trim());
    client.from('service_orders').select('id').limit(1).then(({ data, error })=>{
      if(error){
        const msg=String(error.message||'');
        if(msg.toLowerCase().includes('fetch')||msg.toLowerCase().includes('failed')){
          status&&(status.textContent='Conexão falhou: verifique URL/Key.');
          alert('Conexão falhou: verifique URL e Anon Key.');
        }else{
          status&&(status.textContent='Conexão ok (tabelas podem estar ausentes).');
          alert('Conexão ok! As tabelas podem estar ausentes, mas a URL/Key funcionam.');
        }
      }else{
        status&&(status.textContent='Conexão ok.');
        alert('Conexão ok!');
      }
    }).catch(e=>{ status&&(status.textContent='Erro: '+e.message); alert('Erro ao testar: '+e.message); });
  }catch(e){ status&&(status.textContent='Erro: '+e.message); alert('Erro ao testar: '+e.message); }
}

// Inicializar sistema de usuários quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
  // Verificar se estamos na aba de configurações
  const settingsTab = document.querySelector('[data-page="settings"]');
  if (settingsTab) {
    // Inicializar UserManager quando necessário
    window.initializeUserSystem = function() {
      if (typeof UserManager !== 'undefined' && !window.userManager) {
        window.userManager = new UserManager();
        console.log('Sistema de usuários inicializado');
      }
    };
    
    // Inicializar quando a aba de configurações for clicada
    settingsTab.addEventListener('click', function() {
      setTimeout(() => {
        if (typeof UserManager !== 'undefined') {
          window.initializeUserSystem();
        }
      }, 100);
    });
  }
});