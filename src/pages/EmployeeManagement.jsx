import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getCurrentUser, getUsers, saveUsers, getAppSettings, 
  getSales, getProducts, saveConsumption, getConsumptions, 
  deleteConsumption, getCashierShifts, DEFAULT_SETTINGS, saveAllConsumptions
} from '../services/storage';

export default function EmployeeManagement({ onNavigate }) {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('team');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  
  const [consumptionEmployee, setConsumptionEmployee] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  const [allConsumptions, setAllConsumptions] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [shifts, setShifts] = useState([]);

  // Filtros Auditoria
  const [auditEmployeeId, setAuditEmployeeId] = useState('');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);

  // Detalhes de Produtos Vendidos (Pop-up)
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItemsForDetail, setSelectedItemsForDetail] = useState([]);
  
  // Modal Zerar Gastos (Protocolo 712010)
  const [showClearConsumptionsModal, setShowClearConsumptionsModal] = useState(false);
  const [clearMode, setClearMode] = useState('day');

  const [confirmDeleteEmp, setConfirmDeleteEmp] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '', email: '', passwordHash: '', permissions: [], active: true, skipCashierClosure: false
  });

  const availablePermissions = [
    { id: 'dashboard', label: 'Painel Principal' },
    { id: 'new-sale', label: 'Realizar Vendas' },
    { id: 'tables', label: 'Gestão de Mesas' },
    { id: 'deliveries', label: 'Logística de Entregas' },
    { id: 'products', label: 'Controle de Estoque' },
    { id: 'categories', label: 'Categorias' },
    { id: 'expenses', label: 'Lançar Despesas' },
    { id: 'sales-history', label: 'Histórico de Vendas' },
    { id: 'reports', label: 'Relatórios' },
    { id: 'support', label: 'Suporte Técnico' }
  ];

  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    const [allUsers, sett, prods, cons, salesData, shiftsData] = await Promise.all([
        getUsers(),
        getAppSettings(currentUser.tenantId),
        getProducts(),
        getConsumptions(),
        getSales(),
        getCashierShifts()
    ]);
    
    setEmployees(allUsers.filter(u => u.tenantId === currentUser.tenantId && u.role === 'employee'));
    setSettings(sett);
    setAllProducts(prods);
    setAllConsumptions(cons);
    setAllSales(salesData);
    setShifts(shiftsData.filter(s => s.tenantId === currentUser.tenantId));
  }, [currentUser]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const consolidatedAuditData = useMemo(() => {
    if (!auditEmployeeId || !auditDate) return null;
    
    const targetEmployee = employees.find(e => e.id === auditEmployeeId);
    if (!targetEmployee) return null;

    const daySales = allSales.filter(s => 
      s.userId === auditEmployeeId && 
      s.status === 'Concluída' &&
      s.date.startsWith(auditDate)
    );

    const dayConsumptions = allConsumptions.filter(c => 
      c.userId === auditEmployeeId &&
      c.date.startsWith(auditDate)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const accumulatedConsumptionUntilDate = allConsumptions.filter(c => 
      c.userId === auditEmployeeId &&
      c.date.split('T')[0] <= auditDate
    ).reduce((acc, c) => acc + c.totalPrice, 0);

    const accumulatedRevenueUntilDate = allSales.filter(s =>
      s.userId === auditEmployeeId &&
      s.status === 'Concluída' &&
      s.date.split('T')[0] <= auditDate
    ).reduce((acc, s) => acc + s.total, 0);

    const totalRevenue = daySales.reduce((acc, s) => acc + s.total, 0);
    const totalItemsSold = daySales.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    
    const allItemsSold = [];
    daySales.forEach(s => allItemsSold.push(...s.items));

    const totalConsumptionToday = dayConsumptions.reduce((acc, c) => acc + c.totalPrice, 0);

    const userShifts = shifts.filter(s => 
      s.userId === auditEmployeeId && 
      s.openDate.startsWith(auditDate)
    );

    return {
      employee: targetEmployee,
      metrics: {
        totalRevenue,
        accumulatedRevenueUntilDate,
        totalItemsSold,
        allItemsSold,
        totalConsumptionToday,
        accumulatedConsumptionUntilDate,
        dayConsumptions,
        salesCount: daySales.length
      },
      userShifts
    };
  }, [auditEmployeeId, auditDate, allSales, allConsumptions, employees, shifts]);

  const handleOpenModal = (emp) => {
    if (emp) {
      setEditingEmployee(emp);
      setFormData({ 
        name: emp.name, 
        email: emp.email, 
        passwordHash: emp.passwordHash, 
        permissions: emp.permissions || [], 
        active: emp.active,
        skipCashierClosure: emp.skipCashierClosure || false
      });
    } else {
      setEditingEmployee(null);
      setFormData({ name: '', email: '', passwordHash: '', permissions: ['dashboard', 'new-sale'], active: true, skipCashierClosure: false });
    }
    setIsModalOpen(true);
  };

  const handleOpenConsumption = (e, emp) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setConsumptionEmployee(emp);
    setSelectedProduct(null);
    setSearchProduct('');
    setQty(1);
  };

  const handleConfirmConsumption = async () => {
    if (!consumptionEmployee || !selectedProduct) return;
    
    if (qty > selectedProduct.stock) {
        alert(`ERRO: Quantidade insuficiente em estoque. Disponível: ${selectedProduct.stock} UN.`);
        return;
    }
    
    setIsRegistering(true);
    const record = {
        id: Math.random().toString(36).substr(2, 9),
        userId: consumptionEmployee.id,
        userName: consumptionEmployee.name,
        tenantId: consumptionEmployee.tenantId,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: qty,
        unitPrice: selectedProduct.price,
        totalPrice: selectedProduct.price * qty,
        date: new Date().toISOString()
    };
    
    try {
        const saved = await saveConsumption(record);
        if (saved) {
            setShowSuccessToast(true);
            setConsumptionEmployee(null);
            setSelectedProduct(null); 
            setSearchProduct(''); 
            setQty(1); 
            await refreshData();
            setTimeout(() => setShowSuccessToast(false), 3000);
        }
    } catch (err) {
        console.error("Erro ao lançar gasto:", err);
    } finally {
        setIsRegistering(false);
    }
  };

  const executeClearConsumptions = async () => {
    if (!auditEmployeeId) return;
    
    const all = await getConsumptions();
    let filtered;

    if (clearMode === 'day') {
        if (!auditDate) return;
        filtered = all.filter(c => 
          !(c.userId === auditEmployeeId && c.date.startsWith(auditDate))
        );
    } else {
        // "Mês (Geral)" - Limpa todo o acumulado deste usuário
        filtered = all.filter(c => c.userId !== auditEmployeeId);
    }
    
    await saveAllConsumptions(filtered);
    setShowClearConsumptionsModal(false);
    await refreshData();
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const allUsers = await getUsers();
    const employeeData = {
      id: editingEmployee ? editingEmployee.id : `emp-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: currentUser.tenantId,
      name: formData.name.toUpperCase(),
      email: formData.email.toLowerCase().trim(),
      passwordHash: formData.passwordHash,
      role: 'employee',
      active: formData.active,
      permissions: formData.permissions,
      skipCashierClosure: formData.skipCashierClosure,
      createdAt: editingEmployee?.createdAt || new Date().toISOString()
    };
    let updated = editingEmployee ? allUsers.map(u => u.id === editingEmployee.id ? employeeData : u) : [...allUsers, employeeData];
    await saveUsers(updated);
    setIsModalOpen(false);
    refreshData();
  };

  const executeDelete = async () => {
    if (!confirmDeleteEmp) return;
    const allUsers = await getUsers();
    const updated = allUsers.filter(u => u.id !== confirmDeleteEmp.id);
    await saveUsers(updated);
    setConfirmDeleteEmp(null);
    refreshData();
  };

  const handleDeleteRecord = async () => {
      if (!recordToDelete) return;
      await deleteConsumption(recordToDelete.id);
      setRecordToDelete(null);
      await refreshData();
  };

  const filteredSearchProducts = useMemo(() => {
    if (searchProduct.length < 1) return [];
    return allProducts.filter(p => 
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) || 
      (p.barcode && p.barcode.includes(searchProduct))
    );
  }, [allProducts, searchProduct]);

  return (
    <div className="space-y-2 pb-24 animate-in fade-in duration-500">
      {showSuccessToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[500] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-widest animate-in slide-in-from-top-4">
          Gasto Lançado com Sucesso ✓
        </div>
      )}

      <div className="flex justify-center mb-6">
          <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-full flex shadow-inner gap-1">
             <button onClick={() => setActiveTab('team')} className={`px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'team' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-400'}`}>Minha Equipe</button>
             <button onClick={() => setActiveTab('audit')} className={`px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-400'}`}>Auditoria de Caixa</button>
          </div>
      </div>

      {activeTab === 'team' ? (
          <>
            <div className="flex flex-col md:flex-row justify-between items-center gap-2 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div><h3 className="uppercase italic text-slate-900 dark:text-white leading-none font-black" style={{ fontSize: '10px' }}>Equipe de Vendas</h3><p className="font-bold text-slate-400 uppercase mt-2" style={{ fontSize: '10px' }}>Gestão de acessos e monitoramento de gastos</p></div>
                <button onClick={() => handleOpenModal()} style={{ backgroundColor: settings.primaryColor, fontSize: '10px' }} className="w-full md:w-auto text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all">+ Adicionar Funcionário</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-4">
                {employees.map(emp => (
                <div key={emp.id} className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-between hover:border-indigo-500 transition-all">
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center font-black text-indigo-500 text-lg shadow-inner">{emp.name.substring(0, 2).toUpperCase()}</div>
                                <div><h4 className="uppercase italic text-slate-900 dark:text-white leading-none font-black" style={{ fontSize: '10px' }}>{emp.name}</h4><p className="font-bold text-slate-400 uppercase mt-2 tracking-widest" style={{ fontSize: '10px' }}>Login: {emp.email}</p></div>
                            </div>
                            <span className={`px-3 py-1 rounded-lg font-black uppercase tracking-widest ${emp.active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`} style={{ fontSize: '10px' }}>{emp.active ? 'Ativo' : 'Suspenso'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setAuditEmployeeId(emp.id); setActiveTab('audit'); }} className="py-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black uppercase tracking-[0.2em] border border-indigo-100 dark:border-indigo-800 shadow-sm hover:bg-indigo-100 transition-all" style={{ fontSize: '10px' }}>Relatórios</button>
                            <button onClick={(e) => handleOpenConsumption(e, emp)} className="py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl font-black uppercase tracking-[0.2em] border border-emerald-100 dark:border-emerald-800 shadow-sm hover:bg-emerald-100 transition-all" style={{ fontSize: '10px' }}>Lançar Gasto</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-8">
                        <button onClick={() => handleOpenModal(emp)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black uppercase hover:bg-slate-200 transition-all" style={{ fontSize: '10px' }}>Editar</button>
                        <button onClick={() => setConfirmDeleteEmp(emp)} className="py-3 bg-rose-50 text-rose-500 rounded-xl font-black uppercase hover:bg-rose-100 transition-all" style={{ fontSize: '10px' }}>Excluir</button>
                    </div>
                </div>
                ))}
            </div>
          </>
      ) : (
          <div className="space-y-2 animate-in slide-in-from-right-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-2 items-end">
                  <div className="flex-1 w-full space-y-1.5">
                      <label className="font-black uppercase text-indigo-500 ml-2 tracking-widest italic" style={{ fontSize: '10px' }}>Filtrar Funcionário</label>
                      <select 
                        value={auditEmployeeId} 
                        onChange={e => setAuditEmployeeId(e.target.value)}
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                        style={{ fontSize: '10px' }}
                      >
                          <option value="">TODOS OS COLABORADORES</option>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                  </div>
                  <div className="w-full md:w-64 space-y-1.5">
                      <label className="font-black uppercase text-indigo-500 ml-2 tracking-widest italic" style={{ fontSize: '10px' }}>Escolher Data</label>
                      <input 
                        type="date" 
                        value={auditDate} 
                        onChange={e => setAuditDate(e.target.value)}
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                        style={{ fontSize: '10px' }}
                      />
                  </div>
                  <button onClick={() => { setAuditEmployeeId(''); setAuditDate(new Date().toISOString().split('T')[0]); refreshData(); }} className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all min-w-[100px]" style={{ fontSize: '10px' }}>Limpar</button>
              </div>

              {consolidatedAuditData && (
                <div className="space-y-2 animate-in slide-in-from-top-4 duration-500">
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg">
                                    <svg style={{ width: '21px', height: '21px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeWidth={2}/></svg>
                                </div>
                                <div>
                                    <h4 className="font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none" style={{ fontSize: '10px' }}>Auditoria de Caixa</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="font-bold text-slate-400 uppercase tracking-widest" style={{ fontSize: '10px' }}>Colaborador: {consolidatedAuditData.employee.name}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenConsumption(null, consolidatedAuditData.employee)} className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-md hover:brightness-110 active:scale-95 transition-all" style={{ fontSize: '10px' }}>Lançar Gasto</button>
                                <button onClick={() => { setClearMode('day'); setShowClearConsumptionsModal(true); }} className="px-5 py-3 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest shadow-md hover:brightness-110 active:scale-95 transition-all" style={{ fontSize: '10px' }}>Zerar Gastos Internos</button>
                                <button 
                                    onClick={() => { setSelectedItemsForDetail(consolidatedAuditData.metrics.allItemsSold); setShowDetailsModal(true); }}
                                    className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest shadow-md hover:brightness-110 active:scale-95 transition-all"
                                    style={{ fontSize: '10px' }}
                                >
                                    Lista de Itens Vendidos
                                </button>
                            </div>
                        </div>

                        <div className="p-8 md:p-10 grid grid-cols-1 md:grid-cols-5 gap-2">
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner text-center">
                                <p className="font-black uppercase text-slate-400 tracking-widest mb-1" style={{ fontSize: '10px' }}>Vendas do Dia</p>
                                <p className="text-xl font-black italic text-slate-900 dark:text-white leading-none">{consolidatedAuditData.metrics.salesCount} Pedidos</p>
                                <p className="font-bold text-slate-400 uppercase mt-1" style={{ fontSize: '10px' }}>Total de {consolidatedAuditData.metrics.totalItemsSold} un.</p>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-[2.5rem] border border-rose-100 dark:border-rose-900/30 shadow-inner text-center">
                                <p className="font-black uppercase text-rose-500 tracking-widest mb-1" style={{ fontSize: '10px' }}>Gastos Hoje</p>
                                <p className="text-xl font-black italic text-rose-600 leading-none">R$ {consolidatedAuditData.metrics.totalConsumptionToday.toFixed(2)}</p>
                            </div>
                            <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-xl text-center">
                                <p className="font-black uppercase text-indigo-400 tracking-widest mb-1" style={{ fontSize: '10px' }}>Gasto Geral (Acumulado)</p>
                                <p className="text-xl font-black italic text-white leading-none">R$ {consolidatedAuditData.metrics.accumulatedConsumptionUntilDate.toFixed(2)}</p>
                                <p className="font-bold text-white/40 uppercase mt-1 italic" style={{ fontSize: '10px' }}>Até {new Date(auditDate + 'T12:00:00').toLocaleDateString()}</p>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30 shadow-inner text-center">
                                <p className="font-black uppercase text-emerald-500 tracking-widest mb-1" style={{ fontSize: '10px' }}>Faturamento Hoje</p>
                                <p className="text-xl font-black italic text-emerald-600 leading-none">R$ {consolidatedAuditData.metrics.totalRevenue.toFixed(2)}</p>
                            </div>
                            <div className="bg-emerald-100 dark:bg-emerald-900/20 p-6 rounded-[2.5rem] border border-emerald-200 dark:border-emerald-900/40 shadow-inner text-center">
                                <p className="font-black uppercase text-emerald-600 tracking-widest mb-1" style={{ fontSize: '10px' }}>Faturamento Geral</p>
                                <p className="text-xl font-black italic text-emerald-700 dark:text-emerald-300 leading-none">R$ {consolidatedAuditData.metrics.accumulatedRevenueUntilDate.toFixed(2)}</p>
                                <p className="font-bold text-emerald-600/50 uppercase mt-1 italic" style={{ fontSize: '10px' }}>Até {new Date(auditDate + 'T12:00:00').toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-2">
                            <div className="space-y-4">
                                <h5 className="font-black uppercase text-slate-400 ml-2 italic" style={{ fontSize: '10px' }}>Turnos de Caixa Encontrados</h5>
                                <div className="space-y-2">
                                    {consolidatedAuditData.userShifts.length === 0 ? (
                                        <div className="p-10 text-center opacity-20 border-2 border-dashed rounded-3xl"><p className="font-black uppercase" style={{ fontSize: '10px' }}>Nenhum turno nesta data</p></div>
                                    ) : (
                                        consolidatedAuditData.userShifts.map(s => (
                                            <div key={s.id} className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2">
                                                <div>
                                                    <p className="font-black text-slate-800 dark:text-white uppercase italic" style={{ fontSize: '10px' }}>Abertura: {new Date(s.openDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                                    <p className="font-bold text-slate-400 uppercase" style={{ fontSize: '10px' }}>Status: {s.status}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-400 uppercase" style={{ fontSize: '10px' }}>Fundo: R$ {s.initialCash.toFixed(2)}</p>
                                                    <p className="font-black text-indigo-500 uppercase" style={{ fontSize: '10px' }}>Físico: R$ {s.finalCash?.toFixed(2) || '---'}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h5 className="font-black uppercase text-rose-500 ml-2 italic" style={{ fontSize: '10px' }}>Histórico de Gastos do Dia ({new Date(auditDate + 'T12:00:00').toLocaleDateString()})</h5>
                                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden max-h-[220px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-950 border-b sticky top-0 z-10 text-slate-400 uppercase font-black" style={{ fontSize: '10px' }}>
                                            <tr>
                                                <th className="px-4 py-3">Hora</th>
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3 text-center">Qtd</th>
                                                <th className="px-4 py-3 text-right">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 uppercase font-bold text-slate-800 dark:text-slate-300" style={{ fontSize: '10px' }}>
                                            {consolidatedAuditData.metrics.dayConsumptions.length === 0 ? (
                                                <tr><td colSpan={4} className="py-10 text-center opacity-20 font-black">Sem gastos nesta data</td></tr>
                                            ) : (
                                                consolidatedAuditData.metrics.dayConsumptions.map(c => (
                                                    <tr key={c.id} className="hover:bg-rose-50/20 group">
                                                        <td className="px-4 py-2 text-slate-400 font-black italic">{new Date(c.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</td>
                                                        <td className="px-4 py-2">{c.productName}</td>
                                                        <td className="px-4 py-2 text-center">{c.quantity}</td>
                                                        <td className="px-4 py-2 text-right text-rose-600 font-black">
                                                            <div className="flex items-center justify-end gap-2">R$ {c.totalPrice.toFixed(2)}<button onClick={() => setRecordToDelete(c)} className="p-1 text-slate-200 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"><svg style={{ width: '21px', height: '21px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg></button></div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              )}

              {!consolidatedAuditData && (
                <div className="bg-white dark:bg-slate-900 p-20 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800 text-center opacity-30">
                    <p className="font-black uppercase tracking-[0.3em] italic" style={{ fontSize: '10px' }}>Selecione um funcionário para visualizar a auditoria</p>
                </div>
              )}
          </div>
      )}

      {/* MODAL ZERAR GASTOS (PROTOCOLO 712010 - COMPACTO) */}
      {showClearConsumptionsModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
             <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2.5rem] p-8 shadow-6xl border border-white/10 text-center animate-in zoom-in-95 flex flex-col gap-2">
                <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mb-2 mx-auto text-rose-500 shadow-inner">
                   <svg style={{ width: '21px', height: '21px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={3} /></svg>
                </div>
                <h3 className="font-black text-slate-900 dark:text-white uppercase italic mb-1 leading-none" style={{ fontSize: '14px' }}>Zerar Gastos</h3>
                <p className="text-slate-500 font-bold uppercase tracking-widest mb-4" style={{ fontSize: '10px' }}>Selecione o tipo de limpeza</p>
                
                <div className="flex flex-col gap-2 mb-6">
                    <button 
                      onClick={() => setClearMode('day')}
                      className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 transition-all ${clearMode === 'day' ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}
                    >
                        Zerar Gastos do Dia
                    </button>
                    <button 
                      onClick={() => setClearMode('month')}
                      className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 transition-all ${clearMode === 'month' ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}
                    >
                        Zerar Gastos do Mês (Geral)
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setShowClearConsumptionsModal(false)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black uppercase tracking-widest" style={{ fontSize: '10px' }}>Voltar</button>
                   <button onClick={executeClearConsumptions} className="py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all" style={{ fontSize: '10px' }}>Confirmar</button>
                </div>
             </div>
          </div>
      )}

      {/* POP-UPS E OUTROS MODAIS */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3.5rem] shadow-6xl border border-white/5 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-8 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
                  <div>
                      <h3 className="uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none font-black" style={{ fontSize: '10px' }}>Relatório de Itens</h3>
                      <p className="font-bold text-slate-400 uppercase mt-2" style={{ fontSize: '10px' }}>Detalhamento completo das saídas do período selecionado</p>
                  </div>
                  <button onClick={() => setShowDetailsModal(false)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm transition-all">
                      <svg style={{ width: '21px', height: '21px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg>
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b sticky top-0 z-10 text-slate-400 uppercase font-black" style={{ fontSize: '10px' }}>
                          <tr>
                            <th className="px-8 py-5 tracking-widest">Produto</th>
                            <th className="px-8 py-5 tracking-widest text-center">Quantidade</th>
                            <th className="px-8 py-5 tracking-widest text-right">Valor Unit..</th>
                            <th className="px-8 py-5 tracking-widest text-right">Subtotal</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800" style={{ fontSize: '10px' }}>
                          {selectedItemsForDetail.length === 0 ? (
                              <tr><td colSpan={4} className="py-20 text-center opacity-30 italic font-black uppercase">Sem registros de itens</td></tr>
                          ) : (
                              selectedItemsForDetail.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all font-bold">
                                      <td className="px-8 py-4"><span className="uppercase text-slate-900 dark:text-white italic">{item.productName}</span></td>
                                      <td className="px-8 py-4 text-center font-black text-indigo-500">{item.quantity} UN</td>
                                      <td className="px-8 py-4 text-right text-slate-400">R$ {item.price.toFixed(2)}</td>
                                      <td className="px-8 py-4 text-right font-black text-slate-900 dark:text-white italic">R$ {item.subtotal.toFixed(2)}</td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
              <div className="p-8 bg-slate-50 dark:bg-slate-950 border-t dark:border-white/5 flex justify-between items-center">
                  <span className="font-black uppercase text-slate-400 tracking-widest" style={{ fontSize: '10px' }}>Volume Total: {selectedItemsForDetail.reduce((a,b) => a + b.quantity, 0)} Itens</span>
                  <button onClick={() => setShowDetailsModal(false)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all" style={{ fontSize: '10px' }}>Fechar Pop-up</button>
              </div>
           </div>
        </div>
      )}

      {consumptionEmployee && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[400] p-4 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-6xl border border-white/10 flex flex-col relative animate-in zoom-in-95">
              
              <div className="flex justify-between items-center mb-8 shrink-0">
                 <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-500 shadow-inner">
                        <svg style={{ width: '21px', height: '21px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg>
                    </div>
                    <div>
                        <h3 className="uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none font-black" style={{ fontSize: '10px' }}>Registrar Gasto</h3>
                        <p className="font-bold text-slate-400 uppercase mt-2 tracking-widest" style={{ fontSize: '10px' }}>Colaborador: {consumptionEmployee.name}</p>
                    </div>
                 </div>
                 <button onClick={() => setConsumptionEmployee(null)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 transition-all active:scale-95 shadow-sm"><svg style={{ width: '21px', height: '21px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
              </div>

              <div className="space-y-6">
                 <div className="relative">
                    <label className="font-black uppercase text-indigo-500 ml-2 mb-2 block tracking-widest italic" style={{ fontSize: '10px' }}>1. Pesquisar Item no Inventário</label>
                    <div className="relative group">
                        <input 
                           autoFocus value={searchProduct} onChange={e => { setSearchProduct(e.target.value); setSelectedProduct(null); }} 
                           placeholder="BUSCAR NOME OU BIPAR CÓDIGO..." 
                           className="w-full px-12 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-3xl font-black uppercase text-xs outline-none transition-all dark:text-white shadow-inner"
                        />
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" style={{ width: '21px', height: '21px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={3}/></svg>
                    </div>
                    
                    {!selectedProduct && filteredSearchProducts.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-800 mt-2 rounded-3xl shadow-6xl border border-slate-100 dark:border-slate-700 z-[500] max-h-56 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                           {filteredSearchProducts.map(p => (
                             <button 
                               key={p.id} 
                               onClick={() => { setSelectedProduct(p); setSearchProduct(p.name); }} 
                               className="w-full px-6 py-4 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-b dark:border-white/5 last:border-0 flex justify-between items-center transition-colors"
                             >
                               <span className="font-black uppercase text-slate-800 dark:text-white truncate" style={{ fontSize: '10px' }}>{p.name}</span>
                               <span className={`font-black uppercase px-2 py-1 rounded-lg ${p.stock < 5 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`} style={{ fontSize: '10px' }}>EST: {p.stock}</span>
                             </button>
                           ))}
                        </div>
                    )}
                 </div>

                 {selectedProduct && (
                    <div className="animate-in zoom-in-95 space-y-6">
                        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2.5rem] border-2 border-indigo-100 dark:border-indigo-800/50 flex flex-col md:flex-row justify-between items-center gap-2 shadow-sm">
                            <div className="flex-1 text-center md:text-left">
                                <span className="font-black text-indigo-400 uppercase tracking-[0.2em] block mb-1" style={{ fontSize: '10px' }}>Informações do Item</span>
                                <h4 className="text-sm font-black uppercase text-indigo-700 dark:text-indigo-300 leading-tight italic">{selectedProduct.name}</h4>
                                <div className="flex items-center gap-2 mt-3 justify-center md:justify-start">
                                    <div className="text-center md:text-left">
                                        <p className="font-black text-slate-400 uppercase" style={{ fontSize: '10px' }}>Preço Unitário</p>
                                        <p className="font-black text-slate-700 dark:text-slate-200" style={{ fontSize: '10px' }}>R$ {selectedProduct.price.toFixed(2)}</p>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                                    <div className="text-center md:text-left">
                                        <p className="font-black text-slate-400 uppercase" style={{ fontSize: '10px' }}>Estoque Real</p>
                                        <p className={`font-black ${selectedProduct.stock < 5 ? 'text-rose-500' : 'text-emerald-500'}`} style={{ fontSize: '10px' }}>{selectedProduct.stock} UN</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-indigo-100 dark:border-slate-800 shadow-xl flex items-center gap-2">
                                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 font-black text-lg text-slate-400 hover:text-indigo-600 transition-colors shadow-sm active:scale-90">-</button>
                                <div className="text-center min-w-[40px]">
                                    <span className="text-2xl font-black text-slate-900 dark:text-white italic">{qty}</span>
                                    <p className="font-black text-slate-400 uppercase" style={{ fontSize: '10px' }}>Unidade(s)</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        if(qty < selectedProduct.stock) setQty(qty + 1);
                                        else alert("Limite de estoque atingido!");
                                    }} 
                                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 font-black text-lg text-slate-400 hover:text-indigo-600 transition-colors shadow-sm active:scale-90"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-950 p-6 rounded-[2rem] border-b-4 border-indigo-600 flex justify-between items-center shadow-2xl">
                            <div>
                                <span className="font-black text-indigo-400 uppercase tracking-widest" style={{ fontSize: '10px' }}>Total do Lançamento</span>
                                <p className="text-2xl font-black text-white italic tracking-tighter leading-none mt-1">R$ {(selectedProduct.price * qty).toFixed(2)}</p>
                            </div>
                            <svg style={{ width: '21px', height: '21px' }} className="text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeWidth={3}/></svg>
                        </div>
                    </div>
                 )}

                 <button 
                    disabled={!selectedProduct || isRegistering || (selectedProduct && qty > selectedProduct.stock)} 
                    onClick={handleConfirmConsumption} 
                    className={`w-full py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${(!selectedProduct || (selectedProduct && qty > selectedProduct.stock)) ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50 grayscale' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:brightness-110'}`}
                    style={{ fontSize: '10px' }}
                 >
                    {isRegistering ? 'PROCESSANDO...' : (selectedProduct && qty > selectedProduct.stock) ? 'ESTOQUE INSUFICIENTE' : 'CONFIRMAR REGISTRO ✓'}
                 </button>
                 <p className="font-bold text-slate-400 text-center uppercase tracking-widest" style={{ fontSize: '10px' }}>O estoque será atualizado automaticamente após a confirmação</p>
              </div>
           </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar flex flex-col border border-white/5">
              <div className="p-8 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0"><div><h3 className="uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none font-black" style={{ fontSize: '10px' }}>{editingEmployee ? 'Ficha do Colaborador' : 'Novo Funcionário'}</h3><p className="font-bold text-slate-400 uppercase mt-1" style={{ fontSize: '10px' }}>Configuração de credenciais e permissões</p></div><button onClick={() => setIsModalOpen(false)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button></div>
              <form onSubmit={handleSaveEmployee} className="flex-1 p-10 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="font-black uppercase text-slate-400 ml-2" style={{ fontSize: '10px' }}>Nome Completo</label><input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} placeholder="EX: PEDRO ALMEIDA" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div className="space-y-1"><label className="font-black uppercase text-slate-400 ml-2" style={{ fontSize: '10px' }}>Usuário de Login</label><input required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} placeholder="pedro.vendas" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div className="space-y-1"><label className="font-black uppercase text-slate-400 ml-2" style={{ fontSize: '10px' }}>Senha de Acesso</label><input required value={formData.passwordHash} onChange={e => setFormData({...formData, passwordHash: e.target.value})} placeholder="******" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div className="space-y-1"><label className="font-black uppercase text-slate-400 ml-2" style={{ fontSize: '10px' }}>Status da Conta</label><select value={formData.active ? 'true' : 'false'} onChange={e => setFormData({...formData, active: e.target.value === 'true'})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black uppercase outline-none cursor-pointer" style={{ fontSize: '10px' }}><option value="true">ATIVA (ACESSO LIBERADO)</option><option value="false">SUSPENSA (BLOQUEADO)</option></select></div>
                 </div>

                 <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex flex-col">
                        <h4 className="font-black uppercase tracking-widest text-[var(--workspace-text)] leading-none" style={{ fontSize: '10px' }}>Isenção de Fechamento</h4>
                        <p className="font-bold text-slate-400 uppercase mt-2" style={{ fontSize: '9px' }}>Desabilitar obrigatoriedade de abrir/fechar caixa</p>
                    </div>
                    <div 
                      onClick={() => setFormData({...formData, skipCashierClosure: !formData.skipCashierClosure})} 
                      className={`w-14 h-7 rounded-full cursor-pointer transition-all relative ${formData.skipCashierClosure ? 'bg-indigo-600 shadow-lg' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${formData.skipCashierClosure ? 'left-8' : 'left-1'}`}></div>
                    </div>
                 </div>

                 <div className="space-y-6 pt-6 border-t dark:border-white/5"><div className="flex flex-col"><h4 className="font-black uppercase tracking-widest text-indigo-500 italic" style={{ fontSize: '10px' }}>Limites de Acesso</h4><p className="font-bold text-slate-400 uppercase mt-1" style={{ fontSize: '10px' }}>Marque as seções que este colaborador poderá visualizar</p></div><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{availablePermissions.map(perm => (<div key={perm.id} onClick={() => { const perms = formData.permissions.includes(perm.id) ? formData.permissions.filter(p => p !== perm.id) : [...formData.permissions, perm.id]; setFormData({...formData, permissions: perms}); }} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-2 ${formData.permissions.includes(perm.id) ? 'bg-indigo-50 border-indigo-500/30 dark:bg-indigo-900/20' : 'bg-slate-50 border-transparent dark:bg-slate-800/40'}`}><div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${formData.permissions.includes(perm.id) ? 'bg-indigo-500 border-indigo-500' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>{formData.permissions.includes(perm.id) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>}</div><span className={`font-black uppercase tracking-tighter leading-tight ${formData.permissions.includes(perm.id) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} style={{ fontSize: '10px' }}>{perm.label}</span></div>))}</div></div>
                 <button type="submit" style={{ backgroundColor: settings.primaryColor, fontSize: '10px' }} className="w-full py-5 text-white rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all mt-4">Gravar Dados do Funcionário</button>
              </form>
           </div>
        </div>
      )}

      {(recordToDelete || confirmDeleteEmp) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-8 shadow-2xl border border-white/10 text-center animate-in zoom-in-95">
              <h3 className="font-black text-slate-900 dark:text-white uppercase italic mb-1 leading-none" style={{ fontSize: '10px' }}>Confirmar Exclusão?</h3>
              <p className="text-slate-500 font-bold uppercase mb-6 mt-4" style={{ fontSize: '10px' }}>Esta ação é irreversível.</p>
              <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => {setRecordToDelete(null); setConfirmDeleteEmp(null);}} className="py-3 bg-slate-100 rounded-xl font-black uppercase tracking-widest transition-all" style={{ fontSize: '10px' }}>Voltar</button>
                 <button 
                   onClick={confirmDeleteEmp ? executeDelete : handleDeleteRecord} 
                   className="py-3 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                   style={{ fontSize: '10px' }}
                 >
                   Confirmar
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}