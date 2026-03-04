
import React, { useState, useMemo, useEffect } from 'react';
import { getSalesInsights } from '../services/geminiService';
import { getCurrentUser, getConsumptions } from '../services/storage';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const Dashboard = ({ products, sales, expenses }) => {
  const user = useMemo(() => getCurrentUser(), []);
  const isEmployee = user?.role === 'employee';
  const isCashierOpen = user?.cashierStatus === 'Aberto';
  
  const [insights, setInsights] = useState('');
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [period, setPeriod] = useState('today');
  const [myConsumptions, setMyConsumptions] = useState([]);

  useEffect(() => {
    if (isEmployee && user) {
        getConsumptions().then(all => {
            const filtered = all.filter(c => c.userId === user.id);
            setMyConsumptions(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        });
    }
  }, [isEmployee, user]);

  const handleFetchInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const data = await getSalesInsights(sales, products);
      setInsights(data);
    } catch (err) {
      setInsights("Erro ao conectar com a IA.");
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const filterByPeriod = (item) => {
    const itemDate = new Date(item.date);
    const itemDayStr = itemDate.toLocaleDateString('en-CA');
    const todayStr = new Date().toLocaleDateString('en-CA');

    if (period === 'today') return itemDayStr === todayStr;
    if (period === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return itemDayStr === yesterday.toLocaleDateString('en-CA');
    }
    if (period === '7d') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return itemDate >= weekAgo;
    }
    return true;
  };

  const filteredSales = sales.filter(filterByPeriod);
  const filteredExpenses = expenses.filter(filterByPeriod);
  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const lowStock = products.filter(p => p.stock < 5).length;

  const chartData = useMemo(() => {
    if (period === 'today' || period === 'yesterday') {
      const targetDate = new Date();
      if (period === 'yesterday') targetDate.setDate(targetDate.getDate() - 1);
      const targetStr = targetDate.toLocaleDateString('en-CA');

      return Array.from({ length: 24 }, (_, i) => {
        const hourTotal = sales
          .filter(s => {
            const sDate = new Date(s.date);
            return sDate.toLocaleDateString('en-CA') === targetStr && sDate.getHours() === i;
          })
          .reduce((acc, s) => acc + s.total, 0);
        return { name: `${i}h`, vendas: hourTotal };
      });
    }

    if (period === '7d') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toLocaleDateString('en-CA');
        const daySales = sales.filter(s => new Date(s.date).toLocaleDateString('en-CA') === dateStr);
        return {
          name: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
          vendas: daySales.reduce((acc, s) => acc + s.total, 0)
        };
      });
    }
    return [];
  }, [sales, period]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {isEmployee ? (
        <div className="space-y-6">
           <div className="bg-[var(--card-bg)] p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl text-slate-900 dark:text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 border border-[var(--card-border)]">
              <div className="relative z-10 text-center md:text-left">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 dark:text-indigo-400 mb-2">Interface Operacional</h3>
                 <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter truncate max-w-xs md:max-w-none">Olá, {user?.name.split(' ')[0]}</h2>
                 {/* Status de Caixa removido conforme solicitado */}
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                 <div className="flex-1 md:flex-none bg-slate-50 dark:bg-white/10 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 backdrop-blur-sm text-center">
                    <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300 mb-1">Seu Desempenho</p>
                    <p className="text-2xl font-black italic tracking-tighter text-emerald-600 dark:text-emerald-400">R$ {filteredSales.filter(s => s.userId === user?.id).reduce((acc, s) => acc + s.total, 0).toFixed(2)}</p>
                 </div>
              </div>
           </div>

           <div className="bg-[var(--card-bg)] rounded-[2.5rem] shadow-xl border border-[var(--card-border)] overflow-hidden">
              <div className="p-6 md:p-8 border-b border-[var(--card-border)] bg-slate-50 dark:bg-slate-950">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Meus Gastos Internos</h4>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left min-w-[600px] md:min-w-full">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b">
                        <tr>
                            <th className="px-4 md:px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                            <th className="px-4 md:px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Data e Hora</th>
                            <th className="px-4 md:px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Qtd</th>
                            <th className="px-4 md:px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {myConsumptions.length === 0 ? (
                            <tr><td colSpan={4} className="py-20 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">Nenhum gasto registrado</td></tr>
                        ) : (
                            myConsumptions.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                    <td className="px-4 md:px-10 py-5">
                                        <p className="text-[11px] md:text-xs font-black uppercase text-slate-900 dark:text-white italic">{c.productName}</p>
                                    </td>
                                    <td className="px-4 md:px-10 py-5 text-center">
                                        <p className="text-[9px] md:text-[10px] font-bold text-slate-700 dark:text-slate-300">{new Date(c.date).toLocaleDateString()}</p>
                                        <p className="text-[8px] font-black text-indigo-500 uppercase">{new Date(c.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                    </td>
                                    <td className="px-4 md:px-10 py-5 text-center"><span className="text-[10px] font-black text-slate-500">{c.quantity}</span></td>
                                    <td className="px-4 md:px-10 py-5 text-right font-black italic text-emerald-600 text-[11px] md:text-sm">R$ {c.totalPrice.toFixed(2)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Vendas', val: `R$ ${totalRevenue.toFixed(2)}`, color: 'bg-emerald-600' },
              { label: 'Custos', val: `R$ ${totalExpenses.toFixed(2)}`, color: 'bg-rose-500' },
              { label: 'Saldo', val: `R$ ${totalProfit.toFixed(2)}`, color: 'bg-indigo-600 dark:bg-indigo-900/40' },
              { label: 'Estoque', val: lowStock, color: 'bg-amber-500' }
            ].map((stat, i) => (
              <div key={i} className={`${stat.color} p-4 md:p-6 rounded-[2rem] shadow-lg text-white border border-white/10`}>
                <p className="text-[7px] md:text-[8px] font-black uppercase opacity-60 tracking-widest leading-none mb-1 truncate">{stat.label}</p>
                <h4 className="text-sm md:text-xl font-black italic tracking-tighter leading-none">{stat.val}</h4>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[var(--card-bg)] p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-[var(--card-border)] flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest italic text-slate-800 dark:text-white">Fluxo Financeiro</h3>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-full sm:w-auto overflow-x-auto whitespace-nowrap no-print scrollbar-hide">
                  {['today', '7d', 'all'].map(p => (
                    <button key={p} onClick={() => setPeriod(p)} className={`flex-1 sm:flex-none px-5 py-3 md:py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 ${period === p ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500'}`}>
                      {p === '7d' ? '7 Dias' : p === 'today' ? 'Hoje' : 'Tudo'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64 w-full flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                    <YAxis hide />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 800}} />
                    <Bar dataKey="vendas" fill="var(--primary-color)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] p-8 rounded-[3rem] shadow-2xl flex flex-col justify-between text-[var(--workspace-text)] min-h-[300px] border border-[var(--card-border)]">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-400 mb-4">Insights de Inteligência</h3>
                <div className="bg-slate-50 dark:bg-white/5 rounded-[2rem] p-6 border border-slate-100 dark:border-white/10">
                   {isLoadingInsights ? (
                     <div className="flex items-center gap-3 animate-pulse">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Processando Auditoria...</span>
                     </div>
                   ) : insights ? (
                     <p className="text-xs font-bold leading-relaxed italic text-slate-600 dark:text-slate-300">"{insights}"</p>
                   ) : (
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center py-4">Toque no botão para gerar uma análise estratégica.</p>
                   )}
                </div>
              </div>
              <button onClick={handleFetchInsights} className="w-full mt-6 bg-slate-900 dark:bg-white text-white dark:text-slate-950 py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all min-h-[56px]">
                GERAR INSIGHT IA
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
