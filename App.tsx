import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DataProvider, useData } from './services/dataContext';
import { Card, Button, Input, Select, Badge, Modal, DeleteButton } from './components/UIComponents';
import { Reports } from './components/Reports';
import { Account, AccountType, TransactionType, Transaction, EggCollection, InvoiceItem } from './types';
import { LayoutDashboard, Users, ShoppingCart, DollarSign, Settings as SettingsIcon, Egg, Menu, X, Printer, Trash2, Plus, BookOpen, Wallet, Download, Briefcase, Calendar, Archive, Edit2, Upload, TrendingUp, TrendingDown, Sparkles, Loader2, Monitor, Smartphone, Grid } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { GoogleGenAI } from "@google/genai";

// --- Sub-Components for Views ---

const Dashboard: React.FC = () => {
    const { eggCollections, transactions, settings, accounts } = useData();
    const todayStr = new Date().toISOString().split('T')[0];
    const [insight, setInsight] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // --- CALCULATIONS ---

    const stats = useMemo(() => {
        // Helper to check date
        const isBeforeToday = (date: string) => date < todayStr;
        const isToday = (date: string) => date.startsWith(todayStr);

        // 1. EGG STOCK
        const prevCollected = eggCollections.filter(c => isBeforeToday(c.date)).reduce((acc, c) => acc + c.collected, 0);
        const prevEggWasted = eggCollections.filter(c => isBeforeToday(c.date)).reduce((acc, c) => acc + c.wasted, 0);
        const prevSold = transactions
            .filter(t => t.type === TransactionType.SALE && isBeforeToday(t.date))
            .reduce((acc, t) => acc + (t.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0);
        
        const eggOpening = prevCollected - prevEggWasted - prevSold;

        const todayCollected = eggCollections.filter(c => isToday(c.date)).reduce((acc, c) => acc + c.collected, 0);
        const todayEggWasted = eggCollections.filter(c => isToday(c.date)).reduce((acc, c) => acc + c.wasted, 0);
        const todaySold = transactions
            .filter(t => t.type === TransactionType.SALE && isToday(t.date))
            .reduce((acc, t) => acc + (t.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0);

        const eggClosing = eggOpening + todayCollected - todayEggWasted - todaySold;

        // 2. CASH FLOW
        const prevIn = transactions.filter(t => isBeforeToday(t.date) && [TransactionType.SALE, TransactionType.RECEIPT, TransactionType.DEPOSIT].includes(t.type)).reduce((acc, t) => acc + t.amount, 0);
        const prevOut = transactions.filter(t => isBeforeToday(t.date) && [TransactionType.EXPENSE, TransactionType.PAYMENT, TransactionType.PURCHASE, TransactionType.WITHDRAWAL].includes(t.type)).reduce((acc, t) => acc + t.amount, 0);
        
        const cashOpening = prevIn - prevOut;

        const todayIn = transactions.filter(t => isToday(t.date) && [TransactionType.SALE, TransactionType.RECEIPT, TransactionType.DEPOSIT].includes(t.type)).reduce((acc, t) => acc + t.amount, 0);
        const todayOutOps = transactions.filter(t => isToday(t.date) && [TransactionType.EXPENSE, TransactionType.PAYMENT, TransactionType.PURCHASE].includes(t.type)).reduce((acc, t) => acc + t.amount, 0);
        const todayWithdrawals = transactions.filter(t => isToday(t.date) && t.type === TransactionType.WITHDRAWAL).reduce((acc, t) => acc + t.amount, 0);
        
        const cashClosing = cashOpening + todayIn - todayOutOps - todayWithdrawals;

        return {
            egg: { opening: eggOpening, collected: todayCollected, wasted: todayEggWasted, sold: todaySold, closing: eggClosing },
            cash: { opening: cashOpening, in: todayIn, out: todayOutOps, withdrawals: todayWithdrawals, closing: cashClosing }
        };

    }, [eggCollections, transactions, todayStr]);

    // --- Income vs Expense Graph Logic ---
    const incomeExpenseData = useMemo(() => {
        const data = [];
        const days = 30;
        
        // Helper for Moving Average
        const calculateSMA = (arr: number[], period: number) => {
            const sma = [];
            for (let i = 0; i < arr.length; i++) {
                const start = Math.max(0, i - period + 1);
                const subset = arr.slice(start, i + 1);
                const avg = subset.reduce((a, b) => a + b, 0) / subset.length;
                sma.push(avg);
            }
            return sma;
        };

        const incomes: number[] = [];
        const expenses: number[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const income = transactions
                .filter(t => t.date === dateStr && [TransactionType.SALE, TransactionType.RECEIPT, TransactionType.DEPOSIT].includes(t.type))
                .reduce((acc, t) => acc + t.amount, 0);
            
            const expense = transactions
                .filter(t => t.date === dateStr && [TransactionType.EXPENSE, TransactionType.PAYMENT, TransactionType.PURCHASE, TransactionType.WITHDRAWAL].includes(t.type))
                .reduce((acc, t) => acc + t.amount, 0);

            incomes.push(income);
            expenses.push(expense);

            data.push({
                date: d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
                income,
                expense
            });
        }

        const incomeSMA = calculateSMA(incomes, 5);
        const expenseSMA = calculateSMA(expenses, 5);

        return data.map((d, i) => ({
            ...d,
            incomeMA: incomeSMA[i],
            expenseMA: expenseSMA[i]
        }));

    }, [transactions]);


    const generateInsights = async () => {
        setIsAnalyzing(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Prepare Data Summary for AI
            const last30Days = new Date();
            last30Days.setDate(last30Days.getDate() - 30);
            const dateStr = last30Days.toISOString().split('T')[0];

            // 1. Production Stats
            const recentCollections = eggCollections.filter(c => c.date >= dateStr);
            const totalCollected = recentCollections.reduce((acc, c) => acc + c.collected, 0);
            const totalWasted = recentCollections.reduce((acc, c) => acc + c.wasted, 0);
            const avgDaily = totalCollected / (recentCollections.length || 1);
            const wasteRate = (totalWasted / (totalCollected || 1)) * 100;

            // 2. Sales Stats
            const recentSales = transactions.filter(t => t.type === TransactionType.SALE && t.date >= dateStr);
            const totalRevenue = recentSales.reduce((acc, t) => acc + t.amount, 0);

            // 3. Customer Analysis
            const customers = accounts.filter(a => a.type === AccountType.CUSTOMER && !a.archived);
            const inactiveCustomers: string[] = [];
            
            customers.forEach(cust => {
                const lastTxn = transactions
                    .filter(t => t.accountId === cust.id && t.type === TransactionType.SALE)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                
                if (!lastTxn || lastTxn.date < dateStr) {
                    inactiveCustomers.push(cust.name);
                }
            });

            const prompt = `
                Act as an expert farm consultant. Analyze this Egg Farm data for the last 30 days:
                
                - Total Eggs Collected: ${totalCollected}
                - Average Daily Collection: ${avgDaily.toFixed(0)}
                - Wastage Rate: ${wasteRate.toFixed(2)}% (Industry standard is 1-2%)
                - Total Revenue: ${settings.currency}${totalRevenue}
                - Total Active Customers: ${customers.length}
                - Inactive Customers (No Purchase in 30 days): ${inactiveCustomers.join(', ') || 'None'}

                Provide a concise response with 3 headings:
                1. 🥚 **Production Insight**: Comment on efficiency and wastage.
                2. 💰 **Sales Trend**: Comment on revenue health.
                3. ⚠️ **Customer Alert**: Specifically list the inactive customers and suggest a quick action to win them back.
                
                Keep it brief, professional, and actionable. Do not use markdown for the headers, just bold them.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            setInsight(response.text);

        } catch (error) {
            console.error(error);
            setInsight("Failed to generate insight. Please check your connection.");
        } finally {
            setIsAnalyzing(false);
        }
    };


    const StatRow = ({ label, value, isCurrency = false, colorClass = "text-theme-base" }: { label: string, value: number, isCurrency?: boolean, colorClass?: string }) => (
        <div className="flex justify-between items-center py-2 border-b border-theme-border last:border-0">
            <span className="text-theme-muted text-sm">{label}</span>
            <span className={`font-mono font-medium ${colorClass}`}>
                {isCurrency ? settings.currency : ''}{value.toLocaleString(undefined, { minimumFractionDigits: isCurrency ? 2 : 0, maximumFractionDigits: 2 })}
                {!isCurrency && ''}
            </span>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-300">
            
            {/* AI Insight Section */}
            <Card className="bg-gradient-to-r from-violet-900/20 to-fuchsia-900/20 border-purple-500/30">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="p-4 bg-purple-500/20 rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                        <Sparkles size={32} className="text-purple-400" />
                    </div>
                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-bold text-theme-base">AI Farm Analyst</h3>
                            {!insight && (
                                <Button onClick={generateInsights} disabled={isAnalyzing} className="bg-theme-surface hover:bg-theme-border text-sm py-1 px-3">
                                    {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : 'Analyze Data'}
                                </Button>
                            )}
                        </div>
                        
                        {!insight && !isAnalyzing && (
                            <p className="text-theme-muted text-sm">Click analyze to generate insights on Production, Sales, and Customer Retention (Inactive Customers).</p>
                        )}

                        {isAnalyzing && (
                            <div className="space-y-3 animate-pulse mt-4">
                                <div className="h-4 bg-theme-muted/20 rounded w-3/4"></div>
                                <div className="h-4 bg-theme-muted/20 rounded w-1/2"></div>
                                <div className="h-4 bg-theme-muted/20 rounded w-full"></div>
                            </div>
                        )}

                        {insight && (
                            <div className="mt-2 text-theme-base text-sm leading-relaxed whitespace-pre-line p-4 bg-theme-surface rounded-xl border border-theme-border">
                                {insight}
                                <div className="mt-4 flex justify-end">
                                    <button onClick={() => setInsight(null)} className="text-xs text-theme-muted hover:text-theme-base underline">Refresh Analysis</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* TODAY'S STOCK */}
                <Card className="border-orange-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-yellow-500/20 rounded-lg"><Egg className="text-yellow-500" size={24} /></div>
                        <h3 className="text-lg font-semibold text-theme-base">Today's Egg Stock</h3>
                    </div>
                    <div className="space-y-1">
                        <StatRow label="Opening Stock" value={stats.egg.opening} />
                        <StatRow label="Collected" value={stats.egg.collected} colorClass="text-green-500" />
                        <StatRow label="Wasted" value={stats.egg.wasted} colorClass="text-red-500" />
                        <StatRow label="Sold" value={stats.egg.sold} colorClass="text-blue-500" />
                        <div className="pt-2 mt-2 border-t border-theme-border">
                            <StatRow label="Closing Stock" value={stats.egg.closing} colorClass="text-yellow-600 font-bold text-lg" />
                        </div>
                    </div>
                </Card>

                {/* CASH FLOW */}
                <Card className="border-blue-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg"><Wallet className="text-blue-500" size={24} /></div>
                        <h3 className="text-lg font-semibold text-theme-base">Today's Cash Flow</h3>
                    </div>
                    <div className="space-y-1">
                        <StatRow label="Opening Cash" value={stats.cash.opening} isCurrency />
                        <StatRow label="Cash In" value={stats.cash.in} isCurrency colorClass="text-green-500" />
                        <StatRow label="Cash Out" value={stats.cash.out} isCurrency colorClass="text-red-500" />
                        <StatRow label="Withdrawals" value={stats.cash.withdrawals} isCurrency colorClass="text-purple-500" />
                        <div className="pt-2 mt-2 border-t border-theme-border">
                            <StatRow label="Closing Cash" value={stats.cash.closing} isCurrency colorClass="text-blue-500 font-bold text-lg" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Income vs Expense Graph */}
            <Card title="Monthly Income vs Expense (with Moving Averages)">
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={incomeExpenseData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" vertical={false} />
                            <XAxis dataKey="date" stroke="currentColor" tick={{fill: 'currentColor', fontSize: 12, opacity: 0.6}} />
                            <YAxis stroke="currentColor" tick={{fill: 'currentColor', fontSize: 12, opacity: 0.6}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-base)' }}
                            />
                            <Legend />
                            <Bar dataKey="income" name="Income" fill="#22c55e" barSize={10} radius={[4, 4, 0, 0]} fillOpacity={0.6} />
                            <Bar dataKey="expense" name="Expense" fill="#ef4444" barSize={10} radius={[4, 4, 0, 0]} fillOpacity={0.6} />
                            <Line type="monotone" dataKey="incomeMA" name="Income (Avg)" stroke="#4ade80" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="expenseMA" name="Expense (Avg)" stroke="#f87171" strokeWidth={2} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Reports />
        </div>
    );
};

const AccountsManager: React.FC = () => {
    const { accounts, addAccount, updateAccount } = useData();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const openNewModal = () => {
        setEditingAccount({ type: AccountType.CUSTOMER, category: 'General', name: '', phone: '', address: '' });
        setModalOpen(true);
    };

    const openEditModal = (account: Account) => {
        setEditingAccount(account);
        setModalOpen(true);
    };

    const handleSubmit = () => {
        if (editingAccount?.name) {
            if (editingAccount.id) {
                updateAccount(editingAccount as Account);
            } else {
                addAccount(editingAccount as Account);
            }
            setModalOpen(false);
            setEditingAccount(null);
        }
    };

    const toggleArchive = (account: Account) => {
        updateAccount({ ...account, archived: !account.archived });
    };

    const displayedAccounts = accounts.filter(a => showArchived ? true : !a.archived);

    return (
        <div className="space-y-6">
            <Card 
                title="Accounts Directory" 
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setShowArchived(!showArchived)}>
                            {showArchived ? 'Hide Archived' : 'Show Archived'}
                        </Button>
                        <Button onClick={openNewModal}><Plus size={16} className="inline mr-2"/> Add Account</Button>
                    </div>
                }
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-theme-muted text-sm border-b border-theme-border">
                                <th className="p-4">Name</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Phone</th>
                                <th className="p-4">Address</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedAccounts.map(acc => (
                                <tr key={acc.id} className={`border-b border-theme-border hover:bg-theme-surface transition-colors ${acc.archived ? 'opacity-50' : ''}`}>
                                    <td className="p-4 font-medium flex items-center gap-2 text-theme-base">
                                        {acc.name}
                                        {acc.archived && <Badge color="bg-gray-500/20 text-gray-400">Archived</Badge>}
                                    </td>
                                    <td className="p-4"><Badge color={acc.type === AccountType.OWNER ? 'bg-purple-500/20 text-purple-800' : undefined}>{acc.type}</Badge></td>
                                    <td className="p-4 text-sm text-theme-muted">{acc.category || '-'}</td>
                                    <td className="p-4 text-theme-muted">{acc.phone}</td>
                                    <td className="p-4 text-theme-muted">{acc.address}</td>
                                    <td className="p-4 text-right flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => toggleArchive(acc)} 
                                            className={`p-2 hover:bg-theme-muted/10 rounded-full transition-colors ${acc.archived ? 'text-yellow-500 bg-yellow-400/10' : 'text-theme-muted hover:text-theme-base'}`}
                                            title={acc.archived ? "Unarchive" : "Archive"}
                                        >
                                            <Archive size={16} />
                                        </button>
                                        <button onClick={() => openEditModal(acc)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-full" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingAccount?.id ? "Edit Account" : "New Account"}>
                <div className="space-y-4">
                    <Input label="Name" value={editingAccount?.name || ''} onChange={e => setEditingAccount({...editingAccount!, name: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Type" value={editingAccount?.type || AccountType.CUSTOMER} onChange={e => setEditingAccount({...editingAccount!, type: e.target.value as AccountType})}>
                            {Object.values(AccountType).map(t => <option key={t} value={t} className="text-black">{t}</option>)}
                        </Select>
                        <Select label="Category" value={editingAccount?.category || 'General'} onChange={e => setEditingAccount({...editingAccount!, category: e.target.value as any})}>
                            <option value="Income" className="text-black">Income</option>
                            <option value="Expense" className="text-black">Expense</option>
                            <option value="General" className="text-black">General</option>
                        </Select>
                    </div>
                    <Input label="Phone" value={editingAccount?.phone || ''} onChange={e => setEditingAccount({...editingAccount!, phone: e.target.value})} />
                    <Input label="Address" value={editingAccount?.address || ''} onChange={e => setEditingAccount({...editingAccount!, address: e.target.value})} />
                    
                    {editingAccount?.type === AccountType.EMPLOYEE && (
                        <div className="p-4 bg-theme-surface rounded-lg space-y-3">
                            <h4 className="text-sm font-semibold text-theme-base">Employee Details</h4>
                            <Input label="Monthly Salary" type="number" value={editingAccount?.salary || 0} onChange={e => setEditingAccount({...editingAccount!, salary: parseFloat(e.target.value)})} />
                            <Input label="Joining Date" type="date" value={editingAccount?.joiningDate || ''} onChange={e => setEditingAccount({...editingAccount!, joiningDate: e.target.value})} />
                        </div>
                    )}
                    
                    <Button className="w-full mt-4" onClick={handleSubmit}>Save Account</Button>
                </div>
            </Modal>
        </div>
    );
};

const InvoiceManager: React.FC = () => {
    const { accounts, transactions, addTransaction, deleteTransaction, settings } = useData();
    const [activeTab, setActiveTab] = useState<'sales' | 'history'>('sales');
    const [formData, setFormData] = useState<Partial<Transaction>>({ 
        type: TransactionType.SALE, 
        date: new Date().toISOString().split('T')[0],
        items: [],
        amount: 0 
    });
    const [currentItem, setCurrentItem] = useState<InvoiceItem>({ description: 'Eggs', quantity: 1, unitPrice: 0, total: 0 });

    const addItem = () => {
        const itemTotal = currentItem.quantity * currentItem.unitPrice;
        const newItem = { ...currentItem, total: itemTotal };
        const updatedItems = [...(formData.items || []), newItem];
        setFormData({ 
            ...formData, 
            items: updatedItems,
            amount: updatedItems.reduce((acc, i) => acc + i.total, 0)
        });
        setCurrentItem({ description: 'Eggs', quantity: 1, unitPrice: 0, total: 0 });
    };

    const removeItem = (idx: number) => {
        const updatedItems = (formData.items || []).filter((_, i) => i !== idx);
        setFormData({
            ...formData,
            items: updatedItems,
            amount: updatedItems.reduce((acc, i) => acc + i.total, 0)
        });
    };

    const submitTransaction = () => {
        if (!formData.accountId) return alert("Select an account");
        addTransaction(formData as Transaction);
        setFormData({ type: TransactionType.SALE, date: new Date().toISOString().split('T')[0], items: [], amount: 0 });
        alert("Invoice Saved!");
    };

    const printInvoice = (t: Transaction) => {
        const acc = accounts.find(a => a.id === t.accountId);
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        
        if (!printWindow) {
            alert("Please allow popups to print receipt");
            return;
        }

        const dateStr = new Date(t.date).toLocaleDateString();

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt #${t.id.substring(0, 6)}</title>
                <style>
                    @page { margin: 0; }
                    body { 
                        font-family: 'Courier New', Courier, monospace; 
                        width: 76mm; /* Standard thermal receipt width */
                        margin: 0 auto; 
                        padding: 10px 4px;
                        color: black; 
                        background: white; 
                        font-size: 12px;
                    }
                    .header { text-align: center; margin-bottom: 15px; }
                    .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
                    .subtitle { font-size: 12px; text-transform: uppercase; }
                    .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
                    
                    /* Table for items to ensure alignment */
                    table { width: 100%; border-collapse: collapse; }
                    th { text-align: left; font-size: 10px; border-bottom: 1px dashed #000; padding-bottom: 4px; text-transform: uppercase; }
                    td { vertical-align: top; padding: 4px 0; font-size: 12px; }
                    .col-qty { text-align: center; width: 15%; }
                    .col-price { text-align: right; width: 20%; }
                    .col-total { text-align: right; width: 25%; }
                    .col-desc { text-align: left; width: 40%; }
                    
                    .total-section { margin-top: 10px; border-top: 1px dashed #000; padding-top: 8px; }
                    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; }
                    .footer { text-align: center; margin-top: 25px; font-size: 10px; color: #333; }
                    .no-print { display: none; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">${settings.farmName}</div>
                    <div class="subtitle">Sales Receipt</div>
                </div>
                
                <div class="divider"></div>
                
                <div class="row"><span>Date:</span> <span>${dateStr}</span></div>
                <div class="row"><span>Invoice #:</span> <span>${t.id.substring(0, 6).toUpperCase()}</span></div>
                <div class="row"><span>Customer:</span> <span>${acc?.name || 'Walk-in'}</span></div>
                
                <div style="margin-top: 10px;">
                    <table>
                        <thead>
                            <tr>
                                <th class="col-desc">Item</th>
                                <th class="col-qty">Qty</th>
                                <th class="col-price">Rate</th>
                                <th class="col-total">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(t.items && t.items.length > 0) ? t.items.map(item => `
                                <tr>
                                    <td class="col-desc">${item.description}</td>
                                    <td class="col-qty">${item.quantity}</td>
                                    <td class="col-price">${item.unitPrice}</td>
                                    <td class="col-total">${item.total.toLocaleString()}</td>
                                </tr>
                            `).join('') : `<tr><td colspan="4">${t.type} - ${t.notes || ''}</td></tr>`}
                        </tbody>
                    </table>
                </div>
                
                <div class="total-section">
                    <div class="total-row">
                        <span>TOTAL</span>
                        <span>${settings.currency} ${t.amount.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Thank you for your business!</p>
                    <p>Software by EggFlow Pro</p>
                </div>
                
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const activeAccounts = accounts.filter(a => !a.archived);

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-theme-border pb-4">
                <button onClick={() => setActiveTab('sales')} className={`pb-2 px-2 ${activeTab === 'sales' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-theme-muted'}`}>Sales Invoice</button>
                <button onClick={() => setActiveTab('history')} className={`pb-2 px-2 ${activeTab === 'history' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-theme-muted'}`}>Invoice History</button>
            </div>

            {activeTab === 'sales' && (
                <Card title="New Sales Invoice">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <Select label="Customer" value={formData.accountId || ''} onChange={e => setFormData({...formData, accountId: e.target.value})}>
                            <option value="" className="text-black">Select Customer</option>
                            {activeAccounts.filter(a => a.type !== AccountType.OWNER).map(a => <option key={a.id} value={a.id} className="text-black">{a.name} ({a.type})</option>)}
                        </Select>
                        <Input type="date" label="Date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>

                    <div className="bg-theme-surface p-4 rounded-xl mb-4 border border-theme-border">
                        <h4 className="text-sm font-semibold mb-3 text-theme-muted uppercase">Add Items</h4>
                        <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5"><Input placeholder="Item Description" value={currentItem.description} onChange={e => setCurrentItem({...currentItem, description: e.target.value})} /></div>
                            <div className="col-span-2"><Input type="number" placeholder="Qty" value={currentItem.quantity} onChange={e => setCurrentItem({...currentItem, quantity: parseFloat(e.target.value)})} /></div>
                            <div className="col-span-3"><Input type="number" placeholder="Price" value={currentItem.unitPrice} onChange={e => setCurrentItem({...currentItem, unitPrice: parseFloat(e.target.value)})} /></div>
                            <div className="col-span-2"><Button onClick={addItem} className="w-full">Add</Button></div>
                        </div>
                    </div>

                    <div className="mb-6">
                         <table className="w-full text-left text-sm">
                            <thead><tr className="border-b border-theme-border text-theme-muted"><th className="py-2">Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead>
                            <tbody>
                                {formData.items?.map((item, idx) => (
                                    <tr key={idx} className="border-b border-theme-border">
                                        <td className="py-2 text-theme-base">{item.description}</td>
                                        <td className="text-theme-base">{item.quantity}</td>
                                        <td className="text-theme-base">{item.unitPrice}</td>
                                        <td className="text-theme-base">{item.total}</td>
                                        <td className="text-right"><button onClick={() => removeItem(idx)} className="text-red-400"><X size={14}/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                         <div className="flex justify-between items-center mt-4 text-xl font-bold text-theme-base">
                             <span>Total</span>
                             <span>{settings.currency}{formData.amount}</span>
                         </div>
                    </div>
                    <Button className="w-full py-3 text-lg" onClick={submitTransaction}>Create Invoice</Button>
                </Card>
            )}

            {activeTab === 'history' && (
                 <Card title="Recent Invoices">
                    <div className="space-y-3">
                        {transactions.slice().reverse().map(t => {
                             const acc = accounts.find(a => a.id === t.accountId);
                             return (
                                <div key={t.id} className="flex justify-between items-center p-3 bg-theme-surface rounded-lg border border-theme-border">
                                    <div>
                                        <div className="font-semibold text-theme-base">{acc?.name || 'Unknown'} <Badge>{t.type}</Badge></div>
                                        <div className="text-xs text-theme-muted">{t.date} • #{t.id.substring(0,6)}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`font-bold ${[TransactionType.SALE, TransactionType.RECEIPT].includes(t.type) ? 'text-green-500' : 'text-red-500'}`}>
                                            {settings.currency}{t.amount}
                                        </span>
                                        <div className="flex gap-2">
                                            <button onClick={() => printInvoice(t)} className="p-2 hover:bg-theme-muted/10 rounded-full text-theme-muted" title="Print POS Receipt"><Printer size={16}/></button>
                                            <DeleteButton onDelete={() => deleteTransaction(t.id)} />
                                        </div>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                 </Card>
            )}
        </div>
    );
};

const EggCollectionManager: React.FC = () => {
    const { eggCollections, addEggCollection, deleteEggCollection } = useData();
    const [entry, setEntry] = useState<Partial<EggCollection>>({ date: new Date().toISOString().split('T')[0], collected: 0, wasted: 0 });

    const handleAdd = () => {
        addEggCollection(entry as EggCollection);
        setEntry({ date: new Date().toISOString().split('T')[0], collected: 0, wasted: 0 });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="New Collection">
                <div className="space-y-4">
                    <Input type="date" label="Date" value={entry.date} onChange={e => setEntry({...entry, date: e.target.value})} />
                    <Input type="number" label="Collected Qty" value={entry.collected} onChange={e => setEntry({...entry, collected: parseInt(e.target.value)})} />
                    <Input type="number" label="Wasted/Broken Qty" value={entry.wasted} onChange={e => setEntry({...entry, wasted: parseInt(e.target.value)})} />
                    <Input label="Notes" value={entry.notes || ''} onChange={e => setEntry({...entry, notes: e.target.value})} />
                    <Button onClick={handleAdd} className="w-full">Add Entry</Button>
                </div>
            </Card>
            <Card title="Recent History" className="max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                    {eggCollections.slice().reverse().map(c => (
                        <div key={c.id} className="flex justify-between items-center p-3 bg-theme-surface rounded-lg border border-theme-border">
                            <div>
                                <div className="text-sm text-theme-muted">{c.date}</div>
                                <div className="font-medium text-theme-base">Collected: {c.collected} | Wasted: <span className="text-red-500">{c.wasted}</span></div>
                            </div>
                            <DeleteButton onDelete={() => deleteEggCollection(c.id)} />
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

const LedgerManager: React.FC = () => {
    const { accounts, transactions, settings, addTransaction } = useData();
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });
    
    // Quick Add Modal State
    const [isTxnModalOpen, setTxnModalOpen] = useState(false);
    const [newTxn, setNewTxn] = useState<Partial<Transaction>>({
        date: new Date().toISOString().split('T')[0],
        type: TransactionType.EXPENSE,
        amount: 0,
        notes: ''
    });

    const ledgerData = useMemo(() => {
        if (!selectedAccountId) return { openingBalance: 0, rows: [] };

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59);

        // Filter transactions for this account
        const accountTxns = transactions.filter(t => t.accountId === selectedAccountId);

        // Sort by date
        accountTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate Opening Balance
        let balance = 0;
        const openingBalance = accountTxns.reduce((acc, t) => {
            if (new Date(t.date) < start) {
                if ([TransactionType.SALE, TransactionType.WITHDRAWAL].includes(t.type)) return acc + t.amount;
                if ([TransactionType.RECEIPT, TransactionType.DEPOSIT, TransactionType.PAYMENT, TransactionType.PURCHASE, TransactionType.EXPENSE].includes(t.type)) return acc - t.amount;
            }
            return acc;
        }, 0);

        balance = openingBalance;

        const rows = accountTxns
            .filter(t => new Date(t.date) >= start && new Date(t.date) <= end)
            .map(t => {
                const isDebit = [TransactionType.SALE, TransactionType.WITHDRAWAL, TransactionType.PAYMENT].includes(t.type); 
                const isCredit = [TransactionType.PURCHASE, TransactionType.RECEIPT, TransactionType.DEPOSIT, TransactionType.EXPENSE].includes(t.type);

                const amount = t.amount;
                
                if (isDebit) balance += amount;
                else balance -= amount;

                return {
                    ...t,
                    debit: isDebit ? amount : 0,
                    credit: isCredit ? amount : 0,
                    balance
                };
            });

        return { openingBalance, rows };
    }, [selectedAccountId, dateRange, transactions]);

    const exportPDF = () => {
        if (!selectedAccountId) return;
        const account = accounts.find(a => a.id === selectedAccountId);
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`${settings.farmName} - Ledger`, 14, 20);
        doc.setFontSize(12);
        doc.text(`Account: ${account?.name} (${account?.type})`, 14, 30);
        doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 37);
        doc.text(`Opening Balance: ${settings.currency}${ledgerData.openingBalance}`, 14, 44);

        const tableBody = ledgerData.rows.map(row => [
            row.date,
            row.type,
            row.notes || row.items?.map(i => i.description).join(', ') || '-',
            row.debit > 0 ? `${settings.currency}${row.debit}` : '-',
            row.credit > 0 ? `${settings.currency}${row.credit}` : '-',
            `${settings.currency}${row.balance.toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: 50,
            head: [['Date', 'Type', 'Description', 'Debit (+)', 'Credit (-)', 'Balance']],
            body: tableBody,
            foot: [[
                'Closing Balance', 
                '', 
                '', 
                '', 
                '', 
                `${settings.currency}${ledgerData.rows.length > 0 ? ledgerData.rows[ledgerData.rows.length-1].balance.toFixed(2) : ledgerData.openingBalance}`
            ]],
        });

        doc.save(`ledger_${account?.name}_${dateRange.start}.pdf`);
    };

    const handleAddTransaction = () => {
        if (!selectedAccountId) return;
        if ((newTxn.amount || 0) <= 0) return alert('Invalid Amount');
        
        addTransaction({
            ...newTxn,
            accountId: selectedAccountId
        } as Transaction);
        setTxnModalOpen(false);
        setNewTxn({ date: new Date().toISOString().split('T')[0], type: TransactionType.EXPENSE, amount: 0, notes: '' });
    };

    return (
        <div className="space-y-6">
            <Card className="flex flex-col md:flex-row gap-4 items-end">
                <Select label="Select Account" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="flex-1">
                    <option value="" className="text-black">Choose Account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id} className="text-black">{a.name} ({a.category || a.type})</option>)}
                </Select>
                <Input type="date" label="From" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                <Input type="date" label="To" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                <div className="flex gap-2">
                    <Button onClick={exportPDF} disabled={!selectedAccountId} className="flex items-center gap-2">
                        <Download size={18} /> Export
                    </Button>
                    <Button onClick={() => setTxnModalOpen(true)} disabled={!selectedAccountId} className="bg-emerald-600 hover:bg-emerald-500">
                        <Plus size={18} className="mr-1" /> New Entry
                    </Button>
                </div>
            </Card>

            {selectedAccountId && (
                <Card title="Ledger Entries" className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-theme-muted border-b border-theme-border">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Description</th>
                                    <th className="p-3 text-right text-green-500">Debit (+)/Paid</th>
                                    <th className="p-3 text-right text-red-500">Credit (-)/Due</th>
                                    <th className="p-3 text-right font-bold text-theme-base">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-theme-surface font-medium">
                                    <td colSpan={5} className="p-3 text-theme-muted">Opening Balance</td>
                                    <td className="p-3 text-right text-theme-base">{settings.currency}{ledgerData.openingBalance.toFixed(2)}</td>
                                </tr>
                                {ledgerData.rows.map(row => (
                                    <tr key={row.id} className="border-b border-theme-border hover:bg-theme-surface">
                                        <td className="p-3 text-theme-base">{row.date}</td>
                                        <td className="p-3"><Badge>{row.type}</Badge></td>
                                        <td className="p-3 text-theme-muted">{row.notes || (row.items && row.items.length > 0 ? row.items[0].description + (row.items.length > 1 ? '...' : '') : '-')}</td>
                                        <td className="p-3 text-right font-mono text-theme-base">{row.debit > 0 ? row.debit : '-'}</td>
                                        <td className="p-3 text-right font-mono text-theme-base">{row.credit > 0 ? row.credit : '-'}</td>
                                        <td className="p-3 text-right font-mono font-bold text-blue-400">{row.balance.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Modal isOpen={isTxnModalOpen} onClose={() => setTxnModalOpen(false)} title="Record Transaction">
                <div className="space-y-4">
                    <Select label="Type" value={newTxn.type} onChange={e => setNewTxn({...newTxn, type: e.target.value as TransactionType})}>
                        {Object.values(TransactionType).map(t => <option key={t} value={t} className="text-black">{t}</option>)}
                    </Select>
                    <Input type="date" label="Date" value={newTxn.date} onChange={e => setNewTxn({...newTxn, date: e.target.value})} />
                    <Input type="number" label="Amount" value={newTxn.amount} onChange={e => setNewTxn({...newTxn, amount: parseFloat(e.target.value)})} />
                    <Input label="Notes" value={newTxn.notes} onChange={e => setNewTxn({...newTxn, notes: e.target.value})} />
                    <Button onClick={handleAddTransaction} className="w-full mt-4">Save Entry</Button>
                </div>
            </Modal>
        </div>
    );
};

const CashDrawManager: React.FC = () => {
    const { transactions, accounts, addTransaction, settings } = useData();
    const [mode, setMode] = useState<'deposit' | 'withdraw'>('withdraw');
    const [amount, setAmount] = useState(0);
    const [notes, setNotes] = useState('');
    const [accountId, setAccountId] = useState('');

    const activeAccounts = accounts.filter(a => !a.archived);

    // Calculate Cash in Hand (Global)
    const cashBalance = useMemo(() => {
        return transactions.reduce((acc, t) => {
            if ([TransactionType.SALE, TransactionType.RECEIPT, TransactionType.DEPOSIT].includes(t.type)) return acc + t.amount;
            if ([TransactionType.EXPENSE, TransactionType.PAYMENT, TransactionType.PURCHASE, TransactionType.WITHDRAWAL].includes(t.type)) return acc - t.amount;
            return acc;
        }, 0);
    }, [transactions]);

    const handleTransaction = () => {
        if (amount <= 0) return alert("Enter valid amount");
        if (!accountId) return alert("Select an account");

        addTransaction({
            date: new Date().toISOString().split('T')[0],
            type: mode === 'deposit' ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL,
            amount: amount,
            accountId: accountId,
            notes: notes || (mode === 'deposit' ? 'Manual Deposit' : 'Manual Withdrawal')
        });

        setAmount(0);
        setNotes('');
        alert("Transaction Recorded");
    };

    const cashHistory = transactions
        .filter(t => [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL].includes(t.type))
        .slice().reverse();

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-green-500/30">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg text-green-200 font-medium uppercase tracking-widest mb-1">Cash in Hand</h3>
                        <p className="text-5xl font-bold text-white tracking-tight">{settings.currency}{cashBalance.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-green-500/20 rounded-full border border-green-400/20 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                        <Wallet size={48} className="text-green-400" />
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Cash Operations">
                    <div className="flex gap-2 mb-6 bg-theme-surface p-1 rounded-xl">
                        <button onClick={() => setMode('withdraw')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'withdraw' ? 'bg-red-500/80 text-white shadow-lg' : 'hover:bg-theme-muted/10 text-theme-muted'}`}>Withdraw</button>
                        <button onClick={() => setMode('deposit')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'deposit' ? 'bg-green-500/80 text-white shadow-lg' : 'hover:bg-theme-muted/10 text-theme-muted'}`}>Deposit</button>
                    </div>

                    <div className="space-y-4">
                        <Select label="Account" value={accountId} onChange={e => setAccountId(e.target.value)}>
                            <option value="" className="text-black">Select Account</option>
                            {activeAccounts.map(a => <option key={a.id} value={a.id} className="text-black">{a.name} ({a.type})</option>)}
                        </Select>
                        
                        <Input type="number" label="Amount" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} />
                        <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason..." />
                        
                        <Button 
                            onClick={handleTransaction} 
                            disabled={activeAccounts.length === 0} 
                            className="w-full" 
                            variant={mode === 'withdraw' ? 'danger' : 'primary'}
                        >
                            Confirm {mode === 'withdraw' ? 'Withdrawal' : 'Deposit'}
                        </Button>
                    </div>
                </Card>

                <Card title="Recent Cash History" className="max-h-[400px] overflow-y-auto">
                    <div className="space-y-3">
                        {cashHistory.map(t => {
                            const owner = accounts.find(a => a.id === t.accountId);
                            return (
                                <div key={t.id} className="flex justify-between items-center p-3 bg-theme-surface rounded-lg border-l-4 border-l-theme-border" style={{ borderLeftColor: t.type === TransactionType.DEPOSIT ? '#22c55e' : '#ef4444' }}>
                                    <div>
                                        <div className="font-semibold text-theme-base">{t.type}</div>
                                        <div className="text-xs text-theme-muted">{t.date} • {owner?.name}</div>
                                        {t.notes && <div className="text-xs text-theme-muted italic">{t.notes}</div>}
                                    </div>
                                    <span className={`font-mono font-bold ${t.type === TransactionType.DEPOSIT ? 'text-green-500' : 'text-red-500'}`}>
                                        {t.type === TransactionType.DEPOSIT ? '+' : '-'}{settings.currency}{t.amount}
                                    </span>
                                </div>
                            );
                        })}
                        {cashHistory.length === 0 && <div className="text-center text-theme-muted py-4">No cash movement recorded</div>}
                    </div>
                </Card>
            </div>
        </div>
    );
};

const SettingsView: React.FC = () => {
    const { settings, updateSettings, exportData, importData } = useData();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const themes = [
        { id: 'stained-glass', name: 'iOS Stained Glass', icon: <Sparkles size={20}/>, desc: 'Dark, modern, glassmorphism' },
        { id: 'windows-xp', name: 'Windows XP Style', icon: <Monitor size={20}/>, desc: 'Retro blue, classic desktop feel' },
        { id: 'android-16', name: 'Android 16 Style', icon: <Smartphone size={20}/>, desc: 'Material You, rounded, dynamic' },
    ];

    const handleExport = () => {
        const data = exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eggflow_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                try {
                    importData(event.target.result as string);
                    alert("Data imported successfully! The page will reload.");
                    window.location.reload();
                } catch (err) {
                    alert("Failed to import data. Invalid format.");
                }
            }
        };
        reader.readAsText(file);
        // Reset input to allow same file selection again if needed
        e.target.value = '';
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Card title="Appearance">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {themes.map(t => (
                        <button
                            key={t.id}
                            onClick={() => updateSettings({ theme: t.id as any })}
                            className={`p-4 rounded-xl border flex flex-col items-center text-center gap-3 transition-all ${settings.theme === t.id ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/30' : 'bg-theme-surface border-theme-border hover:bg-theme-muted/10'}`}
                        >
                            <div className={settings.theme === t.id ? 'text-blue-400' : 'text-theme-muted'}>{t.icon}</div>
                            <div>
                                <div className={`font-bold ${settings.theme === t.id ? 'text-blue-400' : 'text-theme-base'}`}>{t.name}</div>
                                <div className="text-xs text-theme-muted mt-1">{t.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </Card>

            <Card title="Data Backup & Restore">
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2">
                        <Download size={18} /> Export Backup (JSON)
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2" variant="secondary">
                        <Upload size={18} /> Import Backup (JSON)
                    </Button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImport} 
                        accept=".json" 
                        className="hidden" 
                    />
                </div>
                <p className="text-xs text-theme-muted mt-3">
                    Export your data regularly to prevent data loss. Importing will overwrite current data.
                </p>
            </Card>
        </div>
    )
}

// --- Main App Layout ---

const App: React.FC = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
      { id: 'collection', label: 'Collection', icon: <Egg size={20} /> },
      { id: 'invoices', label: 'Sales & Invoices', icon: <ShoppingCart size={20} /> },
      { id: 'ledger', label: 'Ledger', icon: <BookOpen size={20} /> },
      { id: 'cash', label: 'Cash Draw', icon: <Wallet size={20} /> },
      { id: 'accounts', label: 'Accounts', icon: <Users size={20} /> },
      { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
  ];

  return (
    <DataProvider>
      <ThemeHandler />
      <div className="min-h-screen flex font-sans selection:bg-blue-500/30">
        
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-theme-surface backdrop-blur-md border-r border-theme-border transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:block`}>
            <div className="p-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">EggFlow</h1>
                <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-theme-base"><X /></button>
            </div>
            <nav className="px-4 space-y-2 mt-4">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => { setActiveView(item.id); setMobileMenuOpen(false); }}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${activeView === item.id ? 'bg-theme-muted/10 shadow-lg shadow-black/5 font-semibold text-theme-base' : 'text-theme-muted hover:bg-theme-muted/5 hover:text-theme-base'}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <header className="sticky top-0 z-30 flex items-center justify-between p-4 md:p-6 bg-theme-surface/80 backdrop-blur-md border-b border-theme-border">
                <div className="flex items-center gap-4">
                    <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 hover:bg-theme-muted/10 rounded-lg text-theme-base"><Menu /></button>
                    <h2 className="text-xl font-semibold capitalize text-theme-base">{activeView === 'cash' ? 'Cash Draw' : activeView}</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 shadow-inner"></div>
                </div>
            </header>
            
            <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
                {activeView === 'dashboard' && <Dashboard />}
                {activeView === 'collection' && <EggCollectionManager />}
                {activeView === 'invoices' && <InvoiceManager />}
                {activeView === 'ledger' && <LedgerManager />}
                {activeView === 'cash' && <CashDrawManager />}
                {activeView === 'accounts' && <AccountsManager />}
                {activeView === 'settings' && <SettingsView />}
            </div>
        </main>
      </div>
    </DataProvider>
  );
};

const ThemeHandler: React.FC = () => {
    const { settings } = useData();
    
    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;

        if (settings.theme === 'windows-xp') {
            body.style.background = 'url(https://i.imgur.com/Zk6TR5k.jpg) center center/cover fixed no-repeat, #245edb';
            root.style.setProperty('--text-base', '#000000');
            root.style.setProperty('--text-muted', '#444444');
            root.style.setProperty('--bg-surface', '#FFFFFF');
            root.style.setProperty('--bg-panel', '#ECE9D8');
            root.style.setProperty('--border-color', '#003c74');
        } else if (settings.theme === 'android-16') {
            body.style.background = '#f2f0f4';
            root.style.setProperty('--text-base', '#1a1c1e');
            root.style.setProperty('--text-muted', '#444746');
            root.style.setProperty('--bg-surface', '#ffffff');
            root.style.setProperty('--bg-panel', '#F3F4F6');
            root.style.setProperty('--border-color', '#E0E2E5');
        } else {
            // Stained Glass
            body.style.background = 'linear-gradient(135deg, #1a1c2c 0%, #4a192c 50%, #1f1f45 100%)';
            root.style.setProperty('--text-base', '#ffffff');
            root.style.setProperty('--text-muted', 'rgba(255,255,255,0.6)');
            root.style.setProperty('--bg-surface', 'rgba(255,255,255,0.05)');
            root.style.setProperty('--bg-panel', 'rgba(0,0,0,0.2)');
            root.style.setProperty('--border-color', 'rgba(255,255,255,0.1)');
        }
    }, [settings.theme]);

    return null;
}

export default App;