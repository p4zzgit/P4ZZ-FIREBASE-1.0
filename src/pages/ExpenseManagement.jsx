import React, { useState, useEffect } from 'react';
import { Expense, AppSettings } from '../types';
import { 
  saveExpense, 
  deleteExpense as storageDeleteExpense, 
  getAppSettings, 
  DEFAULT_SETTINGS 
} from '../services/storage';

interface ExpenseManagementProps {
  expenses: Expense[];
  onUpdate: () => void;
}

const ExpenseManagement: React.FC<ExpenseManagementProps> = ({ expenses: initialExpenses, onUpdate }) => {
  const [localExpenses, setLocalExpenses] = useState<Expense[]>(initialExpenses);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    description: '', amount: 0, category: 'Operacional'
  });
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setLocalExpenses(initialExpenses);
    getAppSettings().then(setSettings);
  }, [initialExpenses]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    const newExpense: Expense = {
      id: `exp-${Math.random().toString(36).substr(2, 9)}`,
      description: formData.description.toUpperCase(),
      amount: Number(formData.amount),
      category: formData.category || 'Operacional',
      date: new Date().toISOString()
    };

    await saveExpense(newExpense);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setFormData({ description: '', amount: 0, category: 'Operacional' });
    setIsModalOpen(false);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    await storageDeleteExpense(id);
    setDeletingId(null);
    onUpdate();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 md:pb-0">
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-[9px] uppercase tracking-widest animate-in slide-in-from-top-4">
          Lançamento Realizado
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Saídas de Caixa</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Registre despesas ocasionais para o balanço mensal</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          style={{ backgroundColor: settings.primaryColor }}
          className="w-full md:w-auto text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all"
        >
          + Lançar Despesa
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
              <tr>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Categoria</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {localExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">Sem despesas registradas</td>
                </tr>
              ) : (
                [...localExpenses].reverse().map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                    <td className="px-8 py-4 text-[10px] font-bold text-slate-500">
                      {new Date(exp.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-[11px] font-black uppercase text-slate-900 dark:text-white italic">{exp.description}</span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-slate-500">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 italic">R$ {exp.amount.toFixed(2)}</span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        onClick={() => setDeletingId(exp.id)}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 border border-white/5">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Nova Saída</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Descrição da Despesa</label>
                <input 
                  autoFocus 
                  required 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" 
                  placeholder="Digite a descrição da despesa" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Valor (R$)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    value={formData.amount || ''} 
                    onChange={e => setFormData({...formData, amount: Number(e.target.value)})} 
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-rose-500 text-rose-500" 
                    placeholder="Ex: 150.00" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Categoria</label>
                  <select 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})} 
                    className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-[10px] uppercase outline-none"
                  >
                    <option value="Operacional">Operacional</option>
                    <option value="Fixa">Fixa</option>
                    <option value="Mercadoria">Mercadoria</option>
                    <option value="Salário">Salário</option>
                    <option value="Imposto">Imposto</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
              <button 
                type="submit" 
                style={{ backgroundColor: settings.primaryColor }}
                className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all mt-4"
              >
                Confirmar Saída
              </button>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-6 shadow-2xl text-center border border-white/10 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/30 rounded-3xl flex items-center justify-center mb-4 mx-auto shadow-lg text-rose-500 border border-rose-100">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic tracking-tighter mb-2">Excluir Lançamento?</h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase mb-6 leading-relaxed">Esta ação irá remover o registro permanentemente do fluxo de caixa.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeletingId(null)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
              <button onClick={() => handleDelete(deletingId)} className="py-3 bg-rose-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all active:scale-95">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManagement;