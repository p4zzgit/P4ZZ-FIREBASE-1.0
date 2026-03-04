import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { getCategories, saveCategories } from '../services/storage';

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catIdRef, setCatIdRef] = useState('');
  
  // Estado para o modal de confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, name: string } | null>(null);

  // Fix: Awaited asynchronous fetching of categories
  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const openModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCatName(cat.name);
      setCatIdRef(cat.idRef || '');
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatIdRef('');
    }
    setIsModalOpen(true);
  };

  /* Fix: Changed handleSave to be async to handle awaited getCategories() */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    // Fix: Awaited getCategories()
    const currentCategories = await getCategories();
    let updated: Category[];

    if (editingCategory) {
      updated = currentCategories.map(c => 
        c.id === editingCategory.id 
          ? { ...c, name: catName.toUpperCase(), idRef: catIdRef.toUpperCase() } 
          : c
      );
    } else {
      const newCat: Category = {
        id: 'cat-' + Math.random().toString(36).substr(2, 5),
        name: catName.toUpperCase(),
        idRef: catIdRef.toUpperCase()
      };
      updated = [...currentCategories, newCat];
    }

    await saveCategories(updated);
    setCategories(updated);
    setIsModalOpen(false);
  };

  /* Fix: executeDelete is already async, awaited getCategories() */
  const executeDelete = async () => {
    if (!confirmDelete) return;
    
    // Fix: Awaited getCategories()
    const currentCategories = await getCategories();
    const updated = currentCategories.filter(c => c.id !== confirmDelete.id);
    
    await saveCategories(updated);
    setCategories(updated);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic leading-none">Organização do Catálogo</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1.5">{categories.length} categorias cadastradas.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black shadow-lg hover:bg-indigo-700 transition active:scale-95 text-[9px] uppercase tracking-widest"
        >
          + Nova Categoria
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">ID REF</th>
              <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nome da Categoria</th>
              <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Gerenciar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {categories.map(cat => (
              <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition group">
                <td className="px-5 py-2">
                  <span className="text-[9px] font-mono text-indigo-500 font-black uppercase">{cat.idRef || '---'}</span>
                </td>
                <td className="px-5 py-2">
                  <div className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight italic text-[11px]">{cat.name}</div>
                </td>
                <td className="px-5 py-2 text-right">
                  <div className="flex justify-end gap-2 opacity-100 lg:opacity-40 lg:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openModal(cat)}
                      className="text-slate-500 hover:text-indigo-600 transition p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button 
                      onClick={() => setConfirmDelete({ id: cat.id, name: cat.name })}
                      className="text-slate-500 hover:text-rose-600 transition p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm"
                      title="Apagar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">Nenhuma categoria encontrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE EDIÇÃO/CRIAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-rose-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Nome da Categoria</label>
                  <input 
                    required autoFocus value={catName} onChange={e => setCatName(e.target.value)}
                    placeholder="EX: BEBIDAS, LANCHES..."
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 outline-none font-black text-lg uppercase focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">ID REF (Opcional)</label>
                  <input 
                    value={catIdRef} onChange={e => setCatIdRef(e.target.value)}
                    placeholder="EX: REF01"
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 outline-none font-black text-sm uppercase focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full bg-slate-950 dark:bg-white dark:text-slate-950 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Salvar Categoria
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-8 shadow-2xl border border-white/10 animate-in zoom-in-95">
              <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter mb-1">Apagar Categoria?</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase leading-relaxed mb-6">
                Remover "{confirmDelete.name}" permanentemente?
              </p>
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => setConfirmDelete(null)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                 <button onClick={executeDelete} className="py-3 bg-rose-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-rose-700 active:scale-95 transition-all">Excluir</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;