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
        
        // Buscar despesas pagas do mês
        const { data: expensesData, error: expensesError } = await supabase
            .from('expenses')
            .select('amount, expense_date')
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .eq('status', 'paid');
            
        if (expensesError) throw expensesError;
        
        // Buscar pagamentos de contas a pagar realizados no mês
        const { data: paymentsData, error: paymentsError } = await supabase
            .from('payable_payments')
            .select('payment_value, payment_date')
            .gte('payment_date', startDate)
            .lte('payment_date', endDate);

        if (paymentsError) {
            console.warn('Erro ao buscar pagamentos de contas a pagar:', paymentsError);
            // Continuar apenas com despesas se pagamentos falharem
        }

        // Calcular total das despesas (tabela expenses)
        const totalExpenses = expensesData.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

        // Calcular total pago em contas a pagar no mês (tabela payable_payments)
        const totalPayables = paymentsData ? paymentsData.reduce((sum, pay) => sum + parseFloat(pay.payment_value || 0), 0) : 0;
        
        const grandTotal = totalExpenses + totalPayables;
        const totalCount = expensesData.length + (paymentsData ? paymentsData.length : 0);
        
        return {
            value: grandTotal,
            count: totalCount,
            expenses: totalExpenses,
            payables: totalPayables,
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
 * Atualiza todos os cards do dashboard
 */
async function updateDashboardCards() {
    try {
        // Mostrar loading nos cards
        const cards = [
            { id: 'vendas-ano', text: 'Carregando...' },
            { id: 'vendas-mes', text: 'Carregando...' },
            { id: 'margem-bruta', text: 'Carregando...' },
            { id: 'despesas-mes', text: 'Carregando...' }
        ];
        
        cards.forEach(card => {
            const element = document.querySelector(`[data-card="${card.id}"] .value`);
            if (element) element.textContent = card.text;
        });
        
        // Buscar dados em paralelo
        const [yearSales, monthSales, grossMargin, monthExpenses] = await Promise.all([
            getYearSales(),
            getMonthSales(),
            getMonthGrossMargin(),
            getMonthExpenses()
        ]);
        
        // Atualizar cards com dados reais
        updateCard('vendas-ano', yearSales.formatted);
        updateCard('vendas-mes', monthSales.formatted);
        updateCard('margem-bruta', `${grossMargin.formatted} (${grossMargin.percentageFormatted})`);
        updateCard('despesas-mes', monthExpenses.formatted);
        
        console.log('Dashboard atualizado com sucesso:', {
            yearSales: yearSales.formatted,
            monthSales: monthSales.formatted,
            grossMargin: grossMargin.formatted,
            monthExpenses: monthExpenses.formatted
        });
        
    } catch (error) {
        console.error('Erro ao atualizar dashboard:', error);
        
        // Mostrar erro nos cards
        ['vendas-ano', 'vendas-mes', 'margem-bruta', 'despesas-mes'].forEach(cardId => {
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
    updateDashboardCards,
    updateCard,
    formatCurrency
};