document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa Supabase
  try { initSupabase?.(); } catch {}

  // Evitar flash: esconder menus/cards/seções até aplicar permissões
  try {
    document.querySelectorAll('.menu-item[data-page]').forEach((item) => {
      if (item.getAttribute('data-page') !== 'logout') item.classList.add('hidden');
    });
    const financeSectionEarly = document.querySelector('.finance-cards');
    if (financeSectionEarly) financeSectionEarly.classList.add('hidden');
    const quickSectionEarly = document.querySelector('.quick-section');
    if (quickSectionEarly) quickSectionEarly.classList.add('hidden');
    const idsToHide = ['pdvSection','osSection','inventorySection','receivablesSection','payablesSection','reportsSection','clientsSection','suppliersSection','nfSection','checklistSection','configSection','config-section'];
    idsToHide.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
  } catch {}

  // Gate de autenticação mínimo
  try {
    const cfgLS = (()=>{ try { return JSON.parse(localStorage.getItem('cfg')||'{}'); } catch { return {}; } })();
    const autoCfg = window.AUTO_GESTOR_CONFIG || {};
    const isValidUrl = (u) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(String(u||'').trim());
    const isValidKey = (k) => typeof k === 'string' && k.trim().split('.').length === 3;
    const hasUrlLS = isValidUrl(cfgLS?.cfgSupabaseUrl);
    const hasKeyLS = isValidKey(cfgLS?.cfgSupabaseAnonKey);
    const hasUrlAuto = isValidUrl(autoCfg?.supabaseUrl);
    const hasKeyAuto = isValidKey(autoCfg?.supabaseAnonKey);
    const hasSupaConfig = (hasUrlLS && hasKeyLS) || (hasUrlAuto && hasKeyAuto);
    const supabase = window.supabaseClient;
    // Se não há configuração do Supabase, tentar preencher automaticamente a partir de AUTO_GESTOR_CONFIG
    if (!hasSupaConfig) {
      try {
        if (hasUrlAuto && hasKeyAuto) {
          const merged = { ...(cfgLS||{}), cfgSupabaseUrl: autoCfg.supabaseUrl, cfgSupabaseAnonKey: autoCfg.supabaseAnonKey };
          localStorage.setItem('cfg', JSON.stringify(merged));
          // Inicializa imediatamente com as configs automáticas
          try { initSupabase?.(); } catch {}
        }
        localStorage.setItem('cfg.activeTab','integrations');
      } catch {}
    } else if (supabase) {
      // Com configuração válida, não exigir sessão; permitir uso anônimo
      try { await supabase.auth.getSession(); } catch {}
    }
  } catch (e) { console.warn('Falha ao verificar autenticação:', e); }

  // Aplicar visibilidade por permissões o quanto antes para evitar flash
  try { await applyMenuVisibilityByPermissions(); } catch {}
  // Fallback: se permissões não foram aplicadas, evitar esconder tudo
  try {
    const applied = document.body.getAttribute('data-permissions-applied') === 'true';
    if (!applied) {
      document.querySelectorAll('.menu-item[data-page]').forEach((item) => {
        if (item.getAttribute('data-page') !== 'logout') item.classList.remove('hidden');
      });
      const financeSectionEarly = document.querySelector('.finance-cards');
      if (financeSectionEarly) financeSectionEarly.classList.remove('hidden');
      const quickSectionEarly = document.querySelector('.quick-section');
      if (quickSectionEarly) quickSectionEarly.classList.remove('hidden');
    }
  } catch {}

  // Ativa menu e navegação
  setupMenuActiveState();
  // Ações de header e atualização de data/hora
  setupHeaderActions();
  setupSidebarToggle();
  setupDateTimeUpdater();
  // Atalhos rápidos
  setupQuickShortcuts();
  // Leitor de código de barras (QuaggaJS + modal)
  try { setupBarcodeScannerModule(); } catch (e) { console.warn('Falha ao configurar módulo de leitor:', e); }
  
  // Atualiza cards do dashboard com dados do Supabase
  try {
    const supabase = window.supabaseClient;
    let hasSession = false;
    if (supabase && supabase.auth?.getSession) {
      const { data } = await supabase.auth.getSession();
      hasSession = !!data?.session;
    }
    const canDashboard = await canViewPage('dashboard');
    const financeSection = document.querySelector('.finance-cards');
    if (!canDashboard && financeSection) financeSection.classList.add('hidden');
    if (hasSession && canDashboard && window.dashboardData && typeof window.dashboardData.updateDashboardCards === 'function') {
    await window.dashboardData.updateDashboardCards();
    // Configurar navegação dos cards após carregar dados
    setupDashboardNavigation();
  }
  } catch (error) {
    console.warn('Erro ao atualizar dashboard:', error);
  }
  
  // Abre seção padrão: Configurações se faltar Supabase, senão Dashboard
  try {
    const cfgLS = (()=>{ try { return JSON.parse(localStorage.getItem('cfg')||'{}'); } catch { return {}; } })();
    const isValidUrl = (u) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(String(u||'').trim());
    const isValidKey = (k) => typeof k === 'string' && k.trim().split('.').length === 3;
    const hasUrl = isValidUrl(cfgLS?.cfgSupabaseUrl||'');
    const hasKey = isValidKey(cfgLS?.cfgSupabaseAnonKey||'');
    const autoCfg = window.AUTO_GESTOR_CONFIG || {};
    const hasUrlAuto = isValidUrl(autoCfg?.supabaseUrl||'');
    const hasKeyAuto = isValidKey(autoCfg?.supabaseAnonKey||'');
    let defaultPage = ((hasUrl && hasKey) || (hasUrlAuto && hasKeyAuto)) ? 'dashboard' : 'config';
    try {
      const lastPage = localStorage.getItem('lastPage');
      if (hasUrl && hasKey && lastPage) {
        const okLast = await canViewPage(lastPage);
        if (okLast) defaultPage = lastPage;
      }
    } catch {}
    // Já aplicado anteriormente para evitar flash
    try {
      const ok = await canViewPage(defaultPage);
      if (!ok) {
        const ordered = ['checklist','dashboard','pdv','estoque','clientes','fornecedores','receber','pagar','relatorios','config'];
        for (const p of ordered) {
          if (await canViewPage(p)) { defaultPage = p; break; }
        }
      }
    } catch {}
    navigateTo(defaultPage);
  } catch { navigateTo('dashboard'); }
});

// ==============================
// Módulo: Leitor de Código de Barras (QuaggaJS)
// ==============================
function setupBarcodeScannerModule() {
  // Garante objeto global com API simples para iniciar/parar e callback de detecção
  const modal = document.getElementById('barcodeScannerModal');
  const viewport = document.getElementById('barcode-scanner-viewport');
  const closeBtn = modal?.querySelector('.btn-close-scanner');

  const openModal = () => { try { modal?.classList.add('active'); } catch {} };
  const closeModal = () => { try { modal?.classList.remove('active'); } catch {} };

  function start() {
    try {
      if (!window.Quagga) throw new Error('Biblioteca QuaggaJS não carregada');
      openModal();
      const targetEl = viewport || modal || document.body;
      window.Quagga.init({
        inputStream: {
          type: 'LiveStream',
          target: targetEl,
          constraints: {
            facingMode: 'environment', // câmera traseira em dispositivos móveis
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        locator: { patchSize: 'medium', halfSample: true },
        decoder: {
          readers: [
            'ean_reader', 'ean_8_reader',
            'code_128_reader', 'code_39_reader', 'code_39_vin_reader',
            'upc_reader', 'upc_e_reader',
            'codabar_reader'
          ]
        },
        locate: true
      }, (err) => {
        if (err) {
          console.error('Quagga init error:', err);
          alert('Não foi possível acessar a câmera. Verifique permissões do navegador.');
          closeModal();
          return;
        }
        try { window.Quagga.start(); } catch (e) { console.error('Falha ao iniciar Quagga:', e); }
      });

      // Registra detecção
      window.Quagga.onDetected((result) => {
        try {
          const code = result?.codeResult?.code || result?.code || '';
          // Tolerância: só aciona para códigos com 6+ dígitos/caracteres
          if (!code || String(code).length < 6) return;
          if (typeof window.barcodeScanner?.onDetected === 'function') {
            try { window.barcodeScanner.onDetected(result); } catch (e) { console.warn('onDetected lançou erro:', e); }
          }
        } finally {
          try { stop(); } catch {}
        }
      });
    } catch (e) {
      console.error('Falha ao iniciar leitor:', e);
      alert('Leitor de código de barras indisponível: ' + (e?.message || e));
      closeModal();
    }
  }

  function stop() {
    try { window.Quagga?.stop?.(); } catch {}
    closeModal();
  }

  // Expõe API global
  window.barcodeScanner = {
    onDetected: null,
    startBarcodeScanner: start,
    stopBarcodeScanner: stop
  };

  // Botão de fechar do modal
  if (closeBtn) closeBtn.addEventListener('click', () => { try { stop(); } catch {} });
  // Fechar com ESC
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { try { stop(); } catch {} } });
}

// ==============================
// Permissões: utilitários centrais
// ==============================
const PAGE_TO_MODULE = {
  dashboard: 'dashboard',
  pdv: 'vendas',
  os: 'vendas', // mapeado para vendas (serviços não possuem módulo próprio)
  servicos: 'vendas', // mapeado para vendas (serviços fazem parte do módulo de vendas)
  estoque: 'estoque',
  receber: 'financeiro',
  pagar: 'financeiro',
  relatorios: 'relatorios',
  clientes: 'clientes',
  fornecedores: 'fornecedores',
  nf: 'financeiro',
  config: 'configuracoes',
  checklist: 'checklist'
};

const APP_PERMISSIONS_DEFAULT = {
  administrador: {
    dashboard: { view: true, edit: true },
    vendas: { view: true, create: true, edit: true, delete: true },
    estoque: { view: true, create: true, edit: true, delete: true },
    financeiro: { view: true, create: true, edit: true, delete: true },
    clientes: { view: true, create: true, edit: true, delete: true },
    fornecedores: { view: true, create: true, edit: true, delete: true },
    relatorios: { view: true, export: true },
    configuracoes: { view: true, edit: true },
    usuarios: { view: true, create: true, edit: true, delete: true },
    checklist: { view: true, create: true, edit: true, delete: true }
  },
  gerente: {
    dashboard: { view: true, edit: true },
    vendas: { view: true, create: true, edit: true, delete: true },
    estoque: { view: true, create: true, edit: true, delete: false },
    financeiro: { view: true, create: false, edit: false, delete: false },
    clientes: { view: true, create: true, edit: true, delete: false },
    fornecedores: { view: true, create: true, edit: true, delete: false },
    relatorios: { view: true, export: true },
    configuracoes: { view: true, edit: false },
    usuarios: { view: true, create: true, edit: true, delete: false },
    checklist: { view: true, create: true, edit: true, delete: false }
  },
  vendedor: {
    dashboard: { view: true, edit: false },
    vendas: { view: true, create: true, edit: true, delete: false },
    estoque: { view: true, create: false, edit: false, delete: false },
    financeiro: { view: false, create: false, edit: false, delete: false },
    clientes: { view: true, create: true, edit: true, delete: false },
    fornecedores: { view: true, create: false, edit: false, delete: false },
    relatorios: { view: false, export: false },
    configuracoes: { view: false, edit: false },
    usuarios: { view: false, create: false, edit: false, delete: false },
    checklist: { view: true, create: true, edit: true, delete: false }
  },
  tecnico: {
    dashboard: { view: false, edit: false },
    vendas: { view: false, create: false, edit: false, delete: false },
    estoque: { view: false, create: false, edit: false, delete: false },
    financeiro: { view: false, create: false, edit: false, delete: false },
    clientes: { view: false, create: false, edit: false, delete: false },
    fornecedores: { view: false, create: false, edit: false, delete: false },
    relatorios: { view: false, export: false },
    configuracoes: { view: false, edit: false },
    usuarios: { view: false, create: false, edit: false, delete: false },
    checklist: { view: true, create: true, edit: true, delete: false }
  }
};

// Normaliza nome de papel para chave de APP_PERMISSIONS_DEFAULT
function toRoleKey(role) {
  try {
    const base = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const map = {
      administrador: 'administrador',
      admin: 'administrador',
      adm: 'administrador',
      gerente: 'gerente',
      manager: 'gerente',
      vendedor: 'vendedor',
      'vendedor(a)': 'vendedor',
      tecnico: 'tecnico',
      'tecnico(a)': 'tecnico',
      tecnico_mecanico: 'tecnico'
    };
    return map[base] || base;
  } catch { return 'vendedor'; }
}

function notifyNoPermission(message) {
  try {
    if (window.userManager && typeof window.userManager.showToast === 'function') {
      window.userManager.showToast(message, 'warning');
      return;
    }
  } catch {}
  alert(message);
}

async function getCurrentPermissionsCached() {
  try {
    if (window.CURRENT_PERMISSIONS) return window.CURRENT_PERMISSIONS;

    const supabase = window.supabaseClient;
    let roleCandidate = null;
    let savedPerms = null;

    // Permissões/role do gerenciador de usuários (se disponível)
    if (window.userManager?.currentUser) {
      roleCandidate = window.userManager.currentUser.role || roleCandidate;
      savedPerms = window.userManager.currentUser.permissions || savedPerms;
    }

    // Dados do usuário autenticado
    if (supabase && supabase.auth?.getUser) {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      const email = data?.user?.email || null;
      const roleMeta = data?.user?.user_metadata?.role || null;
      roleCandidate = roleCandidate || roleMeta;

      // Buscar registro na tabela users para obter permissões persistidas
      const tryLoadBy = async (field, value) => {
        try {
          const { data: rows } = await supabase
            .from('users')
            .select('permissions,role')
            .eq(field, value)
            .limit(1);
          if (Array.isArray(rows) && rows.length) {
            savedPerms = savedPerms || rows[0].permissions || null;
            roleCandidate = roleCandidate || rows[0].role || null;
            return true;
          }
        } catch {}
        return false;
      };

      if (uid) {
        await tryLoadBy('id', uid);
      } else if (email) {
        await tryLoadBy('email', email);
      }
    }

    const mergeWithDefaults = (permsObj, roleName) => {
      try {
        const roleKey = toRoleKey(roleName);
        const defaults = APP_PERMISSIONS_DEFAULT[roleKey] || {};
        const result = { ...defaults };
        Object.keys(permsObj || {}).forEach((mod) => {
          const modDefaults = defaults[mod] || {};
          result[mod] = { ...modDefaults, ...permsObj[mod] };
        });
        if (roleKey === 'administrador') {
          const adminChecklist = { ...(defaults.checklist||{}), ...(permsObj?.checklist||{}) };
          adminChecklist.view = true;
          result.checklist = adminChecklist;

          // Administrador deve sempre ter acesso às configurações
          const adminConfig = { ...(defaults.configuracoes||{}), ...(permsObj?.configuracoes||{}) };
          adminConfig.view = true;
          adminConfig.edit = true;
          result.configuracoes = adminConfig;
        }
        return result;
      } catch {
        const roleKey = toRoleKey(roleName);
        return permsObj || (APP_PERMISSIONS_DEFAULT[roleKey] || APP_PERMISSIONS_DEFAULT.vendedor);
      }
    };

    const roleKeyFinal = toRoleKey(roleCandidate);
    const merged = mergeWithDefaults(savedPerms, roleKeyFinal);
    window.CURRENT_PERMISSIONS = merged;
    window.CURRENT_ROLE = roleKeyFinal || 'vendedor';
    return merged;
  } catch {
    const perms = APP_PERMISSIONS_DEFAULT.vendedor;
    window.CURRENT_PERMISSIONS = perms;
    window.CURRENT_ROLE = 'vendedor';
    return perms;
  }
}

async function canViewPage(page) {
  try {
    // Garantir reconhecimento de admin pelo e-mail, caso metadados não estejam disponíveis
    try {
      const { data } = await (window.supabaseClient?.auth?.getUser?.() || Promise.resolve({ data: undefined }));
      const email = data?.user?.email?.toLowerCase();
      if (email === 'dcar@autogestorpecas.com' && window.CURRENT_ROLE !== 'administrador') {
        window.CURRENT_ROLE = 'administrador';
      }
    } catch {}
    const perms = await getCurrentPermissionsCached();
    const module = PAGE_TO_MODULE[page] || 'dashboard';
    // Administrador sempre tem acesso ao checklist
    if (page === 'checklist' && window.CURRENT_ROLE === 'administrador') return true;
    // Administrador sempre pode ver Configurações
    if (page === 'config' && window.CURRENT_ROLE === 'administrador') return true;
    return perms?.[module]?.view === true;
  } catch { return true; }
}

async function applyMenuVisibilityByPermissions() {
  try {
    const perms = await getCurrentPermissionsCached();
    const items = document.querySelectorAll('.menu-item[data-page]');
    items.forEach((item) => {
      const page = item.getAttribute('data-page');
      if (page === 'logout') return; // sempre visível
      const module = PAGE_TO_MODULE[page] || page;
      const allowed = perms?.[module]?.view === true;
      if (!allowed) item.classList.add('hidden'); else item.classList.remove('hidden');
    });

    const cards = document.querySelectorAll('.quick-card');
    const pageMap = {
      'ordem de serviço':'os',
      'venda (pdv)':'pdv',
      'estoque':'estoque',
      'notas fiscais':'nf',
      'clientes':'clientes',
      'a receber':'receber',
      'a pagar':'pagar'
    };
    cards.forEach(card => {
      const key = (card.getAttribute('data-module')||'').toLowerCase();
      const page = pageMap[key];
      if (!page) return;
      const module = PAGE_TO_MODULE[page] || page;
      const allowed = perms?.[module]?.view === true;
      if (!allowed) card.classList.add('hidden'); else card.classList.remove('hidden');
    });

    // Finance cards (dashboard metrics) visíveis apenas se dashboard for permitido
    const financeSection = document.querySelector('.finance-cards');
    const canDashboard = perms?.dashboard?.view === true;
    if (financeSection) {
      if (!canDashboard) financeSection.classList.add('hidden');
      else financeSection.classList.remove('hidden');
    }

    // Sinaliza que permissões foram aplicadas para liberar o gate visual
    try { document.body.setAttribute('data-permissions-applied', 'true'); } catch {}
  } catch (e) { console.warn('Falha ao aplicar visibilidade por permissão:', e); }
}

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
  // Gate de visualização por permissão
  if (page !== 'logout') {
    const allowed = await canViewPage(page);
    if (!allowed) {
      const module = PAGE_TO_MODULE[page] || page;
      notifyNoPermission(`Você não tem permissão para visualizar: ${module}.`);
      // Fallback para primeira página permitida, priorizando checklist
      const ordered = ['checklist','dashboard','pdv','estoque','clientes','fornecedores','receber','pagar','relatorios','config'];
      for (const p of ordered) {
        if (await canViewPage(p)) { page = p; break; }
      }
    }
  }

  // Atualiza estado ativo do menu conforme a página navegada
  try {
    const items = document.querySelectorAll('.menu-item');
    items.forEach(i => i.classList.remove('active'));
    const target = document.querySelector(`.menu-item[data-page="${page}"]`);
    if (target) target.classList.add('active');
  } catch {}

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
  const servicosSection = document.getElementById('servicesSection');

  const sections = [pdvSection, osSection, inventorySection, receivablesSection, payablesSection, reportsSection, clientsSection, suppliersSection, nfSection, checklistSection, settingsSection, servicosSection];
  sections.forEach(sec => { if (sec) sec.classList.add('hidden'); });

  const quickSection = document.querySelector('.quick-section');
  if (quickSection) {
    const showDashboard = page === 'dashboard' && (await canViewPage('dashboard'));
    if (showDashboard) quickSection.classList.remove('hidden');
    else quickSection.classList.add('hidden');
  }

  switch (page) {
    case 'dashboard':
      break;
    case 'pdv':
      if (pdvSection) pdvSection.classList.remove('hidden');
      try { await initPDVOnce?.(); } catch {}
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
    case 'servicos':
      if (servicosSection) servicosSection.classList.remove('hidden');
      try { initServicesOnce?.(); } catch {}
      break;
    case 'logout':
      try {
        const supabase = window.supabaseClient;
        if (supabase?.auth) {
          // Apenas tenta logout se houver sessão
          try {
            const { data } = await supabase.auth.getSession();
            const hasSession = !!data?.session;
            if (hasSession) {
              try {
                // Escopo global para limpar todas as sessões; erros de abort são inofensivos
                await supabase.auth.signOut({ scope: 'global' });
              } catch (err) {
                const msg = String(err?.message || err || '').toLowerCase();
                if (msg.includes('abort') || msg.includes('err_aborted')) {
                  console.warn('Logout abortado pela navegação; ignorando.');
                } else {
                  console.warn('Falha ao sair:', err);
                }
              }
              // Pequeno atraso para permitir que eventos de auth sejam processados
              await new Promise(r => setTimeout(r, 150));
            }
          } catch (err) {
            console.warn('Falha ao verificar sessão para logout:', err);
          }
        }
      } catch (e) { console.warn('Falha ao sair (wrapper):', e); }
      try { window.location.replace('auth.html'); return; } catch {}
      return;
    default:
      if (pdvSection) pdvSection.classList.remove('hidden');
      try { await initPDVOnce?.(); } catch {}
  }

  // Persistir página atual para evitar salto ao atualizar (F5)
  try { localStorage.setItem('lastPage', page); } catch {}
  // Libera o gate visual após navegação
  try { document.body.setAttribute('data-permissions-applied', 'true'); } catch {}
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
async function initPDVOnce() {
  console.log('Inicializando PDV...');
  // Configuração de handlers e carrinho apenas uma vez
  if (!PDV_INITIALIZED) {
    PDV_INITIALIZED = true;
    initShoppingCart();
    setupPDVEvents();
    setupSalesHistoryEvents();
    console.log('PDV handlers e carrinho configurados (one-time).');
  }

  // Garantir que os produtos estejam carregados antes de renderizar o PDV
  if (!window.INV_STATE || !Array.isArray(window.INV_STATE.products) || window.INV_STATE.products.length === 0) {
    console.log('Produtos não encontrados no INV_STATE, carregando do Supabase...');
    try {
      const loaded = await loadInventoryFromSupabase();
      console.log('Produtos carregados do Supabase:', loaded ? loaded.length : 0);
      console.log('Dados carregados:', loaded);
      if (Array.isArray(loaded) && loaded.length > 0) {
        window.INV_STATE = window.INV_STATE || {};
        window.INV_STATE.products = loaded;
        console.log('Produtos atribuídos ao INV_STATE');
      } else {
        console.log('Nenhum produto carregado ou array vazio; mantendo estado atual.');
      }
    } catch (error) {
      console.error('Falha ao carregar produtos do Supabase para o PDV:', error);
    }
  } else {
    console.log('Produtos já carregados no INV_STATE:', window.INV_STATE.products.length);
  }

  // Sempre tentar renderizar os produtos ao abrir a aba PDV
  try {
    console.log('Chamando renderPDVProducts...');
    renderPDVProducts?.();
  } catch (error) {
    console.error('Erro ao chamar renderPDVProducts:', error);
  }
  console.log('PDV inicialização/render concluídos.');
}

// Configurar eventos do histórico de vendas
function setupSalesHistoryEvents() {
  const btnSalesHistory = document.getElementById('btnSalesHistory');
  if (btnSalesHistory) {
    btnSalesHistory.addEventListener('click', openSalesHistoryModal);
  }
  
  // Configurar filtros
  const periodFilter = document.getElementById('salesPeriodFilter');
  const salesSearch = document.getElementById('salesSearch');
  
  if (periodFilter) {
    periodFilter.addEventListener('change', function() {
      const customDateRange = document.getElementById('customDateRange');
      const customDateRangeEnd = document.getElementById('customDateRangeEnd');
      if (this.value === 'custom') {
        customDateRange.style.display = 'block';
        customDateRangeEnd.style.display = 'block';
      } else {
        customDateRange.style.display = 'none';
        customDateRangeEnd.style.display = 'none';
      }
      loadSalesHistory();
    });
  }
  
  if (salesSearch) {
    salesSearch.addEventListener('input', debounce(loadSalesHistory, 300));
  }
}

// Debounce para pesquisa
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Abrir modal de histórico de vendas
function openSalesHistoryModal() {
  const modal = document.getElementById('salesHistoryModal');
  if (modal) {
    modal.style.display = 'block';
    loadSalesHistory();
  }
}

// Fechar modal de histórico de vendas
function closeSalesHistoryModal() {
  const modal = document.getElementById('salesHistoryModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Fechar modal de detalhes da venda
function closeSaleDetailsModal() {
  const modal = document.getElementById('saleDetailsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Imprimir recibo a partir do modal de detalhes
function printSaleReceiptFromDetails() {
  if (window.currentSaleId) {
    printSaleReceipt(window.currentSaleId);
  } else {
    alert('Nenhuma venda selecionada para impressão');
  }
}

// Configurar navegação dos cards do dashboard
function setupDashboardNavigation() {
  // Card de Vendas no Mês -> Histórico de Vendas
  const vendasMesCard = document.querySelector('[data-card="vendas-mes"]');
  if (vendasMesCard) {
    vendasMesCard.style.cursor = 'pointer';
    vendasMesCard.addEventListener('click', function() {
      // Navegar para a seção de PDV e abrir histórico
      navigateToSection('pdv');
      setTimeout(() => {
        openSalesHistoryModal();
      }, 300);
    });
  }
  
  // Card de Margem Bruta -> Relatórios Financeiros
  const margemBrutaCard = document.querySelector('[data-card="margem-bruta"]');
  if (margemBrutaCard) {
    margemBrutaCard.style.cursor = 'pointer';
    margemBrutaCard.addEventListener('click', function() {
      navigateToSection('reports');
      // Focar na aba de relatórios financeiros
      setTimeout(() => {
        const financeTab = document.querySelector('[data-tab="financial"]');
        if (financeTab) financeTab.click();
      }, 300);
    });
  }
  
  // Card de Despesas -> Contas a Pagar
  const despesasCard = document.querySelector('[data-card="despesas-mes"]');
  if (despesasCard) {
    despesasCard.style.cursor = 'pointer';
    despesasCard.addEventListener('click', function() {
      navigateToSection('accounts-payable');
    });
  }
  
  // Card de Vendas no Ano -> Relatórios de Vendas
  const vendasAnoCard = document.querySelector('[data-card="vendas-ano"]');
  if (vendasAnoCard) {
    vendasAnoCard.style.cursor = 'pointer';
    vendasAnoCard.addEventListener('click', function() {
      navigateToSection('reports');
      // Focar na aba de relatórios de vendas
      setTimeout(() => {
        const salesTab = document.querySelector('[data-tab="sales"]');
        if (salesTab) salesTab.click();
      }, 300);
    });
  }
}

// Navegar para seção específica
function navigateToSection(section) {
  const menuItem = document.querySelector(`[data-page="${section}"]`);
  if (menuItem) {
    menuItem.click();
  }
}

// Carregar histórico de vendas
async function loadSalesHistory() {
  try {
    const supabase = window.supabaseClient;
    if (!supabase) {
      throw new Error('Cliente Supabase não inicializado');
    }
    
    const periodFilter = document.getElementById('salesPeriodFilter');
    const searchTerm = document.getElementById('salesSearch')?.value || '';
    
    let query = supabase
      .from('sales')
      .select(`
        id,
        created_at,
        client_name,
        client_document,
        total,
        payment_method,
        status,
        sale_items (name, quantity, unit_price)
      `)
      .order('created_at', { ascending: false });
    
    // Aplicar filtro de período
    if (periodFilter && periodFilter.value !== 'custom') {
      const now = new Date();
      let startDate;
      
      switch (periodFilter.value) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
    } else if (periodFilter?.value === 'custom') {
      const startDate = document.getElementById('startDate')?.value;
      const endDate = document.getElementById('endDate')?.value;
      
      if (startDate) {
        query = query.gte('created_at', startDate + 'T00:00:00');
      }
      if (endDate) {
        query = query.lte('created_at', endDate + 'T23:59:59');
      }
    }
    
    // Aplicar filtro de busca
    if (searchTerm) {
      query = query.or(`client_name.ilike.%${searchTerm}%,client_document.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`);
    }
    
    const { data: sales, error } = await query;
    
    if (error) throw error;
    
    renderSalesHistory(sales || []);
    updateSalesStats(sales || []);
    
  } catch (error) {
    console.error('Erro ao carregar histórico de vendas:', error);
    const salesList = document.getElementById('salesHistoryList');
    if (salesList) {
      salesList.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 20px; text-align: center; color: #dc3545;">
            <i class="fa-solid fa-exclamation-triangle"></i> Erro ao carregar histórico
          </td>
        </tr>
      `;
    }
  }
}

// Renderizar lista de vendas
function renderSalesHistory(sales) {
  const salesList = document.getElementById('salesHistoryList');
  if (!salesList) return;
  
  if (sales.length === 0) {
    salesList.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 20px; text-align: center; color: #666;">
          <i class="fa-solid fa-search"></i> Nenhuma venda encontrada
        </td>
      </tr>
    `;
    return;
  }
  
  salesList.innerHTML = sales.map(sale => {
    const saleDate = new Date(sale.created_at);
    const formattedDate = saleDate.toLocaleDateString('pt-BR');
    const formattedTime = saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const itemsCount = sale.sale_items?.length || 0;
    const total = parseFloat(sale.total || 0);
    
    return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">
          <div style="font-weight: 500;">${formattedDate}</div>
          <div style="font-size: 12px; color: #666;">${formattedTime}</div>
        </td>
        <td style="padding: 10px; font-family: monospace; font-size: 12px;">${sale.id.substring(0, 8)}...</td>
        <td style="padding: 10px;">
          <div style="font-weight: 500;">${sale.client_name || 'Cliente não informado'}</div>
          <div style="font-size: 12px; color: #666;">${sale.client_document || ''}</div>
        </td>
        <td style="padding: 10px; text-align: center;">${itemsCount}</td>
        <td style="padding: 10px; font-weight: 600;">${formatCurrency(total)}</td>
        <td style="padding: 10px;">
          <span style="padding: 4px 8px; border-radius: 12px; background: #e8f5e8; color: #2e7d32; font-size: 12px;">
            ${sale.payment_method || 'N/A'}
          </span>
        </td>
        <td style="padding: 10px;">
          <button class="btn btn-sm btn-primary" onclick="viewSaleDetails('${sale.id}')" title="Ver detalhes">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="printSaleReceipt('${sale.id}')" title="Imprimir">
            <i class="fa-solid fa-print"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Atualizar estatísticas de vendas
function updateSalesStats(sales) {
  const totalSales = sales.length;
  const totalAmount = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
  const averageSale = totalSales > 0 ? totalAmount / totalSales : 0;
  const totalItems = sales.reduce((sum, sale) => sum + (sale.sale_items?.length || 0), 0);
  
  document.getElementById('totalSalesCount').textContent = totalSales;
  document.getElementById('totalSalesAmount').textContent = formatCurrency(totalAmount);
  document.getElementById('averageSaleAmount').textContent = formatCurrency(averageSale);
  document.getElementById('totalItemsSold').textContent = totalItems;
}

// Ver detalhes da venda
async function viewSaleDetails(saleId) {
  try {
    console.log('Carregando detalhes da venda:', saleId);
    
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Cliente Supabase não inicializado');
    
    // Buscar dados completos da venda
    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        id,
        created_at,
        client_name,
        client_document,
        client_phone,
        client_email,
        subtotal,
        discount,
        total,
        payment_method,
        sale_items (name, quantity, unit_price, total),
        thermal_doc_url,
        a4_doc_url,
        pdf_doc_url
      `)
      .eq('id', saleId)
      .single();
    
    if (error) throw error;
    if (!sale) throw new Error('Venda não encontrada');
    
    // Formatar dados da venda
    const saleDate = new Date(sale.created_at);
    const formattedDate = saleDate.toLocaleDateString('pt-BR');
    const formattedTime = saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Preencher o modal com os dados
    document.getElementById('saleDetailId').textContent = sale.id;
    document.getElementById('saleDetailDate').textContent = `${formattedDate} às ${formattedTime}`;
    document.getElementById('saleDetailClient').textContent = sale.client_name || 'Cliente não informado';
    document.getElementById('saleDetailDocument').textContent = sale.client_document || 'Não informado';
    document.getElementById('saleDetailPayment').textContent = sale.payment_method || 'Não informado';
    document.getElementById('saleDetailSubtotal').textContent = `R$ ${parseFloat(sale.subtotal || 0).toFixed(2)}`;
    document.getElementById('saleDetailDiscount').textContent = `R$ ${parseFloat(sale.discount || 0).toFixed(2)}`;
    document.getElementById('saleDetailTotal').textContent = `R$ ${parseFloat(sale.total || 0).toFixed(2)}`;
    
    // Preencher itens da venda
    const itemsTable = document.getElementById('saleDetailItems');
    itemsTable.innerHTML = '';
    
    if (sale.sale_items && sale.sale_items.length > 0) {
      sale.sale_items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>R$ ${parseFloat(item.unit_price || 0).toFixed(2)}</td>
          <td>R$ ${parseFloat(item.total || 0).toFixed(2)}</td>
        `;
        itemsTable.appendChild(row);
      });
    } else {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="4" style="text-align: center; color: #6c757d;">Nenhum item encontrado</td>';
      itemsTable.appendChild(row);
    }
    
    // Configurar botões de impressão - removido pois já está configurado no HTML
    
    // Armazenar o ID da venda atual para uso no botão de impressão
    window.currentSaleId = saleId;
    
    // Mostrar o modal
    const modal = document.getElementById('saleDetailsModal');
    if (modal) {
      modal.classList.add('active');
    } else {
      console.error('Modal de detalhes da venda não encontrado');
    }
    
  } catch (error) {
    console.error('Erro ao carregar detalhes da venda:', error);
    alert('Erro ao carregar detalhes da venda: ' + error.message);
  }
}

// Imprimir recibo da venda (térmica)
async function printSaleReceipt(saleId) {
  try {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Cliente Supabase não inicializado');
    
    // Buscar dados completos da venda
    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        id,
        created_at,
        client_name,
        client_document,
        total,
        discount,
        subtotal,
        payment_method,
        sale_items (name, quantity, unit_price, total)
      `)
      .eq('id', saleId)
      .single();
    
    if (error) throw error;
    if (!sale) throw new Error('Venda não encontrada');
    
    // Gerar conteúdo do recibo térmico
    const receiptContent = generateThermalReceipt(sale);
    
    // Abrir impressão térmica
    printThermalReceipt(receiptContent);
    
  } catch (error) {
    console.error('Erro ao imprimir recibo:', error);
    alert('Erro ao imprimir recibo: ' + error.message);
  }
}

// Gerar conteúdo para recibo térmico
function generateThermalReceipt(sale) {
  const saleDate = new Date(sale.created_at);
  const formattedDate = saleDate.toLocaleDateString('pt-BR');
  const formattedTime = saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  let content = `
================================
        D'CAR AUTO PEÇAS        
================================
Data: ${formattedDate} ${formattedTime}
Venda: ${sale.id.substring(0, 8)}
--------------------------------
`;
  
  if (sale.client_name) {
    content += `Cliente: ${sale.client_name}\n`;
    if (sale.client_document) {
      content += `Documento: ${sale.client_document}\n`;
    }
    content += '--------------------------------\n';
  }
  
  // Itens da venda
  sale.sale_items.forEach((item, index) => {
    content += `${item.quantity}x ${item.name.substring(0, 20)}\n`;
    content += `   R$ ${parseFloat(item.unit_price || 0).toFixed(2)} = R$ ${parseFloat(item.total || 0).toFixed(2)}\n`;
  });
  
  content += `
--------------------------------
Subtotal: R$ ${parseFloat(sale.subtotal || 0).toFixed(2)}
Desconto: R$ ${parseFloat(sale.discount || 0).toFixed(2)}
TOTAL: R$ ${parseFloat(sale.total || 0).toFixed(2)}
--------------------------------
Pagamento: ${sale.payment_method || 'Não informado'}
================================
        OBRIGADO VOLTE SEMPRE!  
================================
`;
  
  return content;
}

// Imprimir recibo térmico
function printThermalReceipt(content) {
  // Usar impressão térmica via navegador ou API de impressão
  const printWindow = window.open('', '_blank', 'width=320,height=600');
  if (!printWindow) {
    // Fallback: imprimir na impressora padrão
    window.print();
    return;
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Recibo Térmico</title>
      <style>
        @media print {
          body { 
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 280px;
            margin: 0;
            padding: 10px;
            line-height: 1.2;
          }
          .no-print { display: none; }
        }
        body { 
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 280px;
          margin: 0;
          padding: 10px;
          line-height: 1.2;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <pre>${content}</pre>
      <div class="no-print" style="margin-top: 20px;">
        <button onclick="window.print()">Imprimir</button>
        <button onclick="window.close()">Fechar</button>
      </div>
    </body>
    </html>
  `);
  
  printWindow.document.close();
}

// Exportar histórico para PDF
async function exportSalesToPDF() {
  try {
    const periodFilter = document.getElementById('salesPeriodFilter');
    const searchTerm = document.getElementById('salesSearch')?.value || '';
    
    // Buscar vendas com os filtros atuais
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Cliente Supabase não inicializado');
    
    let query = supabase
      .from('sales')
      .select(`
        id,
        created_at,
        client_name,
        client_document,
        total,
        payment_method,
        sale_items (name, quantity, unit_price)
      `)
      .order('created_at', { ascending: false });
    
    // Aplicar filtros (mesma lógica do loadSalesHistory)
    if (periodFilter && periodFilter.value !== 'custom') {
      const now = new Date();
      let startDate;
      
      switch (periodFilter.value) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
    } else if (periodFilter?.value === 'custom') {
      const startDate = document.getElementById('startDate')?.value;
      const endDate = document.getElementById('endDate')?.value;
      
      if (startDate) {
        query = query.gte('created_at', startDate + 'T00:00:00');
      }
      if (endDate) {
        query = query.lte('created_at', endDate + 'T23:59:59');
      }
    }
    
    if (searchTerm) {
      query = query.or(`client_name.ilike.%${searchTerm}%,client_document.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`);
    }
    
    const { data: sales, error } = await query;
    if (error) throw error;
    
    // Gerar PDF
    generateSalesPDF(sales || [], periodFilter?.value, searchTerm);
    
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    alert('Erro ao exportar PDF: ' + error.message);
  }
}

// Gerar PDF do histórico de vendas
function generateSalesPDF(sales, period, searchTerm) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert('Biblioteca de PDF não carregada. Use a impressão do navegador.');
    window.print();
    return;
  }
  
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;
  
  // Cabeçalho
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Relatório de Vendas - D\'Car Auto Peças', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const now = new Date();
  pdf.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
  y += 8;
  
  // Filtros aplicados
  if (period || searchTerm) {
    let filterText = 'Filtros: ';
    if (period) filterText += `Período: ${getPeriodLabel(period)}, `;
    if (searchTerm) filterText += `Busca: "${searchTerm}"`;
    
    pdf.text(filterText, margin, y);
    y += 8;
  }
  
  // Estatísticas
  const totalSales = sales.length;
  const totalAmount = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
  const averageSale = totalSales > 0 ? totalAmount / totalSales : 0;
  
  pdf.text(`Total de Vendas: ${totalSales} | Valor Total: ${formatCurrency(totalAmount)} | Média por Venda: ${formatCurrency(averageSale)}`, margin, y);
  y += 15;
  
  // Tabela de vendas
  if (sales.length > 0) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    // Cabeçalho da tabela
    pdf.text('Data', margin, y);
    pdf.text('Venda', margin + 30, y);
    pdf.text('Cliente', margin + 60, y);
    pdf.text('Valor', margin + 130, y);
    pdf.text('Pagamento', margin + 160, y);
    y += 6;
    
    // Linha separadora
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    pdf.setFont('helvetica', 'normal');
    
    // Itens da tabela
    sales.forEach((sale, index) => {
      if (y > 250) {
        pdf.addPage();
        y = margin;
      }
      
      const saleDate = new Date(sale.created_at);
      const formattedDate = saleDate.toLocaleDateString('pt-BR');
      
      pdf.text(formattedDate, margin, y);
      pdf.text(sale.id.substring(0, 8), margin + 30, y);
      pdf.text((sale.client_name || 'Cliente não informado').substring(0, 20), margin + 60, y);
      pdf.text(formatCurrency(parseFloat(sale.total || 0)), margin + 130, y);
      pdf.text(sale.payment_method || 'N/A', margin + 160, y);
      
      y += 6;
    });
  } else {
    pdf.text('Nenhuma venda encontrada com os filtros aplicados.', margin, y);
  }
  
  // Salvar PDF
  const fileName = `relatorio_vendas_${now.toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
}

// Obter label do período
function getPeriodLabel(period) {
  const labels = {
    'today': 'Hoje',
    'week': 'Esta Semana',
    'month': 'Este Mês',
    'year': 'Este Ano',
    'custom': 'Personalizado'
  };
  return labels[period] || period;
}

// Imprimir relatório (A4)
function printSalesReport() {
  // Usar impressão padrão do navegador para relatório A4
  window.print();
}

// Compartilhar via WhatsApp
function shareViaWhatsApp() {
  const periodFilter = document.getElementById('salesPeriodFilter');
  const searchTerm = document.getElementById('salesSearch')?.value || '';
  
  // Gerar mensagem para WhatsApp
  const now = new Date();
  const formattedDate = now.toLocaleDateString('pt-BR');
  const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  let message = `*Relatório de Vendas - D'Car Auto Peças*\n`;
  message += `Gerado em: ${formattedDate} ${formattedTime}\n\n`;
  
  if (periodFilter && periodFilter.value !== 'custom') {
    message += `*Período:* ${getPeriodLabel(periodFilter.value)}\n`;
  } else if (periodFilter?.value === 'custom') {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    if (startDate && endDate) {
      message += `*Período:* ${startDate} até ${endDate}\n`;
    }
  }
  
  if (searchTerm) {
    message += `*Busca:* "${searchTerm}"\n`;
  }
  
  message += `\n*Para visualizar o relatório completo em PDF, clique no botão "Exportar PDF" no histórico de vendas.*`;
  
  // Codificar mensagem para URL
  const encodedMessage = encodeURIComponent(message);
  
  // Abrir WhatsApp
  window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
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
    // Focar o campo por padrão ao abrir o PDV para facilitar uso de leitores USB
    setTimeout(() => { try { searchInput.focus(); } catch {} }, 200);
  }

  // Leitor de código de barras no PDV (câmera)
  const pdvScanBtn = document.getElementById('barcodeScannerBtn');
  if (pdvScanBtn) {
    pdvScanBtn.addEventListener('click', () => {
      if (window.barcodeScanner) {
        window.barcodeScanner.onDetected = (result) => {
          const code = result?.codeResult?.code || '';
          if (code) {
            const s = window.INV_STATE;
            const prod = s?.products?.find(p => String(p.barcode || '') === String(code));
            if (prod) {
              window.addToCart(prod, 1);
              try { searchInput?.value && (searchInput.value = code); } catch {}
            } else {
              // Preenche a busca com o código para o usuário localizar manualmente
              try { if (searchInput) { searchInput.value = code; renderPDVProducts?.(); } } catch {}
              alert('Produto não encontrado para o código: ' + code);
            }
          }
        };
        window.barcodeScanner.startBarcodeScanner();
      } else {
        alert('Leitor de código de barras indisponível.');
      }
    });
  }

  // Clique na área da busca (incluindo a lupa) foca o input
  try {
    document.querySelectorAll('.search-box').forEach(box => {
      box.addEventListener('click', (ev) => {
        // Evita interferir se o clique for em um botão (ex.: leitor de código de barras)
        if (ev.target.closest('button')) return;
        const input = box.querySelector('input, textarea');
        if (input) input.focus();
      });
    });
  } catch (_) {}

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
  console.log('Executando renderPDVProducts...');
  const s = window.INV_STATE;
  const grid = document.getElementById('productsGrid');
  console.log('INV_STATE:', s);
  console.log('productsGrid:', grid);
  console.log('Produtos disponíveis:', s?.products?.length || 0);
  if (!s || !grid) {
    console.log('INV_STATE ou grid não encontrados, saindo...');
    return;
  }
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
  // Checar permissão para criar venda
  try {
    const perms = await getCurrentPermissionsCached();
    if (!perms?.vendas?.create) {
      notifyNoPermission('Você não tem permissão para finalizar vendas.');
      return;
    }
  } catch {}

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
  const autoCfg = window.AUTO_GESTOR_CONFIG || {};
  const isValidUrl = (u) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(String(u||'').trim());
  const isValidKey = (k) => typeof k === 'string' && k.trim().split('.').length === 3;
  const urlCandidate = isValidUrl(cfgLS?.cfgSupabaseUrl) ? cfgLS?.cfgSupabaseUrl : autoCfg?.supabaseUrl;
  const keyCandidate = isValidKey(cfgLS?.cfgSupabaseAnonKey) ? cfgLS?.cfgSupabaseAnonKey : autoCfg?.supabaseAnonKey;
  const url = (isValidUrl(urlCandidate) ? urlCandidate : '').trim();
  const key = (isValidKey(keyCandidate) ? keyCandidate : '').trim();
  // Guarda cfg atual para diagnósticos/fallbacks
  window.SUPA_CFG = { url, key };
  // Não limpar tokens de auth aqui para não invalidar sessões persistidas

  const supaOptions = { auth: { persistSession: true, autoRefreshToken: false } };
  if (url && key && window.supabase) {
    window.supabaseClient = window.supabase.createClient(url, key, supaOptions);
  } else {
    window.supabaseClient = null;
  }

  // Inicializar cliente admin (service_role) se disponível — apenas desenvolvimento
  const svcCandidate = (cfgLS?.cfgSupabaseServiceKey || autoCfg?.supabaseServiceKey || '').trim();
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

  // Busca de serviços no PDV (campo específico do PDV)
  const pdvServiceSearch = document.getElementById('pdvServiceSearch');
  if (pdvServiceSearch) pdvServiceSearch.addEventListener('input', debounce(async (e) => {
    const term = e.target.value.trim();
    await searchPDVServices(term);
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

// Busca de serviços para o PDV (resultados aparecem no painel do PDV)
async function searchPDVServices(term) {
  const resultsEl = document.getElementById('pdvServiceResults');
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

  // Suporte a leitores USB (wedge): Enter no campo de código abre detalhes
  const invBarcodeInput = document.getElementById('invBarcode');
  if (invBarcodeInput) {
    invBarcodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = (invBarcodeInput.value || '').trim();
        if (!code) return;
        const found = window.INV_STATE?.products?.find(p => String(p.barcode || '') === code);
        if (found) showInventoryProductDetails(found);
        else alert('Produto não encontrado para o código: ' + code);
      }
    });
  }

  const saveBtn = document.getElementById('invSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const perms = await getCurrentPermissionsCached();
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
    // Gate: editar vs criar
    if (existing) {
      if (!perms?.estoque?.edit) { notifyNoPermission('Você não tem permissão para editar produtos do estoque.'); return; }
    } else {
      if (!perms?.estoque?.create) { notifyNoPermission('Você não tem permissão para criar produtos no estoque.'); return; }
    }
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
    const perms = await getCurrentPermissionsCached();
    if (!perms?.estoque?.delete) { notifyNoPermission('Você não tem permissão para excluir produtos do estoque.'); return; }
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
    const perms = await getCurrentPermissionsCached();
    if (!perms?.estoque?.edit) { notifyNoPermission('Você não tem permissão para movimentar estoque.'); return; }
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

async function updateHeaderUserName() {
  try {
    let name = null;
    if (window.userManager?.currentUser?.name) {
      name = window.userManager.currentUser.name;
    }
    if (!name) {
      const supabase = window.supabaseClient;
      if (supabase && supabase.auth?.getUser) {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id || null;
        const email = data?.user?.email || null;
        const metaName = data?.user?.user_metadata?.name || data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.profile || null;
        if (uid) {
          try {
            const { data: rows } = await supabase.from('users').select('name').eq('id', uid).limit(1);
            if (Array.isArray(rows) && rows.length) name = rows[0].name;
          } catch {}
        }
        if (!name) name = metaName || (email ? String(email).split('@')[0] : null);
      }
    }
    const el = document.getElementById('currentUserName') || document.getElementById('userNameBadge');
    if (el) el.textContent = name || 'Usuário';
  } catch (e) { console.warn('Falha ao atualizar nome do usuário:', e); }
}

setTimeout(() => { updateHeaderUserName().catch(()=>{}); }, 800);