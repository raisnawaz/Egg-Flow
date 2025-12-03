
import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { Card, Button, Input } from './UIComponents';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Share2, FileText } from 'lucide-react';
import { TransactionType } from '../types';

export const Reports: React.FC = () => {
  const { eggCollections, feedTransactions, transactions, settings } = useData();
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // --- Calculations ---

  const reportData = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    const isInRange = (d: string) => {
        const date = new Date(d);
        return date >= start && date <= end;
    };
    
    const isBeforeRange = (d: string) => new Date(d) < start;

    // Egg Production
    const eggsOpening = eggCollections.filter(c => isBeforeRange(c.date)).reduce((acc, c) => acc + c.collected - c.wasted, 0)
        - transactions.filter(t => t.type === TransactionType.SALE && isBeforeRange(t.date)).reduce((acc, t) => acc + (t.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0);
    
    const eggsCollected = eggCollections.filter(c => isInRange(c.date)).reduce((acc, c) => acc + c.collected, 0);
    const eggsWasted = eggCollections.filter(c => isInRange(c.date)).reduce((acc, c) => acc + c.wasted, 0);
    const eggsSold = transactions.filter(t => t.type === TransactionType.SALE && isInRange(t.date)).reduce((acc, t) => acc + (t.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0);
    const eggsClosing = eggsOpening + eggsCollected - eggsWasted - eggsSold;

    // Feed
    const feedOpening = feedTransactions.filter(t => isBeforeRange(t.date)).reduce((acc, t) => 
      t.type === 'Purchase' ? acc + t.quantity : acc - t.quantity, 0);
    const feedPurchased = feedTransactions.filter(t => t.type === 'Purchase' && isInRange(t.date)).reduce((acc, t) => acc + t.quantity, 0);
    const feedConsumed = feedTransactions.filter(t => t.type === 'Consume' && isInRange(t.date)).reduce((acc, t) => acc + t.quantity, 0);
    const feedWasted = feedTransactions.filter(t => t.type === 'Waste' && isInRange(t.date)).reduce((acc, t) => acc + t.quantity, 0);
    const feedClosing = feedOpening + feedPurchased - feedConsumed - feedWasted;

    // Cash
    const cashOpening = transactions.filter(t => isBeforeRange(t.date)).reduce((acc, t) => {
        if ([TransactionType.SALE, TransactionType.RECEIPT, TransactionType.DEPOSIT].includes(t.type)) return acc + t.amount;
        if ([TransactionType.EXPENSE, TransactionType.PAYMENT, TransactionType.PURCHASE, TransactionType.WITHDRAWAL].includes(t.type)) return acc - t.amount;
        return acc;
    }, 0);

    const cashIn = transactions.filter(t => isInRange(t.date) && [TransactionType.SALE, TransactionType.RECEIPT, TransactionType.DEPOSIT].includes(t.type)).reduce((acc, t) => acc + t.amount, 0);
    const cashOut = transactions.filter(t => isInRange(t.date) && [TransactionType.EXPENSE, TransactionType.PAYMENT, TransactionType.PURCHASE].includes(t.type)).reduce((acc, t) => acc + t.amount, 0);
    const withdrawals = transactions.filter(t => isInRange(t.date) && t.type === TransactionType.WITHDRAWAL).reduce((acc, t) => acc + t.amount, 0);
    const cashClosing = cashOpening + cashIn - cashOut - withdrawals;

    return {
        eggs: { opening: eggsOpening, collected: eggsCollected, wasted: eggsWasted, sold: eggsSold, closing: eggsClosing },
        feed: { opening: feedOpening, purchased: feedPurchased, consumed: feedConsumed, wasted: feedWasted, closing: feedClosing },
        cash: { opening: cashOpening, in: cashIn, out: cashOut, withdrawn: withdrawals, closing: cashClosing },
        salesRevenue: transactions.filter(t => t.type === TransactionType.SALE && isInRange(t.date)).reduce((acc, t) => acc + t.amount, 0)
    };
  }, [eggCollections, feedTransactions, transactions, dateRange]);

  // --- Graph Data (Last 7 Days) ---
  const graphData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const collected = eggCollections.filter(c => c.date.startsWith(dateStr)).reduce((acc, c) => acc + c.collected, 0);
        const revenue = transactions.filter(t => t.type === TransactionType.SALE && t.date.startsWith(dateStr)).reduce((acc, t) => acc + t.amount, 0);
        
        days.push({ name: d.toLocaleDateString('en-US', {weekday: 'short'}), collected, revenue });
    }
    return days;
  }, [eggCollections, transactions]);

  // --- Actions ---

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`${settings.farmName} - Performance Report`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 30);

    const data = [
        ['Metric', 'Value'],
        ['--- EGGS ---', ''],
        ['Opening Stock', reportData.eggs.opening],
        ['Collected', reportData.eggs.collected],
        ['Wasted', reportData.eggs.wasted],
        ['Sold', reportData.eggs.sold],
        ['Closing Stock', reportData.eggs.closing],
        ['--- FEED ---', ''],
        ['Purchased (kg)', reportData.feed.purchased],
        ['Consumed (kg)', reportData.feed.consumed],
        ['Closing Stock (kg)', reportData.feed.closing],
        ['--- CASH ---', ''],
        ['Opening Cash', `${settings.currency}${reportData.cash.opening}`],
        ['Cash In', `${settings.currency}${reportData.cash.in}`],
        ['Cash Out', `${settings.currency}${reportData.cash.out}`],
        ['Withdrawals', `${settings.currency}${reportData.cash.withdrawn}`],
        ['Closing Cash', `${settings.currency}${reportData.cash.closing}`],
    ];

    autoTable(doc, {
        head: [['Report Item', 'Value']],
        body: data,
        startY: 40,
        theme: 'grid',
    });

    doc.save(`report_${dateRange.start}_${dateRange.end}.pdf`);
  };

  const shareWhatsApp = () => {
    const text = `*${settings.farmName} Report (${dateRange.start} to ${dateRange.end})*%0A%0A` +
        `🥚 *Egg Production*%0AOpening: ${reportData.eggs.opening}%0ACollected: ${reportData.eggs.collected}%0AWasted: ${reportData.eggs.wasted}%0ASold: ${reportData.eggs.sold}%0AClosing Stock: ${reportData.eggs.closing}%0A%0A` +
        `🌾 *Feed & Nutrition*%0APurchased: ${reportData.feed.purchased}kg%0AConsumed: ${reportData.feed.consumed}kg%0AInventory: ${reportData.feed.closing}kg%0A%0A` +
        `💵 *Cash Flow*%0AOpening Cash: ${settings.currency}${reportData.cash.opening}%0ACash In: ${settings.currency}${reportData.cash.in}%0ACash Out: ${settings.currency}${reportData.cash.out}%0AWithdrawals: ${settings.currency}${reportData.cash.withdrawn}%0AClosing Cash: ${settings.currency}${reportData.cash.closing}`;
    
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
      <Card className="flex flex-col md:flex-row gap-4 items-end bg-gradient-to-r from-blue-900/40 to-purple-900/40">
        <Input 
          type="date" 
          label="From" 
          value={dateRange.start} 
          onChange={e => setDateRange({...dateRange, start: e.target.value})} 
        />
        <Input 
          type="date" 
          label="To" 
          value={dateRange.end} 
          onChange={e => setDateRange({...dateRange, end: e.target.value})} 
        />
        <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={generatePDF} className="flex-1 flex items-center justify-center gap-2">
                <FileText size={18} /> PDF
            </Button>
            <Button onClick={shareWhatsApp} className="flex-1 bg-green-600 hover:bg-green-500 flex items-center justify-center gap-2">
                <Share2 size={18} /> WhatsApp
            </Button>
        </div>
      </Card>

      <Card title="Last 7 Days Performance" className="h-80">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={graphData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)'}} />
                <YAxis yAxisId="left" orientation="left" stroke="rgba(255,255,255,0.5)" />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="collected" name="Eggs Collected" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};
