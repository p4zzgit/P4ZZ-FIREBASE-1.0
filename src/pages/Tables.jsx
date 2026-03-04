import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  getTables, saveTables, saveSale, getCategories, 
  getAppSettings, getCurrentUser, DEFAULT_SETTINGS,
  notifyDataChanged
} from '../services/storage';

const Tables = ({ products, onBack, onUpdate }) => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [printMode, setPrintMode] = useState('customer');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState('');

  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualObs, setManualObs] = useState('');

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amountReceived, setAmountReceived] = useState(''); // Vazio por padrão
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showSafetyLock, setShowSafetyLock] = useState(false);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [selectedTransferTableId, setSelectedTransferTableId] = useState(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState([]);
  
  // REFERÊNCIAS PARA FOCO
  const tableSearchInputRef = useRef(null);
  const cashInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [t, s, c] = await Promise.all([
      getTables(),
      getAppSettings(),
      getCategories()
    ]);
    setTables(t);
    setSettings(s);
    setCategories(c);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Foco automático no campo de busca ao selecionar uma mesa
  useEffect(() => {
    if (selectedTable && tableSearchInputRef.current) {
        setTimeout(() => tableSearchInputRef.current?.focus(), 250);
    }
  }, [selectedTable]);

  // Focar no campo de dinheiro quando abrir o fluxo de caixa
  useEffect(() => {
    if (showCashFlow && cashInputRef.current) {
        setTimeout(() => cashInputRef.current?.focus(), 100);
    }
  }, [showCashFlow]);

  const resetPaymentFlow = () => {
    setIsCheckoutOpen(false);
    setSelectedMethod(null);
    setAmountReceived('');
    setShowCashFlow(false);
    setIsFinalizing(false);
    setShowSafetyLock(false);
    setShowPrintConfirm(false);
  };

  const toggleTable = (table) => {
    setSelectedTable(table);
    setTempLabel(table.label);
    setSelectedCategoryId('all');
    setManualName(''); setManualPrice(''); setManualObs('');
    setIsEditingLabel(false);
    resetPaymentFlow();
  };

  const handlePrintAction = (mode) => { 
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setShowPrintConfirm(false);
    }, 100);
  };

  const initiatePayment = (method) => {
    setSelectedMethod(method);
    if (method === 'Dinheiro') {
      setAmountReceived(''); 
      setShowCashFlow(true);
    }
    else setShowSafetyLock(true);
  };

  const handleUpdateTableData = useCallback(async (updates) => {
    if (!selectedTable) return;
    const updatedTable = { ...selectedTable, ...updates };
    
    if (updatedTable.items.length > 0 && updatedTable.status === 'Livre') {
        updatedTable.status = 'Em andamento';
        updatedTable.startTime = updatedTable.startTime || new Date().toISOString();
    }
    if (updatedTable.items.length === 0 && updatedTable.status !== 'Livre') {
        updatedTable.status = 'Livre';
        updatedTable.startTime = undefined;
    }

    const currentTables = await getTables();
    const updatedTablesList = currentTables.map(t => t.id === selectedTable.id ? updatedTable : t);
    
    await saveTables(updatedTablesList);
    setTables(updatedTablesList);
    setSelectedTable(updatedTable);
  }, [selectedTable]);

  const handleSaveLabel = async () => {
    if (!tempLabel.trim()) { setIsEditingLabel(false); return; }
    await handleUpdateTableData({ label: tempLabel.toUpperCase() });
    setIsEditingLabel(false);
  };

  const handleTransferTable = async () => {
    if (!selectedTable || selectedTransferTableId === null) return;
    
    const currentTables = await getTables();
    const targetTable = currentTables.find(t => t.id === selectedTransferTableId);
    
    if (!targetTable) return;

    // SEGURANÇA EXTRA: Validar se a mesa de destino está realmente livre
    if (targetTable.status !== 'Livre' || targetTable.items.length > 0) {
      alert("Não é possível transferir. A mesa selecionada já está ocupada.");
      setIsTransferOpen(false);
      setSelectedTransferTableId(null);
      return;
    }

    const newItems = [...selectedTable.items]; // Não faz merge, apenas move
    
    const updatedTablesList = currentTables.map(t => {
      if (t.id === selectedTransferTableId) {
        return {
          ...t,
          status: 'Ocupada',
          items: newItems,
          startTime: selectedTable.startTime || new Date().toISOString(),
          notes: selectedTable.notes || ''
        };
      }
      if (t.id === selectedTable.id) {
        return {
          ...t,
          status: 'Livre',
          items: [],
          startTime: undefined,
          notes: ''
        };
      }
      return t;
    });

    await saveTables(updatedTablesList);
    setTables(updatedTablesList);
    notifyDataChanged();
    
    const newSelectedTable = updatedTablesList.find(t => t.id === selectedTransferTableId);
    if (newSelectedTable) {
        setSelectedTable(newSelectedTable);
        setTempLabel(newSelectedTable.label);
    }
    
    setIsTransferOpen(false);
    setSelectedTransferTableId(null);
  };

  const addToTable = (product) => {
    if (!selectedTable) return;
    if (product.stock <= 0) {
      alert("Estoque insuficiente para este item.");
      return;
    }
    const existing = selectedTable.items.find(i => i.productId === product.id && !i.observation);
    let newItems;
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert("Estoque insuficiente para este item.");
        return;
      }
      newItems = selectedTable.items.map(i => i === existing ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price } : i);
    } else {
      newItems = [...selectedTable.items, { productId: product.id, productName: product.name, quantity: 1, price: product.price, cost: product.cost || 0, subtotal: product.price }];
    }
    handleUpdateTableData({ items: newItems });
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      const barcodeValue = search.trim();
      if (!barcodeValue) return;
      
      const matchedProduct = products.find(p => p.barcode === barcodeValue);
      if (matchedProduct) {
        e.preventDefault();
        addToTable(matchedProduct);
        setSearch(''); // Limpa o campo para a próxima leitura
      }
    }
  };

  const handleFinalFinish = async () => {
    if (!selectedTable || !selectedMethod || isFinalizing) return;
    setIsFinalizing(true);
    
    try {
      const totalVal = selectedTable.items.reduce((acc, i) => acc + i.subtotal, 0);
      const user = getCurrentUser();
      
      const saleToSave = { 
        id: Math.random().toString(36).substring(2, 11), 
        date: new Date().toISOString(), 
        items: [...selectedTable.items], 
        total: totalVal, 
        paymentMethod: selectedMethod, 
        status: 'Concluída', 
        tableNumber: selectedTable.id, 
        tableLabel: selectedTable.label,
        isDelivery: false,
        userId: user?.id || 'unknown',
        userName: user?.name || 'Sistema'
      };
      
      setPrintMode('customer');
      const saved = await saveSale(saleToSave);
      
      if (saved) {
        if (settings.autoPrintOnPayment) {
          window.print();
        }
        const currentTables = await getTables();
        const updatedTables = currentTables.map(t => t.id === selectedTable.id ? { ...t, status: 'Livre', items: [], startTime: undefined, notes: '' } : t);
        await saveTables(updatedTables); 
        setTables(updatedTables); 
        setSelectedTable(null);
        if (onUpdate) onUpdate();
        resetPaymentFlow();
      }
    } catch (e) {
      console.error(e);
      alert("Falha ao encerrar conta.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const total = selectedTable ? selectedTable.items.reduce((acc, i) => acc + i.subtotal, 0) : 0;
  const changeValue = Number(amountReceived) > total ? Number(amountReceived) - total : 0;
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                         (p.barcode && p.barcode.includes(search));
    const matchesCategory = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  const addManualItem = async () => {
    if (!selectedTable || !manualName || !manualPrice) return;
    const price = Number(manualPrice);
    if (isNaN(price)) return;
    const newItem = {
      productId: `manual-${Date.now()}`,
      productName: manualName.toUpperCase(),
      quantity: 1,
      price: price,
      cost: 0,
      subtotal: price,
      observation: manualObs.toUpperCase()
    };
    await handleUpdateTableData({ items: [...selectedTable.items, newItem] });
    setManualName(''); setManualPrice(''); setManualObs('');
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 pb-24 md:pb-0 overflow-x-hidden ${printMode === 'kitchen' ? 'print-mode-kitchen' : 'print-mode-customer'}`}>
      
      {/* IMPRESSÃO TÉRMICA - OCULTA */}
      <div className="print-only thermal-receipt mx-auto">
        <div className="customer-header text-center mb-4">
          <h2 className="text-xl font-bold uppercase">{settings.systemName}</h2>
          <hr />
          <p className="text-lg font-black uppercase italic">Mesa: {selectedTable?.label}</p>
          <p className="text-[9px]">{new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div className="kitchen-only text-center mb-4">
          <h2 className="text-xl font-black uppercase">COMANDA - {selectedTable?.label}</h2>
          <hr />
        </div>
        <table className="w-full text-[11px]">
          <thead><tr className="border-b border-black"><th className="text-left">ITEM</th><th className="text-center">QTD</th><th className="text-right item-price-col">VALOR</th></tr></thead>
          <tbody>
            {selectedTable?.items.map((item, i) => (
              <tr key={i}>
                <td className="py-1 uppercase"><div className="item-name">{item.productName}</div>{item.observation && <div className="text-[8px] italic font-black">OBS: {item.observation}</div>}</td>
                <td className="text-center font-bold">{item.quantity}</td>
                <td className="text-right item-price-col">R$ {item.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="financial-footer mt-4 pt-2 border-t border-black"><div className="flex justify-between font-bold text-lg"><span>TOTAL:</span><span>R$ {total.toFixed(2)}</span></div></div>
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
         <div className="flex flex-col"><h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 italic">Gestão de Mesas</h3><p className="text-[8px] font-bold text-slate-400 uppercase">{tables.length} Terminais Ativos</p></div>
         <div className="flex gap-2">
            <button onClick={async () => { if(tables.length > 0) { const updated = tables.slice(0, -1); await saveTables(updated); setTables(updated); } }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-rose-50 transition-colors">- Remover</button>
            <button onClick={async () => { const newId = Math.max(0, ...tables.map(t=>t.id)) + 1; const newT = { id: newId, label: newId.toString().padStart(2, '0'), status: 'Livre', items: [], notes: '' }; const updated = [...tables, newT]; await saveTables(updated); setTables(updated); }} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-100 transition-colors">+ Adicionar</button>
         </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 no-print pb-20">
        {tables.map(table => {
          const hasItems = table.items.length > 0;
          return (
            <button key={table.id} onClick={() => toggleTable(table)} className={`p-6 rounded-[2.5rem] border-2 transition-all h-36 flex flex-col items-center justify-center relative active:scale-95 group shadow-sm hover:shadow-md ${hasItems ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200'}`}>
              <span className="text-base font-black italic mb-1 uppercase tracking-tighter">{table.label}</span>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${hasItems ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{hasItems ? 'Ocupada' : 'Livre'}</span>
            </button>
          );
        })}
      </div>

      {selectedTable && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[150] no-print animate-in fade-in duration-300 p-4">
          <div className="bg-white dark:bg-slate-900 w-full lg:max-w-5xl h-full lg:h-[85vh] flex flex-col lg:rounded-[3rem] shadow-5xl border border-white/10 relative overflow-hidden">
            
            <div className="w-full p-5 lg:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black italic text-lg shrink-0 shadow-lg" style={{ backgroundColor: settings.primaryColor }}>{selectedTable.id}</div>
                    {isEditingLabel ? (
                      <input autoFocus value={tempLabel} onChange={e => setTempLabel(e.target.value)} onBlur={() => handleSaveLabel()} onKeyDown={e => e.key === 'Enter' && handleSaveLabel()} className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 font-black text-sm uppercase text-indigo-500 outline-none w-40" />
                    ) : (
                      <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                         <h3 className="font-black uppercase text-base text-slate-900 dark:text-white italic tracking-tighter">{selectedTable.label}</h3>
                         <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 group-hover:text-indigo-500 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={3}/></svg>
                         </div>
                      </div>
                    )}
                </div>
                <div className="flex items-center gap-2 lg:gap-3">
                    <button onClick={() => setIsTransferOpen(true)} className="px-4 lg:px-6 py-2.5 lg:py-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:scale-105 transition-all shadow-sm border border-indigo-100 font-black text-[9px] uppercase tracking-widest">Transferir</button>
                    <button onClick={() => { setPrintMode('kitchen'); setShowPrintConfirm(true); }} className="px-4 lg:px-6 py-2.5 lg:py-3 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:scale-105 transition-all shadow-sm border border-blue-100 font-black text-[9px] uppercase tracking-widest">Cozinha</button>
                    <button onClick={() => { setPrintMode('customer'); setShowPrintConfirm(true); }} className="px-4 lg:px-6 py-2.5 lg:py-3 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:scale-105 transition-all shadow-sm border border-emerald-100 font-black text-[9px] uppercase tracking-widest">Recibo</button>
                    <button onClick={() => setSelectedTable(null)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950/20">
                <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 bg-white dark:bg-slate-900 flex gap-2 shrink-0">
                        <input 
                            ref={tableSearchInputRef}
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            onKeyDown={handleSearchKeyDown}
                            placeholder="BUSCAR ITEM OU BIPAR CÓDIGO (F1)..." 
                            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-black text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-500" 
                        />
                        <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-black text-[9px] uppercase border-none">
                            <option value="all">Categorias</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3 content-start custom-scrollbar">
                        {filteredProducts.map(p => (
                            <button key={p.id} onClick={() => addToTable(p)} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-500 transition-all text-left flex flex-col justify-between h-28 group">
                                <span className="text-[10px] font-black uppercase leading-tight line-clamp-2 dark:text-white">{p.name}</span>
                                <div className="flex justify-between items-end">
                                    <span className="text-[11px] font-black italic text-indigo-500">R$ {p.price.toFixed(2)}</span>
                                    <span className={`text-[8px] font-bold ${p.stock < 5 ? 'text-rose-500' : 'text-slate-400'}`}>EST: {p.stock}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-3">
                        <h4 className="text-[10px] font-black uppercase text-indigo-500 ml-1 italic tracking-widest">Item Avulso</h4>
                        <div className="grid grid-cols-1 gap-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input value={manualName} onChange={e => setManualName(e.target.value.toUpperCase())} placeholder="NOME DO ITEM" className="flex-[2] px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-[10px] uppercase outline-none" />
                                <input value={manualPrice} onChange={e => setManualPrice(e.target.value)} type="number" placeholder="VALOR R$" className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-[11px] outline-none" />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input value={manualObs} onChange={e => setManualObs(e.target.value.toUpperCase())} placeholder="OBSERVAÇÃO (EX: BEM PASSADO, SEM GELO)" className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-500" />
                                <button onClick={() => addManualItem()} className="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">Lançar</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-900 shrink-0 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Carrinho da Mesa</span>
                        <button 
                            onClick={() => {
                                if(window.confirm('Tem certeza que deseja remover todos os itens da mesa?')) {
                                    handleUpdateTableData({ items: [] });
                                }
                            }} 
                            className="text-[9px] font-black uppercase text-rose-500 hover:scale-105 transition-all"
                        >
                            Limpar Tudo
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                        {selectedTable.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale py-10">
                                <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeWidth={1.5}/></svg>
                                <p className="font-black text-[10px] uppercase">Mesa Vazia</p>
                            </div>
                        ) : (
                            selectedTable.items.map((item, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex flex-col shadow-sm">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-black uppercase leading-tight block dark:text-white truncate">{item.productName}</span>
                                            {item.observation && <span className="text-[8px] font-bold text-indigo-500 uppercase italic mt-1 block">Obs: {item.observation}</span>}
                                        </div>
                                        <span className="font-black text-[10px] italic shrink-0 dark:text-indigo-400">R$ {item.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg p-0.5 border">
                                            <button onClick={() => { 
                                              const newItems = [...selectedTable.items]; 
                                              if(newItems[idx].quantity > 1) { 
                                                newItems[idx].quantity--; 
                                                newItems[idx].subtotal = newItems[idx].quantity * newItems[idx].price; 
                                                handleUpdateTableData({ items: newItems }); 
                                              } else { 
                                                handleUpdateTableData({ items: selectedTable.items.filter((_, i) => i !== idx) }); 
                                              } 
                                            }} className="w-6 h-6 flex items-center justify-center font-black text-slate-400">-</button>
                                            <span className="px-2 text-[10px] font-black dark:text-white">{item.quantity}</span>
                                            <button onClick={() => { 
                                              const newItems = [...selectedTable.items]; 
                                              const product = products.find(p => p.id === item.productId);
                                              if (product && newItems[idx].quantity >= product.stock) {
                                                alert("Estoque insuficiente para este item.");
                                                return;
                                              }
                                              newItems[idx].quantity++; 
                                              newItems[idx].subtotal = newItems[idx].quantity * newItems[idx].price; 
                                              handleUpdateTableData({ items: newItems }); 
                                            }} className="w-6 h-6 flex items-center justify-center font-black text-slate-400">+</button>
                                        </div>
                                        <button onClick={() => handleUpdateTableData({ items: selectedTable.items.filter((_, i) => i !== idx) })} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-6 bg-slate-950 space-y-4 shrink-0">
                        <div className="flex justify-between items-end"><span className="text-[9px] font-black text-slate-500 uppercase italic">Subtotal</span><span className="text-4xl font-black italic text-white tracking-tighter leading-none">R$ {total.toFixed(2)}</span></div>
                        
                        {!isCheckoutOpen ? (
                          <button disabled={selectedTable.items.length === 0} onClick={() => setIsCheckoutOpen(true)} style={{ backgroundColor: settings.primaryColor }} className="w-full py-5 rounded-2xl text-white font-black uppercase text-[11px] tracking-[0.3em] shadow-xl active:scale-95 transition-all disabled:opacity-30">Fechar Mesa</button>
                        ) : (
                          <div className="space-y-4 animate-in slide-in-from-bottom-2">
                             {!showCashFlow ? (
                               <div className="grid grid-cols-1 gap-2">
                                  <div className="grid grid-cols-2 gap-2">
                                     <button onClick={() => initiatePayment('Pix')} className="bg-white text-slate-900 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest">Pix</button>
                                     <button onClick={() => initiatePayment('Cartão')} className="bg-white text-slate-900 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest">Cartão</button>
                                  </div>
                                  <button onClick={() => initiatePayment('Dinheiro')} className="bg-emerald-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest">Dinheiro</button>
                                  <button onClick={() => setIsCheckoutOpen(false)} className="text-[8px] font-black text-slate-500 uppercase tracking-widest py-2">Voltar</button>
                               </div>
                             ) : (
                               <div className="space-y-4">
                                  <input ref={cashInputRef} type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="w-full py-4 bg-slate-900 text-white border border-slate-700 rounded-2xl font-black text-2xl text-center outline-none focus:border-emerald-500" placeholder="0,00" />
                                  <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/30 flex justify-between items-center"><span className="text-[9px] font-black text-emerald-500 uppercase">Troco:</span><span className="text-xl font-black text-emerald-400 italic">R$ {changeValue.toFixed(2)}</span></div>
                                  <div className="grid grid-cols-2 gap-2">
                                     <button onClick={() => { setShowCashFlow(false); setSelectedMethod(null); }} className="py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-[9px] uppercase">Voltar</button>
                                     <button onClick={() => setShowSafetyLock(true)} disabled={amountReceived === '' || Number(amountReceived) < total} className="py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg">Confirmar</button>
                                  </div>
                               </div>
                             )}
                          </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE CONFIRMAÇÃO COM LARGURA AJUSTADA (450px) */}
      {showPrintConfirm && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
            <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-10 shadow-6xl border border-white/10 text-center animate-in zoom-in-95">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl border ${printMode === 'customer' ? 'bg-emerald-50 border-emerald-400' : 'bg-blue-50 border-blue-400'}`}>
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-slate-900 dark:text-white leading-none">Imprimir Documento?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">Deseja gerar o documento de {printMode === 'customer' ? 'Mesa / Cliente' : 'Cozinha'} agora?</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowPrintConfirm(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                    <button onClick={() => handlePrintAction(printMode)} className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all">Imprimir</button>
                </div>
            </div>
        </div>
      )}

      {showSafetyLock && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
              <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-10 shadow-6xl border border-white/10 text-center animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-xl border border-emerald-100">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={3}/></svg>
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-4 text-slate-900 dark:text-white leading-none">Finalizar Mesa?</h3>
                  <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6 space-y-2">
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-400"><span>Mesa:</span><span className="text-slate-900 dark:text-white">{selectedTable.label}</span></div>
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-400"><span>Total:</span><span className="text-slate-900 dark:text-white font-bold">R$ {total.toFixed(2)}</span></div>
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-400"><span>Pagamento:</span><span className="text-indigo-500">{selectedMethod}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setShowSafetyLock(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                      <button onClick={() => { handleFinalFinish(); }} disabled={isFinalizing} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">{isFinalizing ? 'Gravando...' : 'Confirmar'}</button>
                  </div>
              </div>
          </div>
      )}

      {isTransferOpen && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
              <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-8 shadow-6xl border border-white/10 text-center animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4 text-indigo-500 shadow-xl border border-indigo-100 shrink-0">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-slate-900 dark:text-white leading-none shrink-0">Transferir Mesa</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-6 leading-relaxed px-4 shrink-0">Selecione a mesa de destino para transferir os itens da mesa {selectedTable?.label}.</p>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-2 grid grid-cols-3 gap-2 content-start">
                      {tables.filter(t => t.id !== selectedTable?.id && t.status === 'Livre' && t.items.length === 0).map(t => (
                          <button 
                              key={t.id} 
                              onClick={() => setSelectedTransferTableId(t.id)}
                              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center h-20 ${selectedTransferTableId === t.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'}`}
                          >
                              <span className="text-sm font-black italic uppercase tracking-tighter">{t.label}</span>
                              <span className={`text-[8px] font-bold uppercase mt-1 ${selectedTransferTableId === t.id ? 'text-indigo-100' : 'text-emerald-500'}`}>Livre</span>
                          </button>
                      ))}
                      {tables.filter(t => t.id !== selectedTable?.id && (t.status !== 'Livre' || t.items.length > 0)).length === tables.length - 1 && (
                        <div className="col-span-3 py-10 text-center">
                          <p className="text-[10px] font-black uppercase text-slate-400">Nenhuma mesa livre disponível</p>
                        </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 shrink-0">
                      <button onClick={() => { setIsTransferOpen(false); setSelectedTransferTableId(null); }} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button onClick={handleTransferTable} disabled={selectedTransferTableId === null} className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50">Transferir</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Tables;
