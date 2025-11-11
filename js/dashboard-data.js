// dashboard-data.js
// Funções para buscar dados do dashboard do Supabase

/**
 * Busca vendas do ano atual
 */
async function getYearSales() {
    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Cliente Supabase não inicializado');
        }
        
        const currentYear = new Date().getFullYear();
        const startDate = `${currentYear}-01-01`;
        const endDate = `${currentYear}-12-31`;
        
        const { data, error } = await supabase
            .from('sales')
            .select('total, created_at')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .eq('status', 'completed');
            
        if (error) throw error;
        
        const totalSales = data.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
        return {
            value: totalSales,
            count: data.length,
            formatted: formatCurrency(totalSales)
        };
    } catch (error) {
        console.error('Erro ao buscar vendas do ano:', error);
        return { value: 0, count: 0, formatted: 'R$ 0,00' };
    }
}

/**
 * Busca vendas do mês atual
 */
async function getMonthSales() {
    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Cliente Supabase não inicializado');
        }
        
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('sales')
            .select('total, created_at')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .eq('status', 'completed');
            
        if (error) throw error;
        
        const totalSales = data.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
        return {
            value: totalSales,
            count: data.length,
            formatted: formatCurrency(totalSales)
        };
    } catch (error) {
        console.error('Erro ao buscar vendas do mês:', error);
        return { value: 0, count: 0, formatted: 'R$ 0,00' };
    }
}

/**
 * Calcula margem bruta do mês atual
 */
async function getMonthGrossMargin() {
    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Cliente Supabase não inicializado');
        }
        
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        // Buscar vendas do mês com itens
        const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select(`
                total,
                sale_items (
                    quantity,
                    unit_price,
                    product_id
                )
            `)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .eq('status', 'completed');
            
        if (salesError) throw salesError;
        
        let totalRevenue = 0;
        let totalCost = 0;
        
        for (const sale of salesData) {
            totalRevenue += parseFloat(sale.total || 0);
            
            // Calcular custo dos produtos vendidos
            for (const item of sale.sale_items) {
                if (item.product_id) {
                    // Buscar custo do produto
                    const { data: productData, error: productError } = await supabase
                        .from('products')
                        .select('cost_price')
                        .eq('id', item.product_id)
                        .single();
                        
                    if (!productError && productData) {
                        const itemCost = parseFloat(productData.cost_price || 0) * parseFloat(item.quantity || 0);
                        totalCost += itemCost;
                    }
                }
            }
        }
        
        const grossMargin = totalRevenue - totalCost;
        const marginPercentage = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
        
        return {
            value: grossMargin,
            percentage: marginPercentage,
            formatted: formatCurrency(grossMargin),
            percentageFormatted: `${marginPercentage.toFixed(1)}%`
        };
    } catch (error) {
        console.error('Erro ao calcular margem bruta:', error);
        return { value: 0, percentage: 0, formatted: 'R$ 0,00', percentageFormatted: '0.0%' };
    }
}

/**
 * Busca despesas do mês atual
 */
async function getMonthExpenses() {
    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Cliente Supabase não inicializado');
        }
        
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        // Buscar todas as despesas registradas no mês (não filtra por status)
        const { data: expensesData, error: expensesError } = await supabase
            .from('expenses')
            .select('amount, expense_date')
            .gte('expense_date', startDate)
            .lte('expense_date', endDate);
            
        if (expensesError) throw expensesError;
        
        // Buscar contas a pagar que entraram no mês (pela data de emissão)
        const { data: apEnteredData, error: apEnteredError } = await supabase
            .from('accounts_payable')
            .select('original_value, issue_date')
            .gte('issue_date', startDate)
            .lte('issue_date', endDate);

        if (apEnteredError) {
            console.warn('Erro ao buscar contas a pagar do mês:', apEnteredError);
        }

        // Calcular total das despesas (tabela expenses)
        const totalExpenses = expensesData.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

        // Calcular total de contas a pagar que entraram no mês (tabela accounts_payable)
        const totalPayablesEntered = (apEnteredData || []).reduce((sum, ap) => sum + parseFloat(ap.original_value || 0), 0);
        
        const grandTotal = totalExpenses + totalPayablesEntered;
        const totalCount = expensesData.length + ((apEnteredData || []).length);
        
        return {
            value: grandTotal,
            count: totalCount,
            expenses: totalExpenses,
            payables: totalPayablesEntered,
            formatted: formatCurrency(grandTotal)
        };
    } catch (error) {
        console.error('Erro ao buscar despesas do mês:', error);
        return { value: 0, count: 0, expenses: 0, payables: 0, formatted: 'R$ 0,00' };
    }
}

/**
 * Formata valor para moeda brasileira
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

/**
 * Alerta de próximos vencimentos (<=7 dias) para Contas a Pagar
 */
async function getPayablesDueAlert() {
    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Cliente Supabase não inicializado');
        }

        const { data, error } = await supabase
            .from('accounts_payable')
            .select('due_date, status, original_value, paid_value')
            .neq('status', 'paid')
            .order('due_date', { ascending: true });

        if (error) throw error;

        const now = new Date();
        const items = (data || []).filter(a => {
            const remaining = Math.max(0, parseFloat(a.original_value || 0) - parseFloat(a.paid_value || 0));
            return remaining > 0 && a.due_date;
        }).map(a => ({
            ...a,
            daysUntil: Math.ceil((new Date(a.due_date) - now) / 86400000)
        }));

        if (!items.length) {
            return { show: false, badgeClass: 'badge-success', icon: 'fa-solid fa-check-circle', text: 'OK', title: 'Sem vencimentos nos próximos 7 dias' };
        }

        const overdueCount = items.filter(i => i.daysUntil < 0).length;
        const dueSoon = items.filter(i => i.daysUntil >= 0 && i.daysUntil <= 7);
        const minDays = items.reduce((min, i) => Math.min(min, i.daysUntil), Infinity);

        if (overdueCount > 0) {
            return {
                show: true,
                badgeClass: 'badge-danger',
                icon: 'fa-solid fa-exclamation-triangle',
                text: `${overdueCount} vencida${overdueCount > 1 ? 's' : ''}`,
                title: 'Há contas vencidas'
            };
        }

        if (dueSoon.length > 0) {
            const isHigh = minDays <= 3;
            return {
                show: true,
                badgeClass: isHigh ? 'badge-danger' : 'badge-warning',
                icon: isHigh ? 'fa-solid fa-exclamation-triangle' : 'fa-solid fa-calendar-week',
                text: minDays === 0 ? 'vence hoje' : `vence em ${minDays} dia${minDays > 1 ? 's' : ''}`,
                title: 'Próximo vencimento em até 7 dias'
            };
        }

        // Sem itens nos próximos 7 dias
        return { show: false, badgeClass: 'badge-success', icon: 'fa-solid fa-check-circle', text: 'OK', title: 'Sem vencimentos nos próximos 7 dias' };
    } catch (error) {
        console.warn('Erro ao buscar alerta de vencimentos:', error);
        return { show: false, badgeClass: 'badge-warning', icon: 'fa-solid fa-info-circle', text: '—', title: 'Falha ao verificar vencimentos' };
    }
}

/**
 * Busca total a pagar (saldo restante) de todas as contas criadas
 */
async function getTotalPayables() {
    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Cliente Supabase não inicializado');
        }

        const { data, error } = await supabase
            .from('accounts_payable')
            .select('original_value, paid_value');

        if (error) throw error;

        const totalRemaining = (data || []).reduce((sum, acc) => {
            const original = parseFloat(acc.original_value || 0);
            const paid = parseFloat(acc.paid_value || 0);
            return sum + Math.max(0, original - paid);
        }, 0);

        return {
            value: totalRemaining,
            count: (data || []).length,
            formatted: formatCurrency(totalRemaining)
        };
    } catch (error) {
        console.error('Erro ao buscar total a pagar:', error);
        return { value: 0, count: 0, formatted: 'R$ 0,00' };
    }
}

/**
 * Atualiza todos os cards do dashboard
 */
async function updateDashboardCards() {
    try {
        // Mostrar loading nos cards
        const cards = [
            { id: 'vendas-ano', text: 'Carregando...' },
            { id: 'vendas-mes', text: 'Carregando...' },
            { id: 'margem-bruta', text: 'Carregando...' },
            { id: 'despesas-mes', text: 'Carregando...' },
            { id: 'total-a-pagar', text: 'Carregando...' }
        ];
        
        cards.forEach(card => {
            const element = document.querySelector(`[data-card="${card.id}"] .value`);
            if (element) element.textContent = card.text;
        });
        
        // Buscar dados em paralelo
        const [yearSales, monthSales, grossMargin, monthExpenses, totalPayables, payablesAlert] = await Promise.all([
            getYearSales(),
            getMonthSales(),
            getMonthGrossMargin(),
            getMonthExpenses(),
            getTotalPayables(),
            getPayablesDueAlert()
        ]);
        
        // Atualizar cards com dados reais
        updateCard('vendas-ano', yearSales.formatted);
        updateCard('vendas-mes', monthSales.formatted);
        updateCard('margem-bruta', `${grossMargin.formatted} (${grossMargin.percentageFormatted})`);
        updateCard('despesas-mes', monthExpenses.formatted);
        updateCard('total-a-pagar', totalPayables.formatted);

        // Renderizar alerta de vencimento no card Total a Pagar
        const alertEl = document.querySelector('[data-card="total-a-pagar"] .right .trend');
        if (alertEl) {
            if (payablesAlert && payablesAlert.show) {
                alertEl.innerHTML = `<span class="badge ${payablesAlert.badgeClass}" title="${payablesAlert.title}"><i class="${payablesAlert.icon}"></i> ${payablesAlert.text}</span>`;
            } else {
                // Sem alerta nos próximos 7 dias – opcionalmente exibir OK
                alertEl.innerHTML = `<span class="badge badge-success" title="Sem vencimentos nos próximos 7 dias"><i class="fa-solid fa-check-circle"></i> OK</span>`;
            }
        }
        
        console.log('Dashboard atualizado com sucesso:', {
            yearSales: yearSales.formatted,
            monthSales: monthSales.formatted,
            grossMargin: grossMargin.formatted,
            monthExpenses: monthExpenses.formatted,
            totalPayables: totalPayables.formatted,
            payablesAlert
        });
        
    } catch (error) {
        console.error('Erro ao atualizar dashboard:', error);
        
        // Mostrar erro nos cards
        ['vendas-ano', 'vendas-mes', 'margem-bruta', 'despesas-mes', 'total-a-pagar'].forEach(cardId => {
            updateCard(cardId, 'Erro ao carregar');
        });
    }
}

/**
 * Atualiza um card específico
 */
function updateCard(cardId, value) {
    const element = document.querySelector(`[data-card="${cardId}"] .value`);
    if (element) {
        element.textContent = value;
    }
}

// Exportar funções para uso global
window.dashboardData = {
    getYearSales,
    getMonthSales,
    getMonthGrossMargin,
    getMonthExpenses,
    getTotalPayables,
    getPayablesDueAlert,
    updateDashboardCards,
    updateCard,
    formatCurrency
};