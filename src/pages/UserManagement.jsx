import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  getUsers, saveUsers, getAccessRequests, 
  getGlobalPlans, getCustomers, saveCustomers, exportTenantBackup,
  removeAccessRequest, notifyDataChanged,
  getGlobalEstablishmentCategories, saveGlobalEstablishmentCategories
} from '../services/storage';

// --- HELPERS DE FORMATAÇÃO E VALIDAÇÃO ---

const formatDocument = (val = '') => {
  const v = val.replace(/\D/g, '').slice(0, 14);
  if (v.length <= 11) {
    return v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return v
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const formatWhatsApp = (val) => {
  const v = val.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

export default function UserManagement() {
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('p4zz_session_user') || '{}'), []);
  const isMaster = currentUser?.tenantId === 'MASTER' && currentUser?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [globalCategories, setGlobalCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  
  const [formErrors, setFormErrors] = useState({});
  const [plans, setPlans] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    establishmentName: '',
    category: '',
    document: '',
    whatsapp: '',
    whatsappConfirmed: false,
    email: '',
    passwordHash: '',
    role: 'customer',
    planName: '',
    expiresAt: '',
    active: true,
    originIp: '',
    originLocation: '',
    createdManually: false,
    gracePeriod: 10
  });

  const [confirmModal, setConfirmModal] = useState(null);

  const refreshData = useCallback(async () => {
    try {
      const [allUsers, allRequests, allPlans, allGlobalCats] = await Promise.all([
        getUsers(),
        getAccessRequests(),
        getGlobalPlans(),
        getGlobalEstablishmentCategories()
      ]);
      setUsers(allUsers);
      setRequests(allRequests);
      setPlans(allPlans);
      setGlobalCategories(allGlobalCats);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleInputChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    
    if (field === 'role') {
        if (value === 'demo') {
            updated.planName = '';
            updated.expiresAt = ''; 
        } else if (value === 'customer') {
            updated.planName = ''; 
            updated.expiresAt = ''; 
        }
    }
    
    if (field === 'planName' && formData.role === 'customer') {
        const selectedPlan = plans.find(p => p.name === value);
        if (selectedPlan) {
            const d = new Date();
            d.setDate(d.getDate() + selectedPlan.days);
            updated.expiresAt = d.toISOString().split('T')[0];
        }
    }

    setFormData(updated);
    
    if (formErrors[field]) {
        const newErrors = { ...formErrors };
        delete newErrors[field];
        setFormErrors(newErrors);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const allUsers = await getUsers();
    const errors = {};
    
    const loginClean = formData.email.trim().toLowerCase();
    const docClean = formData.document.replace(/\D/g, '');

    // Validações Básicas
    if (!formData.name.trim()) errors.name = 'Obrigatório';
    if (!formData.establishmentName.trim()) errors.establishmentName = 'Obrigatório';
    if (!loginClean) errors.email = 'Obrigatório';
    if (!formData.passwordHash) errors.passwordHash = 'Obrigatório';
    if (!formData.whatsappConfirmed) errors.whatsappConfirmed = 'Confirme o WhatsApp';
    
    if (formData.role === 'customer') {
        if (!formData.planName) errors.planName = 'Selecione um plano';
    } else if (formData.role === 'demo') {
        if (!formData.expiresAt) errors.expiresAt = 'Data obrigatória para Demo';
    }

    // --- TRAVAS DE UNICIDADE ---
    const existingByLogin = allUsers.find(u => u.email.toLowerCase() === loginClean && u.id !== editingUser?.id);
    if (existingByLogin) errors.email = 'Este login já está em uso.';

    if (docClean) {
        const existingByDoc = allUsers.find(u => (u.document || '').replace(/\D/g, '') === docClean && u.id !== editingUser?.id);
        if (existingByDoc) errors.document = 'Este documento já está vinculado a outra conta.';
    }

    if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
    }

    const newUser = {
      id: editingUser ? editingUser.id : 'user-' + Math.random().toString(36).substr(2, 9),
      name: formData.name.toUpperCase(),
      tenantId: formData.establishmentName.toUpperCase(),
      email: loginClean,
      passwordHash: formData.passwordHash,
      role: formData.role,
      active: formData.active,
      document: docClean,
      whatsapp: formData.whatsapp.replace(/\D/g, ''),
      planName: formData.role === 'customer' ? formData.planName : undefined,
      expiresAt: (formData.role === 'customer' || formData.role === 'demo') ? formData.expiresAt : undefined,
      createdAt: editingUser?.createdAt || new Date().toISOString(),
      category: formData.category,
      permissions: editingUser?.permissions || ['dashboard', 'new-sale', 'tables', 'deliveries', 'products', 'categories', 'expenses', 'sales-history', 'reports'],
      originIp: editingUser?.originIp || formData.originIp,
      originLocation: editingUser?.originLocation || formData.originLocation,
      createdManually: editingUser ? editingUser.createdManually : true,
      gracePeriod: (formData.role === 'customer' || formData.role === 'demo') ? Number(formData.gracePeriod) : undefined
    };

    let updated;
    if (editingUser) updated = allUsers.map(u => u.id === editingUser.id ? newUser : u);
    else updated = [...allUsers, newUser];
    
    await saveUsers(updated);
    
    if (newUser.role === 'customer' || newUser.role === 'demo') {
      const customers = await getCustomers('MASTER');
      const idx = customers.findIndex(c => c.linkedUserId === newUser.id);
      const custData = {
        id: idx !== -1 ? customers[idx].id : Math.random().toString(36).substr(2, 6),
        name: newUser.name, 
        phone: newUser.whatsapp || '', 
        document: newUser.document,
        balance: idx !== -1 ? customers[idx].balance : 0, 
        status: 'active',
        createdAt: idx !== -1 ? customers[idx].createdAt : new Date().toISOString(),
        linkedUserId: newUser.id, 
        licenseExpiresAt: newUser.expiresAt || '',
        planName: newUser.planName
      };
      if (idx !== -1) customers[idx] = custData; else customers.push(custData);
      await saveCustomers(customers, 'MASTER');
    }

    setIsModalOpen(false);
    refreshData();
    notifyDataChanged();
  };

  const handleOpenModal = (user) => {
    setFormErrors({});
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        establishmentName: user.tenantId,
        category: user.category || '',
        document: formatDocument(user.document || ''),
        whatsapp: formatWhatsApp(user.whatsapp || ''),
        whatsappConfirmed: true,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        planName: user.planName || '',
        expiresAt: user.expiresAt || '',
        active: user.active,
        originIp: user.originIp || '',
        originLocation: user.originLocation || '',
        createdManually: user.createdManually || false,
        gracePeriod: user.gracePeriod ?? 10
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '', establishmentName: '', category: '', document: '', whatsapp: '', whatsappConfirmed: false,
        email: '', passwordHash: '', role: 'customer', 
        planName: '', 
        expiresAt: '', active: true,
        originIp: '', originLocation: '', createdManually: true,
        gracePeriod: 10
      });
    }
    setIsModalOpen(true);
  };

  const executeApprove = async (req) => {
    const allUsers = await getUsers();
    
    // Verifica duplicidade antes de aprovar
    const docClean = req.document.replace(/\D/g, '');
    const loginClean = req.login.trim().toLowerCase();
    
    if (allUsers.some(u => (u.document || '').replace(/\D/g, '') === docClean)) {
        alert("ERRO: Este documento já possui um cadastro ativo no sistema.");
        return;
    }
    if (allUsers.some(u => u.email.toLowerCase() === loginClean)) {
        alert("ERRO: Este login já está em uso por outro terminal.");
        return;
    }

    let userRole = 'customer';
    let daysToRenew = 30;
    let expiryDate = '';
    
    if (req.plan?.toUpperCase().includes('DEMO')) {
      userRole = 'demo';
      // 72 horas exatas (3 dias)
      const d = new Date();
      d.setHours(d.getHours() + 72);
      expiryDate = d.toISOString();
    } else {
      const selectedPlan = plans.find(p => p.name === req.plan);
      daysToRenew = selectedPlan ? selectedPlan.days : 30;
      const d = new Date();
      d.setDate(d.getDate() + daysToRenew);
      d.setHours(23, 59, 59, 999); // Fim do dia para planos normais
      expiryDate = d.toISOString();
    }

    const newUser = {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      name: (req.name || 'SOLICITANTE').toUpperCase(),
      tenantId: (req.name || 'EMPRESA').toUpperCase(),
      email: loginClean,
      passwordHash: req.passwordHash,
      role: userRole,
      active: true,
      document: docClean,
      whatsapp: req.whatsapp.replace(/\D/g, ''),
      planName: req.plan || '',
      expiresAt: expiryDate,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      category: req.category || '',
      permissions: ['dashboard', 'new-sale', 'tables', 'deliveries', 'products', 'categories', 'expenses', 'sales-history', 'reports'],
      originIp: req.originIp,
      originLocation: req.originLocation,
      createdManually: false,
      gracePeriod: 10
    };
    await saveUsers([...allUsers, newUser]);
    
    const customers = await getCustomers('MASTER');
    customers.push({
        id: Math.random().toString(36).substr(2, 6),
        name: newUser.name,
        phone: newUser.whatsapp || '',
        document: newUser.document,
        balance: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        linkedUserId: newUser.id,
        licenseExpiresAt: newUser.expiresAt,
        planName: newUser.planName
    });
    await saveCustomers(customers, 'MASTER');

    await removeAccessRequest(req.id);
    refreshData();
    notifyDataChanged();
  };

  const handleApproveConfirmation = (req) => {
    setConfirmModal({
      show: true,
      title: 'Aprovar Solicitação?',
      message: `Deseja liberar o acesso para ${req.name}?`,
      type: 'success',
      action: async () => {
        await executeApprove(req);
        setConfirmModal(null);
      }
    });
  };

  const handleRejectConfirmation = (req) => {
    setConfirmModal({
        show: true,
        title: 'Rejeitar Solicitação?',
        message: `Tem certeza que deseja recusar o pedido de ${req.name}?`,
        type: 'danger',
        action: async () => {
            await removeAccessRequest(req.id);
            refreshData();
            notifyDataChanged();
            setConfirmModal(null);
        }
    });
  };

  const handleUserAction = (type, user) => {
    if (type === 'config') { exportTenantBackup(user.tenantId); return; }
    
    const isTargetMaster = user.tenantId === 'MASTER' && user.role === 'admin';
    if (isTargetMaster && (type === 'suspend' || type === 'ban' || type === 'delete')) {
        alert("O Administrador Master possui acesso vitalício e não pode ser bloqueado.");
        return;
    }

    const titles = { suspend: 'Suspender Acesso?', ban: 'Banir Usuário?', activate: 'Liberar Acesso?', delete: 'Excluir Permanentemente?' };
    const messages = { suspend: `Deseja interromper temporariamente o acesso de ${user.name}?`, ban: `BLOQUEIO PERMANENTE: ${user.name} não poderá mais acessar o sistema.`, activate: `Restabelecer todas as permissões de ${user.name} agora?`, delete: `ATENÇÃO: Todos os dados vinculados a ${user.name} serão perdidos.` };
    
    setConfirmModal({
      show: true,
      title: titles[type],
      message: messages[type],
      type: type === 'activate' ? 'success' : 'danger',
      action: async () => {
        const allUsers = await getUsers();
        let updated;
        if (type === 'delete') updated = allUsers.filter(u => u.id !== user.id);
        else updated = allUsers.map(u => {
            if (u.id === user.id) {
              if (type === 'suspend') return { ...u, active: false, deactivatedMessage: 'SUSPENSO: Acesso interrompido pelo administrador.' };
              if (type === 'ban') return { ...u, active: false, deactivatedMessage: 'BANIDO: Acesso bloqueado permanentemente.' };
              if (type === 'activate') return { ...u, active: true, deactivatedMessage: '' };
            }
            return u;
        });
        await saveUsers(updated);
        setConfirmModal(null);
        refreshData();
        notifyDataChanged();
      }
    });
  };

  const filteredUsersList = users.filter(u => u.role !== 'employee' && (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || (u.document && u.document.includes(searchTerm))));
  
  const pendingRequests = requests.filter(r => r.status === 'pending');

  const expiredDemosList = users.filter(u => {
    if (u.role !== 'demo' || !u.expiresAt) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const expiry = new Date(u.expiresAt + 'T12:00:00');
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || (u.document && u.document.includes(searchTerm));
    return today > expiry && matchesSearch;
  });

  const getStatusInfo = (user) => {
    const today = new Date();
    const deactMsg = (user.deactivatedMessage || '').toUpperCase();
    if (!user.active && deactMsg.includes('BANIDO')) return { label: 'Banido', color: 'bg-rose-600 text-white', status: 'banned' };
    if (!user.active && deactMsg.includes('DEMO_EXPIRADA')) return { label: 'Demo Expirada', color: 'bg-slate-700 text-white', status: 'expired' };
    if (!user.active) return { label: 'Suspenso', color: 'bg-amber-400 text-slate-900', status: 'suspended' };
    
    if (user.expiresAt) {
        const expiry = new Date(user.expiresAt);
        const grace = user.role === 'demo' ? 0 : (user.gracePeriod || 0);
        const limit = new Date(expiry);
        limit.setDate(limit.getDate() + grace);
        
        if (today > limit) return { label: user.role === 'demo' ? 'Demo Expirada' : 'Vencido', color: 'bg-rose-600 text-white', status: 'expired' };
        if (today > expiry) return { label: 'Em Carência', color: 'bg-orange-500 text-white', status: 'active' };
    }
    
    if (user.role === 'admin') return { label: 'Admin', color: 'bg-indigo-600 text-white', status: 'active' };
    if (user.role === 'demo') return { label: 'Demo Ativa', color: 'bg-indigo-500 text-white', status: 'active' };
    return { label: 'Ativo', color: 'bg-emerald-500 text-white', status: 'active' };
  };

  const getTabClass = (tabId) => {
    const isActive = activeTab === tabId;
    return `px-6 md:px-10 py-3.5 md:py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${
      isActive 
        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
        : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-white/40 dark:hover:bg-slate-700/40'
    }`;
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex justify-center no-print scrollbar-hide">
        <div className="bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-full flex shadow-inner whitespace-nowrap overflow-x-auto border border-slate-300/30 dark:border-slate-700/30">
          <button onClick={() => setActiveTab('users')} className={getTabClass('users')}>Usuários</button>
          <button onClick={() => setActiveTab('requests')} className={`${getTabClass('requests')} flex items-center gap-2`}>
            Solicitações
            {pendingRequests.length > 0 && <span className="bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px] animate-pulse">{pendingRequests.length}</span>}
          </button>
          <button onClick={() => setActiveTab('expired-demos')} className={`${getTabClass('expired-demos')} flex items-center gap-2`}>
            Demos
            {expiredDemosList.length > 0 && <span className="bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px]">{expiredDemosList.length}</span>}
          </button>
        </div>
      </div>

      <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1 w-full md:w-auto">
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="PESQUISAR..." className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner" />
                  <svg className="w-5 h-5 text-slate-300 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={3}/></svg>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-90 shadow-sm border border-slate-200 dark:border-slate-700"
                    title="Gerenciar Categorias"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={2}/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
                  </button>
                  <button onClick={() => handleOpenModal()} className="flex-1 md:flex-none bg-slate-950 dark:bg-white dark:text-slate-950 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all">+ Novo Cadastro</button>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {activeTab === 'users' ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[950px]">
                        <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                            <tr>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo / Plano</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Vencimento</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredUsersList.map(u => {
                                const info = getStatusInfo(u);
                                const userPlan = plans.find(p => p.name === u.planName);
                                const isSelf = u.id === currentUser.id;
                                const isTargetMaster = u.tenantId === 'MASTER' && u.role === 'admin';

                                return (
                                    <tr key={u.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner ${u.active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>{u.name.substring(0, 2).toUpperCase()}</div>
                                                <div className="flex flex-col">
                                                    <p className="font-black text-xs uppercase text-slate-900 dark:text-white italic leading-none">{u.name} {isSelf && <span className="text-[7px] bg-slate-900 text-white px-1.5 py-0.5 rounded ml-1 tracking-widest">VOCÊ</span>}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{formatDocument(u.document) || 'SEM DOCUMENTO'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <span className={`inline-block px-3 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest mb-1 ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : (u.role === 'demo' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-100 text-emerald-600')}`}>{u.role === 'admin' ? 'ADMINISTRADOR' : (u.role === 'demo' ? 'CONTA DEMO' : u.role)}</span>
                                            <p className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase">{u.planName || (u.role === 'admin' ? 'ACESSO TOTAL' : 'PERSONALIZADO')}</p>
                                            {userPlan && <p className="text-[8px] font-black text-emerald-500 uppercase italic">R$ {userPlan.price.toFixed(2)}</p>}
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <p className={`text-[10px] font-black uppercase italic ${u.expiresAt ? (getStatusInfo(u).status === 'expired' ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200') : 'text-slate-400'}`}>
                                                {u.expiresAt ? (
                                                  u.role === 'demo' 
                                                    ? new Date(u.expiresAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                    : new Date(u.expiresAt).toLocaleDateString('pt-BR')
                                                ) : 'VITALÍCIO'}
                                            </p>
                                            {u.expiresAt && u.gracePeriod && u.gracePeriod > 0 && u.role !== 'demo' && (
                                                <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">+{u.gracePeriod}D CARÊNCIA</p>
                                            )}
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <span className={`inline-block w-28 py-2 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${info.color}`}>{info.label}</span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                {!u.active ? (
                                                  <button 
                                                    onClick={() => handleUserAction('activate', u)} 
                                                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md hover:brightness-110 active:scale-95 transition-all"
                                                  >
                                                    Liberar Acesso
                                                  </button>
                                                ) : (
                                                  <>
                                                    {!isTargetMaster && (
                                                      <>
                                                        <button onClick={() => handleUserAction('suspend', u)} className="p-3.5 md:p-2.5 text-amber-500 bg-amber-50 rounded-xl shadow-sm active:scale-90"><svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg></button>
                                                        <button onClick={() => handleUserAction('ban', u)} className="p-3.5 md:p-2.5 text-rose-500 bg-rose-50 rounded-xl shadow-sm active:scale-90"><svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2.5}/></svg></button>
                                                      </>
                                                    )}
                                                  </>
                                                )}
                                                <button onClick={() => handleUserAction('config', u)} className="p-3.5 md:p-2.5 text-indigo-500 bg-indigo-50 rounded-xl shadow-sm active:scale-90"><svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4V4" strokeWidth={2.5}/></svg></button>
                                                <button onClick={() => handleOpenModal(u)} className="p-3.5 md:p-2.5 text-slate-400 bg-slate-50 rounded-xl shadow-sm active:scale-90"><svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg></button>
                                                {!isTargetMaster && (
                                                  <button onClick={() => handleUserAction('delete', u)} className="p-3.5 md:p-2.5 text-rose-300 bg-slate-50 rounded-xl shadow-sm hover:text-rose-600 active:scale-90"><svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : activeTab === 'requests' ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                        <tr>
                          <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Solicitante</th>
                          <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Contato</th>
                          <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Plano Desejado</th>
                          <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {pendingRequests.map(req => (
                          <tr key={req.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-10 py-6">
                               <p className="font-black text-xs uppercase text-slate-900 dark:text-white leading-none">{req.name || req.login || 'NOME NÃO INFORMADO'}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{formatDocument(req.document)}</p>
                            </td>
                            <td className="px-10 py-6 text-center">
                               <p className="text-[10px] font-black text-indigo-500 uppercase">{formatWhatsApp(req.whatsapp)}</p>
                               <p className="text-[8px] text-slate-400 font-bold uppercase">{req.login}</p>
                            </td>
                            <td className="px-10 py-6 text-center">
                               <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-3 py-1 rounded-lg text-[8px] font-black uppercase">{req.plan || 'NÃO INFORMADO'}</span>
                            </td>
                            <td className="px-10 py-6 text-right">
                               <div className="flex justify-end gap-2">
                                  <button onClick={() => handleRejectConfirmation(req)} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-rose-100 transition-colors">Rejeitar</button>
                                  <button onClick={() => handleApproveConfirmation(req)} className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-[8px] font-black uppercase shadow-md hover:brightness-110 transition-all">Aprovar</button>
                               </div>
                            </td>
                          </tr>
                        ))}
                        {pendingRequests.length === 0 && (
                          <tr><td colSpan={4} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Sem solicitações pendentes</td></tr>
                        )}
                      </tbody>
                    </table>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[950px]">
                        <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                            <tr>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Vencimento Original</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {expiredDemosList.length === 0 ? (
                                <tr><td colSpan={4} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Nenhuma demo vencida localizada</td></tr>
                            ) : (
                                expiredDemosList.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50/50 transition-all">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs shadow-inner">EX</div>
                                                <div className="flex flex-col">
                                                    <p className="font-black text-xs uppercase text-slate-900 dark:text-white italic leading-none">{u.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{formatDocument(u.document) || 'SEM DOCUMENTO'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <p className="text-[10px] font-black text-rose-600 uppercase italic">
                                                {u.expiresAt ? new Date(u.expiresAt).toLocaleString('pt-BR') : '---'}
                                            </p>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <span className="inline-block w-28 py-2 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm bg-slate-700 text-white">EXPIRADA</span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button onClick={() => handleOpenModal(u)} className="p-2.5 text-slate-400 bg-slate-50 rounded-xl shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg></button>
                                                <button onClick={() => handleUserAction('delete', u)} className="p-2.5 text-rose-300 bg-slate-50 rounded-xl shadow-sm hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-2 md:p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar border border-white/5">
              <div className="p-6 md:p-8 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center sticky top-0 z-10">
                 <div>
                    <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">{editingUser ? 'Ficha do Usuário' : 'Novo Usuário'}</h3>
                    <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1">Configuração de Acesso</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-3 md:p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
              </div>

              <form onSubmit={handleSave} className="p-6 md:p-10 space-y-6 md:space-y-8">
                 <div className="space-y-6">
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.name ? 'text-rose-600' : 'text-slate-400'}`}>Nome Completo *</label>
                        <input placeholder="Digite o nome completo" value={formData.name} onChange={e => handleInputChange('name', e.target.value.toUpperCase())} className={`w-full px-6 py-5 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${formErrors.name ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-indigo-500'}`} />
                    </div>
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.establishmentName ? 'text-rose-600' : 'text-slate-400'}`}>ID Empresa / Tenant *</label>
                        <input 
                           placeholder="Digite o nome do estabelecimento"
                           disabled={editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin'}
                           value={formData.establishmentName} 
                           onChange={e => handleInputChange('establishmentName', e.target.value.toUpperCase())} 
                           className={`w-full px-6 py-5 border-2 rounded-2xl font-black text-base outline-none transition-all ${editingUser?.tenantId === 'MASTER' ? 'bg-slate-100 opacity-60 cursor-not-allowed' : ''} ${formErrors.establishmentName ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-indigo-500'}`} 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Categoria de Estabelecimento</label>
                        <select 
                           value={formData.category} 
                           onChange={e => handleInputChange('category', e.target.value)} 
                           className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                           <option value="">SELECIONE UMA CATEGORIA</option>
                           {globalCategories.map(cat => (
                              <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                           ))}
                        </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.document ? 'text-rose-600' : 'text-slate-400'}`}>CPF ou CNPJ *</label>
                        <input 
                            placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                            value={formData.document} 
                            onChange={e => handleInputChange('document', formatDocument(e.target.value))} 
                            className={`w-full px-6 py-5 border-2 rounded-2xl font-black text-base outline-none bg-slate-50 dark:bg-slate-800 dark:text-white transition-all ${formErrors.document ? 'border-rose-500 focus:border-rose-500' : 'border-transparent focus:border-indigo-500'}`} 
                        />
                        {formErrors.document && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.document}</p>}
                    </div>
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.whatsapp ? 'text-rose-600' : 'text-slate-400'}`}>WhatsApp *</label>
                        <input 
                            placeholder="Digite o WhatsApp com DDD" 
                            value={formData.whatsapp} 
                            onChange={e => handleInputChange('whatsapp', formatWhatsApp(e.target.value))} 
                            className={`w-full px-6 py-5 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${formErrors.whatsapp ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-emerald-500'}`} 
                        />
                        {formErrors.whatsapp && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.whatsapp}</p>}
                    </div>
                 </div>

                 <div 
                    onClick={() => handleInputChange('whatsappConfirmed', !formData.whatsappConfirmed)} 
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${formData.whatsappConfirmed ? 'bg-emerald-50 border-emerald-500/30' : formErrors.whatsappConfirmed ? 'bg-rose-50 border-rose-500/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/40 dark:border-slate-800'}`}
                 >
                    <div className="flex-1">
                       <span className={`text-[10px] font-black uppercase tracking-widest ${formData.whatsappConfirmed ? 'text-emerald-700' : formErrors.whatsappConfirmed ? 'text-rose-600' : 'text-slate-500'}`}>Confirmo o contato do usuário</span>
                       {formErrors.whatsappConfirmed && <p className="text-[8px] font-bold text-rose-600 mt-1 uppercase italic">{formErrors.whatsappConfirmed}</p>}
                    </div>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors ${formData.whatsappConfirmed ? 'bg-emerald-500 border-emerald-500' : formErrors.whatsappConfirmed ? 'bg-white border-rose-500' : 'bg-white border-slate-300'}`}>
                        {formData.whatsappConfirmed && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>}
                    </div>
                 </div>

                 <div className="space-y-6 pt-4 border-t dark:border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 ml-2 italic">Acesso ao Sistema</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.email ? 'text-rose-600' : 'text-slate-400'}`}>Usuário (Login) *</label>
                            <input placeholder="Digite o login de acesso" value={formData.email} onChange={e => handleInputChange('email', e.target.value.toLowerCase())} className={`w-full px-5 py-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all bg-white dark:bg-slate-800 dark:text-white ${formErrors.email ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'}`} />
                            {formErrors.email && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.email}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.passwordHash ? 'text-rose-600' : 'text-slate-400'}`}>Senha *</label>
                            <input placeholder="Digite uma senha" type="text" value={formData.passwordHash} onChange={e => handleInputChange('passwordHash', e.target.value)} className={`w-full px-5 py-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all bg-white dark:bg-slate-800 dark:text-white ${formErrors.passwordHash ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'}`} />
                        </div>
                    </div>
                 </div>

                 <div className="space-y-6 pt-4 border-t dark:border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Conta</label>
                            <select 
                               disabled={editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin'}
                               value={formData.role} 
                               onChange={e => {
                                  const newRole = e.target.value;
                                  handleInputChange('role', newRole);
                                  if (newRole === 'demo' && !formData.expiresAt) {
                                    const d = new Date();
                                    d.setHours(d.getHours() + 72);
                                    handleInputChange('expiresAt', d.toISOString().slice(0, 16));
                                  }
                                }} 
                               className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-[11px] uppercase outline-none cursor-pointer ${editingUser?.tenantId === 'MASTER' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin' ? (
                                    <option value="admin">Administrador Master</option>
                                ) : (
                                    <>
                                        <option value="customer">Cliente Pagante</option>
                                        <option value="demo">Conta Demo (Testes)</option>
                                        <option value="admin">Administrador (Acesso Completo)</option>
                                    </>
                                )}
                            </select>
                        </div>
                        
                             {formData.role === 'demo' && editingUser && (
                                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Criação</p>
                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{editingUser.createdAt ? new Date(editingUser.createdAt).toLocaleString('pt-BR') : '---'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Aprovação</p>
                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{editingUser.approvedAt ? new Date(editingUser.approvedAt).toLocaleString('pt-BR') : '---'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Expiração (72h)</p>
                                        <p className="text-[10px] font-bold text-rose-500">{editingUser.expiresAt ? new Date(editingUser.expiresAt).toLocaleString('pt-BR') : '---'}</p>
                                    </div>
                                </div>
                             )}

                        {formData.role === 'customer' && (
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                                <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.planName ? 'text-rose-600' : 'text-slate-400'}`}>Escolher Plano *</label>
                                <select 
                                disabled={editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin'}
                                value={formData.planName} 
                                onChange={e => handleInputChange('planName', e.target.value)} 
                                className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-[11px] uppercase outline-none ${editingUser?.tenantId === 'MASTER' ? 'opacity-60 cursor-not-allowed' : ''} ${formErrors.planName ? 'ring-2 ring-rose-500' : ''}`}
                                >
                                    {editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin' ? (
                                        <option value="">MASTER VITALÍCIO</option>
                                    ) : (
                                        <>
                                            <option value="">SELECIONE UM PLANO</option>
                                            {plans.map(p => (
                                                <option key={p.id} value={p.name}>{p.name} - R$ {p.price.toFixed(2)} / {p.days}D</option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>

                    {(formData.role === 'customer' || formData.role === 'demo') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                                <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.expiresAt ? 'text-rose-600' : 'text-slate-400'}`}>Validade do Plano {formData.role === 'demo' ? '*' : '(Opcional)'}</label>
                                 <input 
                                    type={formData.role === 'demo' ? "datetime-local" : "date"} 
                                    value={formData.role === 'demo' ? (formData.expiresAt.includes('T') ? formData.expiresAt.slice(0, 16) : formData.expiresAt) : (formData.expiresAt.includes('T') ? formData.expiresAt.split('T')[0] : formData.expiresAt)} 
                                    onChange={e => handleInputChange('expiresAt', e.target.value)} 
                                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-sm uppercase outline-none ${formErrors.expiresAt ? 'ring-2 ring-rose-500' : ''}`} 
                                 />
                            </div>
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                                <label className={`text-[10px] font-black uppercase ml-2 text-slate-400`}>Carência (Dias)</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    step="1"
                                    value={formData.gracePeriod} 
                                    onChange={e => handleInputChange('gracePeriod', e.target.value === '' ? '' : parseInt(e.target.value))} 
                                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-sm uppercase outline-none`} 
                                />
                            </div>
                        </div>
                    )}
                 </div>

                 <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Salvar Registro</button>
              </form>
           </div>
        </div>
       )}

       {confirmModal?.show && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
             <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-6 shadow-2xl border border-white/10">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase mb-2">{confirmModal.title}</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase mb-6">{confirmModal.message}</p>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setConfirmModal(null)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                   <button onClick={confirmModal.action} className={`py-3 rounded-xl text-white font-black text-[9px] uppercase shadow-lg ${confirmModal.type === 'success' ? 'bg-emerald-500' : 'bg-rose-600'}`}>Confirmar</button>
                </div>
             </div>
          </div>
       )}

       {isCategoryModalOpen && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/5">
               <div className="p-6 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                  <div>
                     <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Categorias de Estabelecimento</h3>
                     <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Gerenciamento Global</p>
                  </div>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
               </div>

               <div className="p-6 space-y-6">
                  <div className="flex gap-2">
                     <input 
                        placeholder="NOVA CATEGORIA..." 
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value.toUpperCase())}
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                     />
                     <button 
                        onClick={async () => {
                           if (!newCategoryName.trim()) return;
                           if (globalCategories.includes(newCategoryName.trim())) {
                              alert("Esta categoria já existe.");
                              return;
                           }
                           const updated = [...globalCategories, newCategoryName.trim()];
                           await saveGlobalEstablishmentCategories(updated);
                           setGlobalCategories(updated);
                           setNewCategoryName('');
                           notifyDataChanged();
                        }}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                     >
                        Adicionar
                     </button>
                  </div>

                  <div className="relative">
                     <input 
                        value={categorySearch}
                        onChange={e => setCategorySearch(e.target.value.toUpperCase())}
                        placeholder="PESQUISAR CATEGORIA..." 
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none shadow-inner" 
                     />
                     <svg className="w-4 h-4 text-slate-300 absolute left-3.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={3}/></svg>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                     {globalCategories
                        .filter(cat => cat.toUpperCase().includes(categorySearch.toUpperCase()))
                        .map(cat => (
                        <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group">
                           {editingCategory?.old === cat ? (
                              <input 
                                 autoFocus
                                 value={editingCategory.new}
                                 onChange={e => setEditingCategory({ ...editingCategory, new: e.target.value.toUpperCase() })}
                                 onBlur={async () => {
                                    if (editingCategory.new.trim() && editingCategory.new !== editingCategory.old) {
                                       if (globalCategories.includes(editingCategory.new.trim())) {
                                          alert("Esta categoria já existe.");
                                          setEditingCategory(null);
                                          return;
                                       }
                                       const updated = globalCategories.map(c => c === editingCategory.old ? editingCategory.new.trim() : c);
                                       await saveGlobalEstablishmentCategories(updated);
                                       setGlobalCategories(updated);
                                       
                                       // Atualizar usuários que usam essa categoria
                                       const allUsers = await getUsers();
                                       const updatedUsers = allUsers.map(u => u.category === editingCategory.old ? { ...u, category: editingCategory.new.trim() } : u);
                                       await saveUsers(updatedUsers);
                                    }
                                    setEditingCategory(null);
                                    notifyDataChanged();
                                 }}
                                 className="bg-white dark:bg-slate-700 px-2 py-1 rounded font-black text-[10px] uppercase outline-none ring-1 ring-indigo-500"
                              />
                           ) : (
                              <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">{cat}</span>
                           )}
                           
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                 onClick={() => setEditingCategory({ old: cat, new: cat })}
                                 className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              >
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg>
                              </button>
                              <button 
                                 onClick={async () => {
                                    const isUsedInUsers = users.some(u => u.category === cat);
                                    const isUsedInRequests = requests.some(r => r.category === cat);
                                    
                                    if (isUsedInUsers || isUsedInRequests) {
                                       alert("Não é possível excluir: Esta categoria está sendo usada por usuários ou solicitações.");
                                       return;
                                    }
                                    
                                    if (confirm(`Deseja excluir a categoria "${cat}"?`)) {
                                       const updated = globalCategories.filter(c => c !== cat);
                                       await saveGlobalEstablishmentCategories(updated);
                                       setGlobalCategories(updated);
                                       notifyDataChanged();
                                    }
                                 }}
                                 className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                              >
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg>
                              </button>
                           </div>
                        </div>
                     ))}
                     {globalCategories.length === 0 && (
                        <p className="text-center py-8 text-[9px] font-bold text-slate-400 uppercase italic">Nenhuma categoria cadastrada</p>
                     )}
                  </div>
               </div>
            </div>
         </div>
       )}
    </div>
  );
}