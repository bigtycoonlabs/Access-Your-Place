import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Plus, Receipt, DollarSign, TrendingUp, TrendingDown,
  Calendar, Filter, Download, Upload, Trash2, Edit2, Eye,
  PieChart, BarChart3, Sparkles, Wrench, Package, Zap,
  Shield, Home, Building, Bug, Megaphone, Laptop, Briefcase,
  Sofa, CreditCard, MoreHorizontal, X, FileText, ChevronDown
} from 'lucide-react';

interface Props {
  investorId: string;
  properties: Array<{
    id: string;
    address: string;
    city: string;
    state: string;
  }>;
}

interface Expense {
  id: string;
  portfolio_property_id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  receipt_url?: string;
  vendor?: string;
  is_recurring: boolean;
  recurring_frequency?: string;
  notes?: string;
  investor_portfolio?: {
    address: string;
    city: string;
    state: string;
  };
}

interface ExpenseCategory {
  id: string;
  label: string;
  icon: string;
}

interface ExpenseReport {
  period: string;
  year: number;
  month?: number;
  total_expenses: number;
  total_revenue: number;
  total_rent: number;
  total_profit: number;
  profit_margin: number;
  by_category: Array<{
    category: string;
    label: string;
    amount: number;
    percentage: string;
  }>;
  by_property: Array<{
    property_id: string;
    address: string;
    expenses: number;
    revenue: number;
    rent: number;
    profit: number;
  }>;
  monthly_breakdown: Array<{
    month: number;
    monthName: string;
    expenses: number;
    revenue: number;
    rent: number;
    profit: number;
  }>;
  expense_count: number;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
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

const getCategoryIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    sparkles: Sparkles,
    wrench: Wrench,
    package: Package,
    zap: Zap,
    shield: Shield,
    home: Home,
    receipt: Receipt,
    building: Building,
    bug: Bug,
    megaphone: Megaphone,
    laptop: Laptop,
    briefcase: Briefcase,
    sofa: Sofa,
    'credit-card': CreditCard,
    'more-horizontal': MoreHorizontal
  };
  const Icon = icons[iconName] || Receipt;
  return <Icon className="w-4 h-4" />;
};

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    cleaning: 'bg-blue-100 text-blue-700',
    maintenance: 'bg-orange-100 text-orange-700',
    supplies: 'bg-purple-100 text-purple-700',
    utilities: 'bg-yellow-100 text-yellow-700',
    insurance: 'bg-green-100 text-green-700',
    mortgage: 'bg-red-100 text-red-700',
    property_tax: 'bg-pink-100 text-pink-700',
    hoa: 'bg-indigo-100 text-indigo-700',
    landscaping: 'bg-emerald-100 text-emerald-700',
    pest_control: 'bg-amber-100 text-amber-700',
    marketing: 'bg-cyan-100 text-cyan-700',
    software: 'bg-violet-100 text-violet-700',
    professional: 'bg-slate-100 text-slate-700',
    furnishing: 'bg-rose-100 text-rose-700',
    platform_fees: 'bg-teal-100 text-teal-700',
    other: 'bg-gray-100 text-gray-700'
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
};

export function ExpenseTracker({ investorId, properties }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  
  // Filters
  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  
  // Form data
  const [formData, setFormData] = useState({
    property_id: '',
    category: 'cleaning',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    vendor: '',
    is_recurring: false,
    recurring_frequency: '',
    notes: ''
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchExpenses();
    fetchReport();
  }, [investorId, filterProperty, filterCategory]);

  useEffect(() => {
    fetchReport();
  }, [filterPeriod, filterYear, filterMonth, filterProperty]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (filterCategory !== 'all') filters.category = filterCategory;
      
      const { data } = await supabase.functions.invoke('manage-property-expenses', {
        body: { 
          action: 'get_expenses', 
          investor_id: investorId,
          property_id: filterProperty !== 'all' ? filterProperty : undefined,
          filters
        }
      });
      if (data?.expenses) setExpenses(data.expenses);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    }
    setLoading(false);
  };

  const fetchReport = async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-property-expenses', {
        body: { 
          action: 'get_expense_report', 
          investor_id: investorId,
          property_id: filterProperty !== 'all' ? filterProperty : undefined,
          filters: {
            period: filterPeriod,
            year: filterYear,
            month: filterMonth
          }
        }
      });
      if (data?.report) setReport(data.report);
    } catch (err) {
      console.error('Error fetching report:', err);
    }
  };

  const handleSubmit = async () => {
    if (!formData.property_id || !formData.amount) {
      toast({ title: 'Missing Information', description: 'Please select a property and enter an amount.', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      let receiptUrl = editingExpense?.receipt_url;
      
      // Upload receipt if provided
      if (receiptFile) {
        const filePath = `receipts/${investorId}/${Date.now()}-${receiptFile.name}`;
        const { error: uploadError } = await supabase.storage.from('property-photos').upload(filePath, receiptFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(filePath);
          receiptUrl = urlData.publicUrl;
        }
      }
      
      const { data } = await supabase.functions.invoke('manage-property-expenses', {
        body: {
          action: editingExpense ? 'update_expense' : 'add_expense',
          investor_id: investorId,
          property_id: formData.property_id,
          expense_id: editingExpense?.id,
          expense_data: {
            ...formData,
            amount: parseFloat(formData.amount),
            receipt_url: receiptUrl
          }
        }
      });
      
      if (data?.success) {
        toast({ title: editingExpense ? 'Expense Updated' : 'Expense Added' });
        fetchExpenses();
        fetchReport();
        handleCloseModal();
      } else {
        throw new Error(data?.error || 'Failed to save expense');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (expenseId: string) => {
    try {
      const { data } = await supabase.functions.invoke('manage-property-expenses', {
        body: { action: 'delete_expense', investor_id: investorId, expense_id: expenseId }
      });
      if (data?.success) {
        toast({ title: 'Expense Deleted' });
        fetchExpenses();
        fetchReport();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete expense', variant: 'destructive' });
    }
    setDeleteConfirm(null);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingExpense(null);
    setFormData({
      property_id: '',
      category: 'cleaning',
      description: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      vendor: '',
      is_recurring: false,
      recurring_frequency: '',
      notes: ''
    });
    setReceiptFile(null);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      property_id: expense.portfolio_property_id,
      category: expense.category,
      description: expense.description || '',
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      vendor: expense.vendor || '',
      is_recurring: expense.is_recurring,
      recurring_frequency: expense.recurring_frequency || '',
      notes: expense.notes || ''
    });
    setShowAddModal(true);
  };

  const exportToCSV = () => {
    if (!expenses.length) return;
    
    const headers = ['Date', 'Property', 'Category', 'Description', 'Vendor', 'Amount', 'Recurring'];
    const rows = expenses.map(e => [
      e.expense_date,
      e.investor_portfolio ? `${e.investor_portfolio.address}, ${e.investor_portfolio.city}` : '',
      EXPENSE_CATEGORIES.find(c => c.id === e.category)?.label || e.category,
      e.description || '',
      e.vendor || '',
      e.amount.toFixed(2),
      e.is_recurring ? 'Yes' : 'No'
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${filterYear}-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading && expenses.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Receipt className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${report.total_expenses.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${report.total_revenue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${report.total_profit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  {report.total_profit >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className={`text-2xl font-bold ${report.total_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ${Math.abs(report.total_profit).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Net Profit</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <PieChart className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{report.profit_margin}%</p>
                  <p className="text-sm text-muted-foreground">Profit Margin</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="expenses" className="flex items-center gap-1">
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            <Button onClick={() => setShowAddModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
              <Plus className="w-4 h-4 mr-2" />Add Expense
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <Select value={filterProperty} onValueChange={setFilterProperty}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.address}, {p.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filterPeriod} onValueChange={(v: 'monthly' | 'yearly') => setFilterPeriod(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          
          {filterPeriod === 'monthly' && (
            <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="expenses" className="space-y-4">
          {expenses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Expenses Yet</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  Start tracking your property expenses to see profit/loss reports.
                </p>
                <Button onClick={() => setShowAddModal(true)} className="mt-4 bg-[#d4a574] hover:bg-[#c49464]">
                  <Plus className="w-4 h-4 mr-2" />Add Your First Expense
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <Card key={expense.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getCategoryColor(expense.category)}`}>
                          {getCategoryIcon(EXPENSE_CATEGORIES.find(c => c.id === expense.category)?.icon || 'receipt')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">
                              {EXPENSE_CATEGORIES.find(c => c.id === expense.category)?.label || expense.category}
                            </h4>
                            {expense.is_recurring && (
                              <Badge variant="outline" className="text-xs">Recurring</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{expense.description || 'No description'}</p>
                          {expense.investor_portfolio && (
                            <p className="text-xs text-gray-400 mt-1">
                              {expense.investor_portfolio.address}, {expense.investor_portfolio.city}
                            </p>
                          )}
                          {expense.vendor && (
                            <p className="text-xs text-gray-400">Vendor: {expense.vendor}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600">-${expense.amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(expense.expense_date).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex gap-1">
                          {expense.receipt_url && (
                            <Button variant="ghost" size="sm" onClick={() => setReceiptPreview(expense.receipt_url!)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(expense)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteConfirm(expense.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          {report && (
            <>
              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Expenses by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {report.by_category.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No expenses recorded for this period</p>
                  ) : (
                    <div className="space-y-3">
                      {report.by_category.map((cat) => (
                        <div key={cat.category} className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getCategoryColor(cat.category)}`}>
                            {getCategoryIcon(EXPENSE_CATEGORIES.find(c => c.id === cat.category)?.icon || 'receipt')}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium">{cat.label}</span>
                              <span className="text-sm text-gray-600">${cat.amount.toLocaleString()} ({cat.percentage}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-[#d4a574] h-2 rounded-full transition-all"
                                style={{ width: `${cat.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Property Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Profit/Loss by Property
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {report.by_property.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No properties to display</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">Property</th>
                            <th className="text-right py-2 px-2">Revenue</th>
                            <th className="text-right py-2 px-2">Rent</th>
                            <th className="text-right py-2 px-2">Expenses</th>
                            <th className="text-right py-2 px-2">Profit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.by_property.map((prop) => (
                            <tr key={prop.property_id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-2">
                                <p className="font-medium text-sm">{prop.address}</p>
                              </td>
                              <td className="text-right py-3 px-2 text-green-600">
                                ${prop.revenue.toLocaleString()}
                              </td>
                              <td className="text-right py-3 px-2 text-gray-600">
                                ${prop.rent.toLocaleString()}
                              </td>
                              <td className="text-right py-3 px-2 text-red-600">
                                ${prop.expenses.toLocaleString()}
                              </td>
                              <td className={`text-right py-3 px-2 font-bold ${prop.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ${prop.profit.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-bold">
                            <td className="py-3 px-2">Total</td>
                            <td className="text-right py-3 px-2 text-green-600">${report.total_revenue.toLocaleString()}</td>
                            <td className="text-right py-3 px-2 text-gray-600">${report.total_rent.toLocaleString()}</td>
                            <td className="text-right py-3 px-2 text-red-600">${report.total_expenses.toLocaleString()}</td>
                            <td className={`text-right py-3 px-2 ${report.total_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              ${report.total_profit.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Breakdown (for yearly view) */}
              {filterPeriod === 'yearly' && report.monthly_breakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Monthly Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">Month</th>
                            <th className="text-right py-2 px-2">Revenue</th>
                            <th className="text-right py-2 px-2">Rent</th>
                            <th className="text-right py-2 px-2">Expenses</th>
                            <th className="text-right py-2 px-2">Profit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.monthly_breakdown.map((month) => (
                            <tr key={month.month} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-2 font-medium">{month.monthName}</td>
                              <td className="text-right py-2 px-2 text-green-600">${month.revenue.toLocaleString()}</td>
                              <td className="text-right py-2 px-2 text-gray-600">${month.rent.toLocaleString()}</td>
                              <td className="text-right py-2 px-2 text-red-600">${month.expenses.toLocaleString()}</td>
                              <td className={`text-right py-2 px-2 font-medium ${month.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ${month.profit.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Expense Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            <DialogDescription>Track your property expenses for accurate profit/loss reporting.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
            <div>
              <Label>Property *</Label>
              <Select value={formData.property_id} onValueChange={(v) => setFormData({ ...formData, property_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}, {p.city}, {p.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(c.icon)}
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    placeholder="0.00"
                    className="pl-9"
                    value={formData.amount} 
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })} 
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={formData.expense_date} 
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} 
                />
              </div>
              
              <div>
                <Label>Vendor</Label>
                <Input 
                  placeholder="e.g., Home Depot"
                  value={formData.vendor} 
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} 
                />
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Input 
                placeholder="Brief description of expense"
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="recurring-toggle" className="font-medium">Recurring Expense</Label>
                <p className="text-sm text-gray-500">This expense repeats regularly</p>
              </div>
              <Switch 
                id="recurring-toggle"
                checked={formData.is_recurring} 
                onCheckedChange={(c) => setFormData({ ...formData, is_recurring: c })} 
              />
            </div>
            
            {formData.is_recurring && (
              <div>
                <Label>Frequency</Label>
                <Select value={formData.recurring_frequency} onValueChange={(v) => setFormData({ ...formData, recurring_frequency: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label>Receipt</Label>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*,.pdf" 
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {receiptFile ? receiptFile.name : (editingExpense?.receipt_url ? 'Replace Receipt' : 'Upload Receipt')}
              </Button>
              {editingExpense?.receipt_url && !receiptFile && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Receipt attached
                </p>
              )}
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea 
                placeholder="Additional notes..."
                value={formData.notes} 
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingExpense ? 'Update' : 'Add'} Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview */}
      <Dialog open={!!receiptPreview} onOpenChange={() => setReceiptPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receiptPreview && (
            <div className="flex justify-center">
              {receiptPreview.endsWith('.pdf') ? (
                <a href={receiptPreview} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Open PDF Receipt
                </a>
              ) : (
                <img src={receiptPreview} alt="Receipt" className="max-h-[70vh] object-contain rounded-lg" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
