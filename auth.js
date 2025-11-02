(function(){
  // Validation helpers
  function isValidSupabaseUrl(u){ return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(String(u||'').trim()); }
  function isValidAnonKey(k){ return typeof k === 'string' && k.trim().split('.').length === 3; }

  // Util: obter configs Supabase
  function getSupabaseConfig(){
    const global = window.AUTO_GESTOR_CONFIG || {};
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem('cfg')||'{}'); } catch(e) {}
    const lsUrl = stored?.cfgSupabaseUrl;
    const lsKey = stored?.cfgSupabaseAnonKey;
    const sUrl = isValidSupabaseUrl(lsUrl) ? String(lsUrl).trim() : String(global.supabaseUrl||'').trim();
    const sKey = isValidAnonKey(lsKey) ? String(lsKey).trim() : String(global.supabaseAnonKey||'').trim();
    return { sUrl, sKey };
  }

  function createClient(persist){
    const { sUrl, sKey } = getSupabaseConfig();
    if(!sUrl || !sKey) { throw new Error('Configuração do Supabase ausente. Preencha URL e Anon Key nas Configurações.'); }
    return window.supabase?.createClient ? window.supabase.createClient(sUrl, sKey, {
      auth: { persistSession: !!persist, autoRefreshToken: false }
    }) : window.Supabase?.createClient?.(sUrl, sKey, { auth: { persistSession: !!persist, autoRefreshToken: false } });
  }
  const redirectIndex = window.location.origin + '/index.html';

  // Toggle entre formulários
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const forms = {
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    recoveryForm: document.getElementById('recoveryForm')
  };
  function activateForm(targetId){
    // botões
    toggleBtns.forEach(btn => {
      const active = btn.getAttribute('data-target') === targetId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    // forms
    Object.keys(forms).forEach(id => {
      const el = forms[id]; if(!el) return;
      const active = id === targetId;
      el.classList.toggle('active', active);
      el.hidden = !active;
    });
  }
  toggleBtns.forEach(btn => btn.addEventListener('click', () => activateForm(btn.getAttribute('data-target'))));
  document.querySelectorAll('.switch-link').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); activateForm(a.getAttribute('data-target')); }));

  // Toggle visibilidade de senha
  document.querySelectorAll('.toggle-pass').forEach(t => {
    t.addEventListener('click', () => {
      const id = t.getAttribute('data-target');
      const input = document.getElementById(id);
      if(!input) return;
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      t.querySelector('i').className = type==='password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
    });
  });

  // Validações simples
  function validateEmail(v){ return /.+@.+\..+/.test(String(v||'').trim()); }
  function setFeedback(el, msg, type){ if(!el) return; el.textContent = msg||''; el.className = 'feedback ' + (type||''); }

  // Login
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginFeedback = document.getElementById('loginFeedback');
  const rememberMe = document.getElementById('rememberMe');
  const forgotPassLink = document.getElementById('forgotPassLink');

  loginForm?.addEventListener('input', () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    document.getElementById('loginEmailErr').textContent = validateEmail(email) ? '' : 'E-mail inválido';
    document.getElementById('loginPasswordErr').textContent = pass && pass.length>=6 ? '' : 'Senha mínima de 6 caracteres';
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if(!validateEmail(email)) { setFeedback(loginFeedback, 'Informe um e-mail válido.', 'error'); return; }
    if(!password || password.length<6) { setFeedback(loginFeedback, 'Senha mínima de 6 caracteres.', 'error'); return; }
    loginBtn.classList.add('loading'); loginBtn.disabled = true; setFeedback(loginFeedback, 'Entrando...', '');
    try {
      const client = createClient(!!rememberMe?.checked);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if(error) throw error;
      setFeedback(loginFeedback, 'Login realizado! Redirecionando...', 'success');
      window.location.href = redirectIndex;
    } catch(err){
      setFeedback(loginFeedback, err?.message || 'Falha no login.', 'error');
    } finally {
      loginBtn.classList.remove('loading'); loginBtn.disabled = false;
    }
  });

  // Esqueci a senha
  forgotPassLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    if(!validateEmail(email)) { setFeedback(loginFeedback, 'Informe seu e-mail para recuperar.', 'error'); return; }
    try {
      const client = createClient(true);
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth.html' });
      if(error) throw error;
      setFeedback(loginFeedback, 'Verifique seu e-mail para redefinir a senha.', 'success');
    } catch(err){ setFeedback(loginFeedback, err?.message || 'Falha ao enviar instruções.', 'error'); }
  });

  // Cadastro
  const suForm = document.getElementById('registerForm');
  const suBtn = document.getElementById('signupBtn');
  const suFeedback = document.getElementById('signupFeedback');

  function validateSignup(){
    const name = document.getElementById('suName').value.trim();
    const email = document.getElementById('suEmail').value.trim();
    const phone = document.getElementById('suPhone').value.trim();
    const company = document.getElementById('suCompany').value.trim();
    const pass = document.getElementById('suPassword').value;
    const confirm = document.getElementById('suConfirm').value;
    const terms = document.getElementById('suTerms').checked;
    document.getElementById('suNameErr').textContent = name?'' : 'Informe o nome';
    document.getElementById('suEmailErr').textContent = validateEmail(email)?'' : 'E-mail inválido';
    document.getElementById('suPhoneErr').textContent = phone? '' : 'Informe o telefone';
    document.getElementById('suCompanyErr').textContent = company? '' : 'Informe a empresa';
    document.getElementById('suPasswordErr').textContent = pass && pass.length>=6?'' : 'Min. 6 caracteres';
    document.getElementById('suConfirmErr').textContent = (confirm===pass)?'' : 'Senhas diferentes';
    return name && validateEmail(email) && phone && company && pass && pass.length>=6 && confirm===pass && terms;
  }
  suForm?.addEventListener('input', () => validateSignup());
  suForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!validateSignup()){ setFeedback(suFeedback, 'Verifique os campos e aceite os termos.', 'error'); return; }
    const name = document.getElementById('suName').value.trim();
    const email = document.getElementById('suEmail').value.trim();
    const phone = document.getElementById('suPhone').value.trim();
    const company = document.getElementById('suCompany').value.trim();
    const password = document.getElementById('suPassword').value;
    suBtn.classList.add('loading'); suBtn.disabled = true; setFeedback(suFeedback, 'Criando conta...', '');
    try {
      const client = createClient(true);
      const { data, error } = await client.auth.signUp({
        email, password,
        options: {
          data: { name, phone, company },
          emailRedirectTo: redirectIndex
        }
      });
      if(error) throw error;
      if(data.user && !data.session){
        setFeedback(suFeedback, 'Cadastro realizado! Confirme seu e-mail para entrar.', 'success');
      } else {
        setFeedback(suFeedback, 'Cadastro realizado! Redirecionando...', 'success');
        window.location.href = redirectIndex;
      }
    } catch(err){
      setFeedback(suFeedback, err?.message || 'Falha no cadastro.', 'error');
    } finally { suBtn.classList.remove('loading'); suBtn.disabled = false; }
  });

  // OAuth
  document.getElementById('oauthGoogle')?.addEventListener('click', async () => {
    try { const client = createClient(true); await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectIndex } }); }
    catch(err){ setFeedback(loginFeedback, err?.message || 'Erro no Google OAuth', 'error'); }
  });
  document.getElementById('oauthFacebook')?.addEventListener('click', async () => {
    try { const client = createClient(true); await client.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo: redirectIndex } }); }
    catch(err){ setFeedback(loginFeedback, err?.message || 'Erro no Facebook OAuth', 'error'); }
  });
  document.getElementById('oauthGoogle2')?.addEventListener('click', async () => {
    try { const client = createClient(true); await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectIndex } }); }
    catch(err){ setFeedback(suFeedback, err?.message || 'Erro no Google OAuth', 'error'); }
  });
  document.getElementById('oauthFacebook2')?.addEventListener('click', async () => {
    try { const client = createClient(true); await client.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo: redirectIndex } }); }
    catch(err){ setFeedback(suFeedback, err?.message || 'Erro no Facebook OAuth', 'error'); }
  });

  // Fluxo de recuperação e verificação de sessão com proteção de configuração
  (async function handleRecovery(){
    let client = null;
    try {
      client = createClient(true);
    } catch (err) {
      const fb = document.getElementById('loginFeedback');
      if (fb) { setFeedback(fb, 'Configure Supabase URL e Anon Key em Configurações para entrar.', 'error'); }
      // Sem config, permanecer na tela de autenticação sem redirecionar
      return;
    }
    const hash = window.location.hash || '';
    if(/type=password_recovery|type=recovery/i.test(hash)){
      activateForm('recoveryForm');
      const reForm = document.getElementById('recoveryForm');
      const reBtn = document.getElementById('recoveryBtn');
      const reFeedback = document.getElementById('recoveryFeedback');
      reForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('rePassword').value;
        if(!newPass || newPass.length<6) { setFeedback(reFeedback, 'Senha mínima de 6 caracteres.', 'error'); return; }
        reBtn.classList.add('loading'); reBtn.disabled = true; setFeedback(reFeedback, 'Atualizando...', '');
        try {
          const { error } = await client.auth.updateUser({ password: newPass });
          if(error) throw error;
          setFeedback(reFeedback, 'Senha atualizada! Entre novamente.', 'success');
          setTimeout(() => { window.location.href = window.location.origin + '/auth.html'; }, 1500);
        } catch(err){ setFeedback(reFeedback, err?.message || 'Falha ao atualizar senha.', 'error'); }
        finally { reBtn.classList.remove('loading'); reBtn.disabled = false; }
      });
    } else {
      try {
        // Se usuário já logado, ir para index
        const { data } = await client.auth.getSession();
        if(data?.session) { window.location.href = redirectIndex; }
      } catch(e) { /* Sem sessão ou falha, permanecer na tela de login */ }
    }
  })();
})();