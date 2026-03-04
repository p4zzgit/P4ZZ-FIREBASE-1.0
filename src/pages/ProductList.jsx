import React, { useState, useEffect, useMemo } from 'react';
import { saveProducts, getCategories, getProducts } from '../services/storage';
import { LOW_STOCK_LIMIT } from '@/constants';

export const ProductList = ({ products: initialProducts, onUpdate, initialTab = 'products' }) => {
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCostField, setShowCostField] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [formData, setFormData] = useState({
    name: '', categoryId: '', category: '', price: 0, cost: 0, stock: 0, description: '', barcode: ''
  });

  useEffect(() => {
    if (isModalOpen) {
      getCategories().then(setCategories);
    }
  }, [isModalOpen]);

  const openModal = (product) => {
    setErrors({});
    if (product) {
      setEditingProduct(product);
      setFormData(product);
      setShowCostField(!!product.cost && product.cost > 0);
    } else {
      setEditingProduct(null);
      setFormData({ 
        name: '', 
        categoryId: categories[0]?.id || '', 
        category: categories[0]?.name || '', 
        price: 0, 
        cost: 0, 
        stock: 0, 
        description: '', 
        barcode: '' 
      });
      setShowCostField(false);
    }
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = "O nome do item é obrigatório.";
    if (!formData.categoryId) newErrors.categoryId = "Selecione uma categoria.";
    if (!formData.price || formData.price <= 0) newErrors.price = "Informe um preço de venda válido.";
    if (formData.stock === undefined || formData.stock < 0) newErrors.stock = "Estoque não pode ser negativo.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    const selectedCat = categories.find(c => c.id === formData.categoryId);
    const finalData = {
      ...formData,
      price: Number(formData.price) || 0,
      cost: showCostField ? (Number(formData.cost) || 0) : 0,
      stock: Number(formData.stock) || 0,
      category: selectedCat ? selectedCat.name : (formData.category || 'GERAL'),
      barcode: formData.barcode?.trim() || ''
    };

    const currentProducts = await getProducts();
    let newProducts = [...currentProducts];
    if (editingProduct) {
      newProducts = newProducts.map(p => p.id === editingProduct.id ? { ...editingProduct, ...finalData } : p);
    } else {
      const newProd = { ...finalData, id: Math.random().toString(36).substr(2, 9) };
      newProducts.push(newProd);
    }
    await saveProducts(newProducts);
    onUpdate();
    setIsModalOpen(false);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const currentProducts = await getProducts();
    const updatedList = currentProducts.filter(p => p.id !== confirmDelete.id);
    await saveProducts(updatedList);
    onUpdate();
    setConfirmDelete(null);
  };

  // Lógica de Agrupamento e Filtragem por Tab
  const { regularGroups, allItemsFiltered } = useMemo(() => {
    const baseFiltered = (initialProducts || []).filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.includes(searchTerm))
    );

    // Filtro dinâmico baseado na tab ativa
    const filteredByTab = baseFiltered.filter(p => {
      if (activeTab === 'low-stock') return p.stock < LOW_STOCK_LIMIT;
      return p.stock >= LOW_STOCK_LIMIT;
    });

    const sorted = [...filteredByTab].sort((a, b) => a.name.localeCompare(b.name));

    const groups = {};
    filteredByTab.forEach(p => {
      const catName = (p.category || 'GERAL').toUpperCase();
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    });

    return { regularGroups: groups, allItemsFiltered: sorted };
  }, [initialProducts, searchTerm, activeTab]);

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* TABS INTERNAS */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl w-fit no-print">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-3 md:py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${activeTab === 'products' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Produtos
        </button>
        <button
          onClick={() => setActiveTab('low-stock')}
          className={`px-6 py-3 md:py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 ${activeTab === 'low-stock' ? 'bg-white dark:bg-slate-800 text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Estoque Baixo
          {initialProducts.filter(p => p.stock < LOW_STOCK_LIMIT).length > 0 && (
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
          )}
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4">
        <div className="relative flex-1">
           <input 
            type="text" 
            placeholder="PROCURAR ITEM..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 md:pl-12 pr-4 py-3.5 md:py-4 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-black text-[10px] md:text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner min-h-[48px] md:min-h-[52px]"
          />
          <svg className="w-4 h-4 md:w-5 md:h-5 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest min-h-[48px] md:min-h-[52px] active:scale-95 transition-all"
        >
          + Novo Produto
        </button>
      </div>

      {/* LISTA COMPLETA POR CATEGORIA (DESKTOP) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b">
              <tr>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Produto / EAN</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Estoque</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Preço</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {Object.entries(regularGroups).map(([cat, items]) => (
                <React.Fragment key={cat}>
                  <tr className="bg-slate-50 dark:bg-slate-800/40">
                    <td colSpan={4} className="px-8 py-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest italic border-y dark:border-slate-800">📁 {cat}</td>
                  </tr>
                  {items.map(product => (
                    <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition group">
                      <td className="px-8 py-4">
                        <div className="font-black text-slate-900 dark:text-white text-[11px] uppercase italic tracking-tighter">{product.name}</div>
                        {product.barcode && <div className="text-[8px] text-indigo-500 font-bold uppercase mt-1">EAN: {product.barcode}</div>}
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${product.stock < 10 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {product.stock} un.
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right font-black italic text-slate-900 dark:text-white text-sm">R$ {product.price.toFixed(2)}</td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => openModal(product)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>
                            <button onClick={() => setConfirmDelete({ id: product.id, name: product.name })} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW PARA MOBILE (CARDS) */}
      <div className="md:hidden space-y-4">
        {allItemsFiltered.map(product => (
            <div key={product.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4 animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                        <h4 className="font-black text-xs uppercase italic text-slate-900 dark:text-white leading-tight">{product.name}</h4>
                        <p className="text-[8px] font-black text-indigo-500 uppercase mt-1">EAN: {product.barcode || 'N/A'}</p>
                    </div>
                    <span className="text-sm font-black text-indigo-600 italic">R$ {product.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-y border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estoque</span>
                        <span className={`text-[10px] font-black uppercase ${product.stock < 10 ? 'text-rose-600' : 'text-emerald-600'}`}>{product.stock} Unidades</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Categoria</span>
                        <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">{product.category}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => openModal(product)} className="py-3 bg-slate-50 dark:bg-slate-800 text-indigo-600 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-sm flex items-center justify-center gap-2 min-h-[44px]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg> Editar
                    </button>
                    <button onClick={() => setConfirmDelete({ id: product.id, name: product.name })} className="py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-sm flex items-center justify-center gap-2 min-h-[44px]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg> Excluir
                    </button>
                </div>
            </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 md:p-8 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 sticky top-0 z-10">
              <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase italic tracking-tighter leading-none">
                {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-rose-500 rounded-xl bg-white dark:bg-slate-800 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 md:p-10 space-y-10">
                {/* BLOCO 1: IDENTIFICAÇÃO */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Identificação Básica</h4>
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[9px] font-black uppercase ml-2 ${errors.name ? 'text-rose-500' : 'text-slate-400'}`}>Nome do Item *</label>
                    <input 
                      autoFocus
                      value={formData.name}
                      onChange={e => handleInputChange('name', e.target.value.toUpperCase())}
                      className={`w-full px-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-2 outline-none transition-all font-bold text-sm min-h-[56px] shadow-inner ${errors.name ? 'border-rose-500' : 'border-transparent focus:border-indigo-500'}`}
                      placeholder="Digite o nome completo do produto"
                    />
                    {errors.name && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">{errors.name}</p>}
                  </div>
                </div>

                {/* BLOCO 2: LOGÍSTICA */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Dados de Logística</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Código de Barras (EAN)</label>
                          <div className="relative">
                            <input value={formData.barcode} onChange={e => handleInputChange('barcode', e.target.value)} className="w-full pl-12 pr-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner min-h-[56px]" placeholder="Bipe o código ou digite" />
                            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeWidth={2}/></svg>
                          </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ml-2 ${errors.categoryId ? 'text-rose-500' : 'text-slate-400'}`}>Categoria *</label>
                        <select 
                          value={formData.categoryId}
                          onChange={e => handleInputChange('categoryId', e.target.value)}
                          className={`w-full px-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-2 outline-none transition-all font-black uppercase text-xs min-h-[56px] shadow-inner cursor-pointer ${errors.categoryId ? 'border-rose-500' : 'border-transparent focus:border-indigo-500'}`}
                        >
                          <option value="" disabled>SELECIONE A CATEGORIA...</option>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                      </div>
                  </div>
                </div>

                {/* BLOCO 3: FINANCEIRO E ESTOQUE */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Valores e Quantidades</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ml-2 ${errors.price ? 'text-rose-500' : 'text-slate-400'}`}>Preço de Venda *</label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-500">R$</span>
                            <input type="number" step="0.01" value={formData.price || ''} onChange={e => handleInputChange('price', Number(e.target.value))} className={`w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-black text-xl text-indigo-600 outline-none border-2 transition-all min-h-[56px] shadow-inner ${errors.price ? 'border-rose-500' : 'border-transparent focus:border-indigo-500'}`} placeholder="Valor de venda" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ml-2 ${errors.stock ? 'text-rose-500' : 'text-slate-400'}`}>Estoque Atual *</label>
                        <input type="number" value={formData.stock || ''} onChange={e => handleInputChange('stock', Number(e.target.value))} className={`w-full px-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-black text-xl dark:text-white outline-none border-2 transition-all min-h-[56px] shadow-inner ${errors.stock ? 'border-rose-500' : 'border-transparent focus:border-indigo-500'}`} placeholder="Quantidade disponível" />
                      </div>
                  </div>
                </div>

                {/* BLOCO 4: PREÇO DE CUSTO (NOVA FUNCIONALIDADE) */}
                <div className="space-y-4 pt-2">
                  <label className="flex items-center gap-3 group cursor-pointer w-fit">
                    <div className="relative flex items-center justify-center">
                       <input 
                        type="checkbox" 
                        checked={showCostField}
                        onChange={e => setShowCostField(e.target.checked)}
                        className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-slate-200 bg-white dark:bg-slate-800 transition-all checked:bg-indigo-600 checked:border-indigo-600"
                       />
                       <svg className="pointer-events-none absolute h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-indigo-500 transition-colors tracking-widest">Informar preço de custo</span>
                  </label>

                  {showCostField && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-emerald-600 ml-2 italic tracking-widest">Preço de Custo (Opcional)</label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-emerald-500">R$</span>
                            <input type="number" step="0.01" value={formData.cost || ''} onChange={e => handleInputChange('cost', Number(e.target.value))} className="w-full pl-14 pr-6 py-5 rounded-2xl bg-emerald-50/30 dark:bg-emerald-900/10 font-black text-xl text-emerald-600 outline-none border-2 border-emerald-100 dark:border-emerald-900/30 focus:border-emerald-500 min-h-[56px] shadow-inner" placeholder="Ex: 150.00" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800 flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-5 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 dark:hover:bg-slate-900 rounded-2xl transition min-h-[52px]">Cancelar</button>
              <button 
                onClick={handleSave} 
                className="bg-slate-950 dark:bg-white dark:text-slate-950 text-white px-16 py-5 rounded-2xl font-black shadow-2xl uppercase text-[11px] tracking-[0.2em] min-h-[52px] active:scale-95 transition-all hover:scale-[1.02] hover:brightness-110"
              >
                Salvar Produto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO EXCLUIR */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[600] p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-[360px] rounded-[3rem] p-10 shadow-2xl border border-white/10 animate-in zoom-in-95 text-center">
              <div className="w-16 h-16 bg-rose-500 text-white rounded-2xl flex items-center justify-center mb-8 shadow-lg mx-auto">
                 <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter mb-2 leading-none">Excluir Produto?</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase leading-relaxed mb-10">
                Você está prestes a remover <span className="text-rose-500">"{confirmDelete.name}"</span> permanentemente. Esta ação não pode ser desfeita.
              </p>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setConfirmDelete(null)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest min-h-[48px] hover:bg-slate-200">Voltar</button>
                 <button onClick={executeDelete} className="py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg min-h-[48px] active:scale-95 transition-all hover:bg-rose-700">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
