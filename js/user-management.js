// Sistema de Gerenciamento de Usuários
class UserManager {
    constructor() {
        this.currentUser = null;
        this.users = [];
        this.permissions = this.getDefaultPermissions();
        this.currentEditingUserId = null;
        this.init();
    }

    async init() {
        await this.loadCurrentUser();
        await this.loadUsers();
        this.setupEventListeners();
    }

    // Definições de permissões padrão por role
    getDefaultPermissions() {
        return {
            administrador: {
                dashboard: { view: true, edit: true },
                vendas: { view: true, create: true, edit: true, delete: true },
                estoque: { view: true, create: true, edit: true, delete: true },
                financeiro: { view: true, create: true, edit: true, delete: true },
                clientes: { view: true, create: true, edit: true, delete: true },
                fornecedores: { view: true, create: true, edit: true, delete: true },
                relatorios: { view: true, export: true },
                configuracoes: { view: true, edit: true },
                usuarios: { view: true, create: true, edit: true, delete: true }
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
                usuarios: { view: true, create: true, edit: true, delete: false }
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
                usuarios: { view: false, create: false, edit: false, delete: false }
            }
        };
    }

    // Carregar usuário atual (simulado - em produção viria da sessão)
    async loadCurrentUser() {
        try {
            // Por enquanto, vamos simular um usuário administrador
            // Usando um UUID válido em vez de '1'
            this.currentUser = {
                id: '00000000-0000-4000-8000-000000000001',
                name: 'Administrador',
                email: 'admin@autogestorpecas.com',
                role: 'administrador',
                permissions: this.permissions.administrador
            };
        } catch (error) {
            console.error('Erro ao carregar usuário atual:', error);
        }
    }

    // Carregar lista de usuários do Supabase
    async loadUsers() {
        try {
            if (!window.supabaseClient) {
                console.warn('Supabase não configurado');
                return;
            }

            const { data, error } = await window.supabaseClient
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao carregar usuários:', error);
                return;
            }

            this.users = data || [];
            this.renderUsersList();
            this.updateUserStats();
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    }

    // Criar novo usuário
    async createUser(userData) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase não configurado');
            }

            // Hash da senha (em produção, isso seria feito no backend)
            const passwordHash = await this.hashPassword(userData.password);

            const newUser = {
                name: userData.name,
                email: userData.email,
                password_hash: passwordHash,
                role: userData.role,
                status: 'ativo',
                permissions: this.permissions[userData.role] || this.permissions.vendedor,
                created_by: this.currentUser?.id
            };

            const { data, error } = await window.supabaseClient
                .from('users')
                .insert([newUser])
                .select();

            if (error) {
                throw error;
            }

            // Log da ação
            await this.logUserActivity('create_user', 'users', data[0].id, {
                created_user: data[0].name,
                role: data[0].role
            });

            await this.loadUsers();
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Erro ao criar usuário:', error);
            return { success: false, error: error.message };
        }
    }

    // Atualizar usuário
    async updateUser(userId, userData) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase não configurado');
            }

            const updateData = {
                name: userData.name,
                email: userData.email,
                role: userData.role,
                status: userData.status,
                permissions: userData.permissions || this.permissions[userData.role],
                updated_at: new Date().toISOString()
            };

            // Se a senha foi alterada, incluir o hash
            if (userData.password) {
                updateData.password_hash = await this.hashPassword(userData.password);
            }

            const { data, error } = await window.supabaseClient
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select();

            if (error) {
                throw error;
            }

            // Log da ação
            await this.logUserActivity('update_user', 'users', userId, {
                updated_fields: Object.keys(updateData)
            });

            await this.loadUsers();
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            return { success: false, error: error.message };
        }
    }

    // Deletar usuário
    async deleteUser(userId) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase não configurado');
            }

            if (userId === this.currentUser?.id) {
                throw new Error('Não é possível deletar seu próprio usuário');
            }

            const { error } = await window.supabaseClient
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) {
                throw error;
            }

            // Log da ação
            await this.logUserActivity('delete_user', 'users', userId);

            await this.loadUsers();
            return { success: true };
        } catch (error) {
            console.error('Erro ao deletar usuário:', error);
            return { success: false, error: error.message };
        }
    }

    // Log de atividades do usuário
    async logUserActivity(action, resource, resourceId, details = {}) {
        try {
            if (!window.supabaseClient || !this.currentUser) return;

            const logData = {
                user_id: this.currentUser.id,
                action,
                resource,
                resource_id: resourceId,
                details,
                ip_address: await this.getClientIP(),
                user_agent: navigator.userAgent
            };

            await window.supabaseClient
                .from('user_activity_log')
                .insert([logData]);
        } catch (error) {
            console.error('Erro ao registrar atividade:', error);
        }
    }

    // Obter IP do cliente (simulado)
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return '127.0.0.1';
        }
    }

    // Hash da senha (simulado - em produção usar bcrypt no backend)
    async hashPassword(password) {
        // Simulação de hash - em produção, isso seria feito no backend
        return `$2b$10$${btoa(password + 'salt').replace(/[^a-zA-Z0-9]/g, '').substring(0, 53)}`;
    }

    // Verificar permissões
    hasPermission(module, action) {
        if (!this.currentUser || !this.currentUser.permissions) return false;
        return this.currentUser.permissions[module]?.[action] === true;
    }

    // Renderizar lista de usuários
    renderUsersList() {
        const container = document.getElementById('usersList');
        if (!container) return;

        if (this.users.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-gray-500">Nenhum usuário encontrado</p>
                </div>
            `;
            return;
        }

        const usersHTML = this.users.map(user => `
            <div class="user-card bg-white rounded-lg shadow-sm border p-4 mb-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span class="text-blue-600 font-semibold">${user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                            <h4 class="font-semibold text-gray-900">${this.escapeHtml(user.name)}</h4>
                            <p class="text-sm text-gray-500">${this.escapeHtml(user.email)}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-1 text-xs rounded-full ${this.getRoleBadgeClass(user.role)}">
                            ${this.getRoleDisplayName(user.role)}
                        </span>
                        <span class="px-2 py-1 text-xs rounded-full ${this.getStatusBadgeClass(user.status)}">
                            ${this.getStatusDisplayName(user.status)}
                        </span>
                        <div class="flex space-x-1">
                            ${this.hasPermission('usuarios', 'edit') ? `
                                <button onclick="userManager.editUser('${user.id}')" 
                                        class="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                </button>
                            ` : ''}
                            ${this.hasPermission('usuarios', 'delete') && user.id !== this.currentUser?.id ? `
                                <button onclick="userManager.confirmDeleteUser('${user.id}', '${this.escapeHtml(user.name)}')" 
                                        class="p-1 text-red-600 hover:bg-red-50 rounded">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="mt-3 text-xs text-gray-500">
                    Criado em: ${new Date(user.created_at).toLocaleDateString('pt-BR')}
                    ${user.last_login ? `• Último login: ${new Date(user.last_login).toLocaleDateString('pt-BR')}` : ''}
                </div>
            </div>
        `).join('');

        container.innerHTML = usersHTML;
    }

    // Atualizar estatísticas de usuários
    updateUserStats() {
        const stats = {
            total: this.users.length,
            administradores: this.users.filter(u => u.role === 'administrador').length,
            gerentes: this.users.filter(u => u.role === 'gerente').length,
            vendedores: this.users.filter(u => u.role === 'vendedor').length,
            ativos: this.users.filter(u => u.status === 'ativo').length
        };

        // Atualizar cards de estatísticas
        this.updateStatCard('totalUsers', stats.total);
        this.updateStatCard('activeUsers', stats.ativos);
        this.updateStatCard('adminUsers', stats.administradores);
        this.updateStatCard('managerUsers', stats.gerentes);
    }

    updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    // Utilitários para exibição
    getRoleBadgeClass(role) {
        const classes = {
            administrador: 'bg-red-100 text-red-800',
            gerente: 'bg-yellow-100 text-yellow-800',
            vendedor: 'bg-green-100 text-green-800'
        };
        return classes[role] || 'bg-gray-100 text-gray-800';
    }

    getRoleDisplayName(role) {
        const names = {
            administrador: 'Administrador',
            gerente: 'Gerente',
            vendedor: 'Vendedor'
        };
        return names[role] || role;
    }

    getStatusBadgeClass(status) {
        const classes = {
            ativo: 'bg-green-100 text-green-800',
            inativo: 'bg-gray-100 text-gray-800',
            suspenso: 'bg-red-100 text-red-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    }

    getStatusDisplayName(status) {
        const names = {
            ativo: 'Ativo',
            inativo: 'Inativo',
            suspenso: 'Suspenso'
        };
        return names[status] || status;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Eventos da interface
    setupEventListeners() {
        // Botão de adicionar usuário
        const addUserBtn = document.getElementById('cfgNewUserCreateBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.openUserModal());
        }

        // Botões de fechar modal de usuário
        const userModalCancel = document.getElementById('userModalCancel');
        if (userModalCancel) {
            userModalCancel.addEventListener('click', () => this.closeUserModal());
        }

        const userModalCloseX = document.getElementById('userModalCloseX');
        if (userModalCloseX) {
            userModalCloseX.addEventListener('click', () => this.closeUserModal());
        }

        // Formulário de usuário
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', (e) => this.handleUserFormSubmit(e));
        }

        // Filtros e busca
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterUsers(e.target.value));
        }

        const roleFilter = document.getElementById('roleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', (e) => this.filterUsersByRole(e.target.value));
        }

        // Event listener para ESC key no modal de usuário
        this.handleEscapeKeyUser = (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('cfgUserModal');
                if (modal && modal.classList.contains('active')) {
                    this.closeUserModal();
                }
            }
        };
    }

    // Abrir modal de usuário
    openUserModal(userId = null) {
        this.currentEditingUserId = userId;
        const modal = document.getElementById('cfgUserModal');
        const form = document.getElementById('userForm');
        
        if (userId) {
            // Modo edição
            const user = this.users.find(u => u.id === userId);
            if (user) {
                this.populateUserForm(user);
            }
            document.getElementById('userModalTitle').textContent = 'Editar Usuário';
            document.getElementById('userModalAdd').textContent = 'Salvar Alterações';
            const passwordField = document.getElementById('userPassword');
            if (passwordField) {
                passwordField.placeholder = 'Deixe em branco para manter atual';
                passwordField.required = false;
            }
            
            // Carregar permissões personalizadas se existirem
            if (user.custom_permissions) {
                this.loadCustomPermissions(user.custom_permissions);
            }
        } else {
            // Modo criação
            form.reset();
            document.getElementById('userModalTitle').textContent = 'Novo Usuário';
            document.getElementById('userModalAdd').textContent = 'Criar Usuário';
            const passwordField = document.getElementById('userPassword');
            if (passwordField) {
                passwordField.required = true;
            }
        }

        // Usar o mesmo método que o settings.js
        if (modal) {
            modal.classList.add('active');
        }
        
        // Adicionar event listener para ESC key
        document.addEventListener('keydown', this.handleEscapeKeyUser);
    }

    // Alternar seção de permissões personalizadas (REMOVIDO - agora é modal separado)
    
    // Abrir modal de permissões personalizadas
    openCustomPermissionsModal() {
        const modal = document.getElementById('customPermissionsModal');
        const title = document.getElementById('customPermissionsTitle');
        
        // Aplicar permissões padrão baseadas no role selecionado
        const role = document.getElementById('userRole').value;
        if (role) {
            title.textContent = `Permissões Personalizadas - ${this.getRoleDisplayName(role)}`;
            this.applyRolePermissions(role);
        } else {
            title.textContent = 'Permissões Personalizadas';
        }
        
        modal.classList.add('active');
        
        // SOLUÇÃO ROBUSTA: Múltiplas estratégias para forçar o modal na frente
        
        // 1. Forçar z-index extremamente alto
        modal.style.zIndex = '2147483647'; // Valor máximo do z-index
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        
        // 2. Remover o modal do DOM e reinseri-lo no final do body para garantir que fique por cima
        const parent = modal.parentNode;
        const nextSibling = modal.nextSibling;
        document.body.appendChild(modal);
        
        // 3. Aplicar com delay para garantir que seja executado após outros scripts
        setTimeout(() => {
            modal.style.zIndex = '2147483647';
            modal.style.display = 'flex';
        }, 10);
        
        // 4. Armazenar referências para restaurar depois
        this.modalOriginalParent = parent;
        this.modalOriginalNextSibling = nextSibling;
        
        // Adicionar evento para fechar ao clicar no fundo do modal
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeCustomPermissionsModal();
            }
        };
        
        // Definir e armazenar a função de escape para poder removê-la depois
        this.handleEscapeKeyCustom = (e) => {
            if (e.key === 'Escape') {
                this.closeCustomPermissionsModal();
            }
        };
        document.addEventListener('keydown', this.handleEscapeKeyCustom);
    }
    
    // Fechar modal de permissões personalizadas
    closeCustomPermissionsModal() {
        const modal = document.getElementById('customPermissionsModal');
        modal.classList.remove('active');
        
        // Restaurar posição original do modal no DOM
        if (this.modalOriginalParent && this.modalOriginalNextSibling) {
            this.modalOriginalParent.insertBefore(modal, this.modalOriginalNextSibling);
        } else if (this.modalOriginalParent) {
            this.modalOriginalParent.appendChild(modal);
        }
        
        // Limpar estilos forçados
        modal.style.zIndex = '';
        modal.style.position = '';
        modal.style.top = '';
        modal.style.left = '';
        modal.style.width = '';
        modal.style.height = '';
        modal.style.display = '';
        
        // Remover eventos do modal
        modal.onclick = null;
        
        // Remover eventos de teclado (se houver)
        document.removeEventListener('keydown', this.handleEscapeKeyCustom);
        
        // Limpar referências
        this.modalOriginalParent = null;
        this.modalOriginalNextSibling = null;
    }
    
    // Salvar permissões personalizadas
    saveCustomPermissions() {
        const permissions = this.collectCustomPermissions();
        
        // Aqui você pode implementar a lógica para salvar as permissões
        // Por exemplo, armazenar em uma variável temporária ou enviar para o servidor
        this.tempCustomPermissions = permissions;
        
        alert('Permissões personalizadas salvas com sucesso!');
        this.closeCustomPermissionsModal();
    }

    // Mostrar permissões personalizadas (REMOVIDO - agora é modal separado)
    
    // Esconder permissões personalizadas (REMOVIDO - agora é modal separado)

    // Aplicar permissões padrão baseadas no role
    applyRolePermissions(role) {
        const permissions = this.permissions[role];
        if (!permissions) return;
        
        // Limpar todas as permissões primeiro (buscar em ambos os modais)
        const checkboxesRole = document.querySelectorAll('#rolePermissionsModal input[type="checkbox"]');
        const checkboxesCustom = document.querySelectorAll('#customPermissionsModal input[type="checkbox"]');
        
        checkboxesRole.forEach(cb => cb.checked = false);
        checkboxesCustom.forEach(cb => cb.checked = false);
        
        // Aplicar permissões do role no modal de role
        Object.keys(permissions).forEach(module => {
            Object.keys(permissions[module]).forEach(action => {
                const checkbox = document.querySelector(`#rolePermissionsModal input[data-action="${action}"]`);
                if (checkbox && checkbox.closest('[data-module="' + module + '"]')) {
                    checkbox.checked = permissions[module][action];
                }
            });
        });
        
        // Aplicar permissões do role no modal de permissões personalizadas
        Object.keys(permissions).forEach(module => {
            Object.keys(permissions[module]).forEach(action => {
                const permName = `perm_${module}_${action}`;
                const checkbox = document.querySelector(`#customPermissionsModal input[name="${permName}"]`);
                if (checkbox) {
                    checkbox.checked = permissions[module][action];
                }
            });
        });
    }

    // Resetar permissões para padrão do perfil
    resetPermissionsToRole() {
        const role = document.getElementById('userRole').value;
        if (role) {
            this.applyRolePermissions(role);
        }
    }

    // Carregar permissões personalizadas no modal
    loadCustomPermissions(customPermissions) {
        if (!customPermissions) return;
        
        Object.keys(customPermissions).forEach(module => {
            Object.keys(customPermissions[module]).forEach(action => {
                const permName = `perm_${module}_${action}`;
                const checkbox = document.querySelector(`#customPermissionsModal input[name="${permName}"]`);
                if (checkbox) {
                    checkbox.checked = customPermissions[module][action];
                }
            });
        });
    }

    // Coletar permissões personalizadas do modal
    collectCustomPermissions() {
        const permissions = {};
        const checkboxes = document.querySelectorAll('#customPermissionsModal input[type="checkbox"]');
        
        checkboxes.forEach(cb => {
            const [module, action] = cb.name.split('_');
            if (!permissions[module]) {
                permissions[module] = {};
            }
            permissions[module][action] = cb.checked;
        });
        
        return permissions;
    }

    // Abrir modal de permissões por role
  openRolePermissionsModal(role) {
    const modal = document.getElementById('rolePermissionsModal');
    const title = document.getElementById('rolePermissionsTitle');
    
    title.textContent = `Permissões do Perfil: ${this.getRoleDisplayName(role)}`;
    this.currentEditingRole = role;
    
    // Carregar permissões atuais do role
    this.loadRolePermissions(role);
    
    modal.style.display = 'flex';
    
    // Adicionar evento para fechar ao clicar no fundo do modal
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeRolePermissionsModal();
      }
    };
    
    // Definir e armazenar a função de escape para poder removê-la depois
    this.handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        this.closeRolePermissionsModal();
      }
    };
    document.addEventListener('keydown', this.handleEscapeKey);
  }

  // Fechar modal de permissões por role
  closeRolePermissionsModal() {
    const modal = document.getElementById('rolePermissionsModal');
    modal.style.display = 'none';
    this.currentEditingRole = null;
    
    // Remover eventos do modal
    modal.onclick = null;
    
    // Remover eventos de teclado (se houver)
    document.removeEventListener('keydown', this.handleEscapeKey);
  }

  // Carregar permissões do role no modal
  loadRolePermissions(role) {
    const permissions = this.permissions[role];
    if (!permissions) return;

    // Limpar todas as permissões primeiro
    const checkboxes = document.querySelectorAll('#rolePermissionsModal input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);

    // Aplicar permissões do role
    Object.keys(permissions).forEach(module => {
      Object.keys(permissions[module]).forEach(action => {
        const checkbox = document.querySelector(
          `#rolePermissionsModal [data-module="${module}"] input[data-action="${action}"]`
        );
        if (checkbox) {
          checkbox.checked = permissions[module][action];
        }
      });
    });
  }

  // Salvar permissões do role
  async saveRolePermissions() {
    if (!this.currentEditingRole) return;

    try {
      const permissions = {};
      const modules = document.querySelectorAll('#rolePermissionsModal .permission-module');
      
      modules.forEach(moduleEl => {
        const moduleName = moduleEl.dataset.module;
        permissions[moduleName] = {};
        
        const checkboxes = moduleEl.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
          const action = cb.dataset.action;
          permissions[moduleName][action] = cb.checked;
        });
      });

      // Atualizar permissões localmente
      this.permissions[this.currentEditingRole] = permissions;

      // Salvar no localStorage (ou enviar para servidor)
      localStorage.setItem('userPermissions', JSON.stringify(this.permissions));

      alert('Permissões atualizadas com sucesso!');
      this.closeRolePermissionsModal();
      
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      alert('Erro ao salvar permissões: ' + error.message);
    }
  }

  // Obter nome de exibição do role
  getRoleDisplayName(role) {
    const roleNames = {
      'administrador': 'Administrador',
      'gerente': 'Gerente',
      'vendedor': 'Vendedor'
    };
    return roleNames[role] || role;
  }

    // Manipular envio do formulário
    async handleUserFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role'),
            status: formData.get('status') || 'ativo'
        };

        // Coletar permissões personalizadas se a seção estiver visível
        const customPermissionsSection = document.getElementById('customPermissionsSection');
        if (customPermissionsSection && customPermissionsSection.style.display !== 'none') {
            userData.custom_permissions = this.collectCustomPermissions();
        } else {
            // Usar permissões padrão do role
            userData.custom_permissions = null;
        }

        // Validações
        if (!userData.name || !userData.email || !userData.role) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        if (!this.currentEditingUserId && !userData.password) {
            alert('A senha é obrigatória para novos usuários.');
            return;
        }

        const submitBtn = document.getElementById('userModalAdd');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Salvando...';
        submitBtn.disabled = true;

        try {
            let result;
            if (this.currentEditingUserId) {
                result = await this.updateUser(this.currentEditingUserId, userData);
            } else {
                result = await this.createUser(userData);
            }

            if (result.success) {
                this.closeUserModal();
                alert(this.currentEditingUserId ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
            } else {
                alert('Erro: ' + result.error);
            }
        } catch (error) {
            alert('Erro inesperado: ' + error.message);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    // Função para salvar usuário (chamada pelo botão do modal)
    async saveUser() {
        return this.handleUserFormSubmit({ target: document.getElementById('userForm'), preventDefault: () => {} });
    }

    closeUserModal() {
        const modal = document.getElementById('cfgUserModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.currentEditingUserId = null;
        
        // Remover event listener para ESC key
        document.removeEventListener('keydown', this.handleEscapeKeyUser);
    }

    // Editar usuário
    editUser(userId) {
        this.openUserModal(userId);
    }

    // Confirmar exclusão de usuário
    confirmDeleteUser(userId, userName) {
        if (confirm(`Tem certeza que deseja excluir o usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
            this.deleteUser(userId).then(result => {
                if (result.success) {
                    alert('Usuário excluído com sucesso!');
                } else {
                    alert('Erro ao excluir usuário: ' + result.error);
                }
            });
        }
    }

    // Filtrar usuários por texto
    filterUsers(searchText) {
        const filteredUsers = this.users.filter(user => 
            user.name.toLowerCase().includes(searchText.toLowerCase()) ||
            user.email.toLowerCase().includes(searchText.toLowerCase())
        );
        this.renderFilteredUsers(filteredUsers);
    }

    // Filtrar usuários por role
    filterUsersByRole(role) {
        const filteredUsers = role === 'all' ? this.users : this.users.filter(user => user.role === role);
        this.renderFilteredUsers(filteredUsers);
    }

    // Renderizar usuários filtrados
    renderFilteredUsers(users) {
        const originalUsers = this.users;
        this.users = users;
        this.renderUsersList();
        this.users = originalUsers;
    }
}

// Inicializar sistema quando o script carregar
document.addEventListener('DOMContentLoaded', function() {
    // Aguardar um pouco para garantir que todos os elementos estejam carregados
    setTimeout(() => {
        if (typeof UserManager !== 'undefined') {
            window.userManager = new UserManager();
            
            // Conectar eventos dos botões de permissões por role
            const adminPermBtn = document.querySelector('[onclick*="administrador"]');
            const managerPermBtn = document.querySelector('[onclick*="gerente"]');
            const sellerPermBtn = document.querySelector('[onclick*="vendedor"]');
            
            if (adminPermBtn) {
                adminPermBtn.onclick = () => window.userManager.openRolePermissionsModal('administrador');
            }
            if (managerPermBtn) {
                managerPermBtn.onclick = () => window.userManager.openRolePermissionsModal('gerente');
            }
            if (sellerPermBtn) {
                sellerPermBtn.onclick = () => window.userManager.openRolePermissionsModal('vendedor');
            }
            
            // Conectar botão de novo usuário
            const newUserBtn = document.getElementById('newUserBtn');
            if (newUserBtn) {
                newUserBtn.onclick = () => window.userManager.openUserModal();
            }
            
            console.log('Sistema de usuários inicializado e conectado');
        }
    }, 500);
});