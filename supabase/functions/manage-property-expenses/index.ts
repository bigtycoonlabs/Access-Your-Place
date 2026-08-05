const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const EXPENSE_CATEGORIES = [
  { id: 'cleaning', label: 'Cleaning', icon: 'sparkles' },
  { id: 'maintenance', label: 'Maintenance & Repairs', icon: 'wrench' },
  { id: 'supplies', label: 'Supplies & Consumables', icon: 'package' },
  { id: 'utilities', label: 'Utilities', icon: 'zap' },
  { id: 'insurance', label: 'Insurance', icon: 'shield' },
  { id: 'mortgage', label: 'Mortgage/Rent', icon: 'home' },
  { id: 'property_tax', label: 'Property Tax', icon: 'receipt' },
  { id: 'hoa', label: 'HOA Fees', icon: 'building' },
  { id: 'landscaping', label: 'Landscaping', icon: 'trees' },
  { id: 'pest_control', label: 'Pest Control', icon: 'bug' },
  { id: 'marketing', label: 'Marketing & Advertising', icon: 'megaphone' },
  { id: 'software', label: 'Software & Subscriptions', icon: 'laptop' },
  { id: 'professional', label: 'Professional Services', icon: 'briefcase' },
  { id: 'furnishing', label: 'Furnishing & Decor', icon: 'sofa' },
  { id: 'appliances', label: 'Appliances', icon: 'refrigerator' },
  { id: 'linens', label: 'Linens & Towels', icon: 'bed' },
  { id: 'platform_fees', label: 'Platform Fees', icon: 'credit-card' },
  { id: 'other', label: 'Other', icon: 'more-horizontal' }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action, investor_id, property_id, expense_id, expense_data, filters } = body;

    // Get expense categories
    if (action === 'get_categories') {
      return new Response(JSON.stringify({ 
        success: true, 
        categories: EXPENSE_CATEGORIES 
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Get expenses for a property or all properties
    if (action === 'get_expenses') {
      let query = supabase
        .from('property_expenses')
        .select(`
          *,
          investor_portfolio!inner(id, address, city, state)
        `)
        .eq('investor_id', investor_id)
        .order('expense_date', { ascending: false });

      if (property_id) {
        query = query.eq('portfolio_property_id', property_id);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.start_date) {
        query = query.gte('expense_date', filters.start_date);
      }

      if (filters?.end_date) {
        query = query.lte('expense_date', filters.end_date);
      }

      if (filters?.min_amount) {
        query = query.gte('amount', filters.min_amount);
      }

      if (filters?.max_amount) {
        query = query.lte('amount', filters.max_amount);
      }

      const { data: expenses, error } = await query;

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        expenses: expenses || [] 
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Add new expense
    if (action === 'add_expense') {
      const { data: expense, error } = await supabase
        .from('property_expenses')
        .insert({
          portfolio_property_id: property_id,
          investor_id,
          category: expense_data.category,
          description: expense_data.description,
          amount: expense_data.amount,
          expense_date: expense_data.expense_date || new Date().toISOString().split('T')[0],
          receipt_url: expense_data.receipt_url,
          vendor: expense_data.vendor,
          is_recurring: expense_data.is_recurring || false,
          recurring_frequency: expense_data.recurring_frequency,
          notes: expense_data.notes
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        expense,
        message: 'Expense added successfully'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Update expense
    if (action === 'update_expense') {
      const { data: expense, error } = await supabase
        .from('property_expenses')
        .update({
          category: expense_data.category,
          description: expense_data.description,
          amount: expense_data.amount,
          expense_date: expense_data.expense_date,
          receipt_url: expense_data.receipt_url,
          vendor: expense_data.vendor,
          is_recurring: expense_data.is_recurring,
          recurring_frequency: expense_data.recurring_frequency,
          notes: expense_data.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', expense_id)
        .eq('investor_id', investor_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        expense,
        message: 'Expense updated successfully'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Delete expense
    if (action === 'delete_expense') {
      const { error } = await supabase
        .from('property_expenses')
        .delete()
        .eq('id', expense_id)
        .eq('investor_id', investor_id);

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Expense deleted successfully'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Get expense summary/report
    if (action === 'get_expense_report') {
      const { period = 'monthly', year, month } = filters || {};
      
      // Get all expenses for the investor
      let query = supabase
        .from('property_expenses')
        .select(`
          *,
          investor_portfolio!inner(id, address, city, state, monthly_earnings, monthly_rent)
        `)
        .eq('investor_id', investor_id);

      if (property_id) {
        query = query.eq('portfolio_property_id', property_id);
      }

      // Apply date filters based on period
      const now = new Date();
      const currentYear = year || now.getFullYear();
      const currentMonth = month || now.getMonth() + 1;

      if (period === 'monthly') {
        const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
        query = query.gte('expense_date', startDate).lte('expense_date', endDate);
      } else if (period === 'yearly') {
        query = query.gte('expense_date', `${currentYear}-01-01`).lte('expense_date', `${currentYear}-12-31`);
      }

      const { data: expenses, error } = await query;

      if (error) throw error;

      // Calculate summaries
      const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
      
      // Group by category
      const byCategory: Record<string, number> = {};
      expenses?.forEach(e => {
        byCategory[e.category] = (byCategory[e.category] || 0) + parseFloat(e.amount);
      });

      // Group by property
      const byProperty: Record<string, { expenses: number; revenue: number; rent: number; profit: number; address: string }> = {};
      expenses?.forEach(e => {
        const propId = e.portfolio_property_id;
        if (!byProperty[propId]) {
          byProperty[propId] = {
            expenses: 0,
            revenue: e.investor_portfolio?.monthly_earnings || 0,
            rent: e.investor_portfolio?.monthly_rent || 0,
            profit: 0,
            address: `${e.investor_portfolio?.address}, ${e.investor_portfolio?.city}, ${e.investor_portfolio?.state}`
          };
        }
        byProperty[propId].expenses += parseFloat(e.amount);
      });

      // Calculate profit for each property
      Object.keys(byProperty).forEach(propId => {
        const prop = byProperty[propId];
        // Monthly profit = Revenue - Rent - Expenses
        prop.profit = prop.revenue - prop.rent - (period === 'monthly' ? prop.expenses : prop.expenses / 12);
      });

      // Get portfolio properties for revenue data
      const { data: portfolio } = await supabase
        .from('investor_portfolio')
        .select('id, address, city, state, monthly_earnings, monthly_rent')
        .eq('investor_id', investor_id)
        .eq('property_status', 'active');

      // Calculate total revenue and profit
      let totalRevenue = 0;
      let totalRent = 0;
      portfolio?.forEach(p => {
        totalRevenue += p.monthly_earnings || 0;
        totalRent += p.monthly_rent || 0;
        
        // Add properties without expenses to byProperty
        if (!byProperty[p.id]) {
          byProperty[p.id] = {
            expenses: 0,
            revenue: p.monthly_earnings || 0,
            rent: p.monthly_rent || 0,
            profit: (p.monthly_earnings || 0) - (p.monthly_rent || 0),
            address: `${p.address}, ${p.city}, ${p.state}`
          };
        }
      });

      // Adjust for period
      if (period === 'yearly') {
        totalRevenue *= 12;
        totalRent *= 12;
      }

      const totalProfit = totalRevenue - totalRent - totalExpenses;

      // Monthly breakdown for yearly view
      let monthlyBreakdown: any[] = [];
      if (period === 'yearly' && expenses) {
        const monthlyData: Record<number, number> = {};
        for (let m = 1; m <= 12; m++) {
          monthlyData[m] = 0;
        }
        expenses.forEach(e => {
          const expMonth = new Date(e.expense_date).getMonth() + 1;
          monthlyData[expMonth] += parseFloat(e.amount);
        });
        monthlyBreakdown = Object.entries(monthlyData).map(([month, amount]) => ({
          month: parseInt(month),
          monthName: new Date(2024, parseInt(month) - 1).toLocaleString('default', { month: 'short' }),
          expenses: amount,
          revenue: (totalRevenue / 12),
          rent: (totalRent / 12),
          profit: (totalRevenue / 12) - (totalRent / 12) - amount
        }));
      }

      const report = {
        period,
        year: currentYear,
        month: period === 'monthly' ? currentMonth : null,
        total_expenses: totalExpenses,
        total_revenue: totalRevenue,
        total_rent: totalRent,
        total_profit: totalProfit,
        profit_margin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0,
        by_category: Object.entries(byCategory)
          .map(([category, amount]) => ({
            category,
            label: EXPENSE_CATEGORIES.find(c => c.id === category)?.label || category,
            amount,
            percentage: totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0
          }))
          .sort((a, b) => b.amount - a.amount),
        by_property: Object.entries(byProperty).map(([id, data]) => ({
          property_id: id,
          ...data
        })),
        monthly_breakdown: monthlyBreakdown,
        expense_count: expenses?.length || 0
      };

      return new Response(JSON.stringify({ 
        success: true, 
        report 
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Upload receipt
    if (action === 'upload_receipt') {
      // This would typically handle file upload, but we'll return the expected structure
      // The actual file upload happens on the client side to Supabase Storage
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Use Supabase Storage client to upload receipts to property-photos bucket'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid action' 
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error: any) {
    console.error('Expense management error:', error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
