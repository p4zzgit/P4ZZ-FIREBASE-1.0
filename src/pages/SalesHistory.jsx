
import React from 'react';
import { Sale, Table } from '../types';
import { deleteSale, getTables, saveTables } from '../services/storage';

interface SalesHistoryProps {
  sales: Sale[];
  onRefresh?: () => void;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, onRefresh }) => {
  const reversedSales = [...sales].reverse();

  const handleRemoveSale = async (sale: Sale) => {
    if (window.confirm("Deseja realmente remover esta venda? O estoque será estornado.")) {
      await deleteSale(sale.id);
      if (onRefresh) onRefresh();
    }
  };

  const handleReopenTable = async (sale: Sale) => {
    if (!sale.tableNumber) return;
    const confirm = window.confirm(`Reabrir Mesa ${sale.tableNumber}? Os itens voltarão para a mesa.`);
    if (confirm) {
      const tables = await getTables();
      const tableIdx = tables.findIndex(t => t.id === sale.tableNumber);
      if (tableIdx !== -1) {
        if (tables[tableIdx].status === 'Ocupada') {
          alert('Mesa já está em uso atualmente.');
          return;
        }
        await deleteSale(sale.id);
        tables[tableIdx] = { ...tables[tableIdx], status: 'Ocupada', items: sale.items, startTime: sale.date };
        await saveTables(tables);
        if (onRefresh) onRefresh();
      }
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* DESKTOP TABLE VIEW */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Logs de Transações</h3>
            <span className="text-[9px] font-bold text-slate-400 uppercase">{sales.length} Registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Data / Hora</th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Origem e Itens</th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Pagto</th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest text-right">Valor</th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest text-right no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reversedSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition group">
                  <td className="px-6 py-4">
                    <div className="text-[10px] font-black dark:text-white uppercase">{new Date(sale.date).toLocaleDateString('pt-BR')}</div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      {sale.tableNumber ? <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Mesa {sale.tableNumber}</span> : sale.isDelivery ? <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Entrega #{sale.deliveryNumber}</span> : <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">Balcão</span>}
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-xs font-bold uppercase">{sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-black uppercase">{sale.paymentMethod}</span></td>
                  <td className="px-6 py-4 text-right font-black italic text-sm dark:text-white">R$ {sale.total.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right no-print">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {sale.tableNumber && <button onClick={() => handleReopenTable(sale)} className="text-[8px] font-black text-indigo-500 uppercase bg-indigo-50 px-2 py-1 rounded-lg">Reabrir</button>}
                      <button onClick={() => handleRemoveSale(sale)} className="text-[8px] font-black text-rose-500 uppercase bg-rose-50 px-2 py-1 rounded-lg">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE LIST VIEW */}
      <div className="sm:hidden space-y-4">
          {reversedSales.map(sale => (
            <div key={sale.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-[10px] font-black dark:text-white uppercase">{new Date(sale.date).toLocaleDateString('pt-BR')} às {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="flex items-center gap-2 mt-2">
                           {sale.tableNumber ? <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[8px] font-black uppercase italic">Mesa {sale.tableNumber}</span> : sale.isDelivery ? <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black uppercase italic">Entrega</span> : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase italic">Venda Balcão</span>}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-black text-indigo-600 italic">R$ {sale.total.toFixed(2)}</div>
                        <span className="text-[8px] font-black text-slate-400 uppercase">{sale.paymentMethod}</span>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <p className="text-[9px] font-bold text-slate-500 uppercase line-clamp-2">{sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                    {sale.tableNumber ? (
                      <button onClick={() => handleReopenTable(sale)} className="py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black uppercase text-[9px] tracking-widest min-h-[44px]">Reabrir</button>
                    ) : (
                      <div className="bg-transparent" />
                    )}
                    <button onClick={() => handleRemoveSale(sale)} className="py-3 bg-rose-50 text-rose-600 rounded-xl font-black uppercase text-[9px] tracking-widest min-h-[44px]">Excluir</button>
                </div>
            </div>
          ))}
      </div>

      {reversedSales.length === 0 && (
          <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
             <p className="text-[10px] font-black uppercase text-slate-300 italic tracking-[0.3em]">Nenhuma venda localizada</p>
          </div>
      )}
    </div>
  );
};

export default SalesHistory;
