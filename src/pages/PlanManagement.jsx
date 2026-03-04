import React, { useState, useEffect, useMemo } from 'react';
import { 
  getGlobalPlans, saveGlobalPlans, getUsers, saveUsers, 
  getCustomers, saveCustomers, getAccessRequests, notifyDataChanged 
} from '../services/storage';

const PlanManagement = () => {
  const [plans, setPlans] = useState([]);
  const [activeTab, setActiveTab] = useState('general');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [searchPersonalized, setsearchPersonalized] = useState('');
  
  // Estado de erros para feedback visual
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    days: 30,
    price: 0,
    standardPrice: 0,
    description: '',
    isPersonalized: false,
    linkedDocument: ''
  });

  // Novo estado para o formulário de usuário (cópia do UserManagement)
  const [userFormData, setUserFormData] = useState({
    name: '',
    establishmentName: '',
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
    createdManually: true,
    gracePeriod: 10
  });

  const [foundUser, setFoundUser] = useState(null);
  const [docError, setDocError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [systemUsers, setSystemUsers] = useState([]);

  useEffect(() => {
    const loadInitialData = async () => {
        await refreshPlans();
        const users = await getUsers();
        setSystemUsers(users);
    };
    loadInitialData();
  }, []);

  // Efeito para calcular validade automaticamente em planos personalizados
  useEffect(() => {
    if (formData.isPersonalized && !editingPlan && formData.days && !userFormData.expiresAt) {
      const d = new Date();
      d.setDate(d.getDate() + Number(formData.days));
      setUserFormData(prev => ({ ...prev, expiresAt: d.toISOString().split('T')[0] }));
    }
  }, [formData.days, formData.isPersonalized, editingPlan]);

  const refreshPlans = async () => {
    try {
        const p = await getGlobalPlans();
        setPlans(Array.isArray(p) ? p : []);
    } catch (e) {
        setPlans([]);
    }
  };

  const getClientNameByDoc = (doc) => {
    if (!doc) return '---';
    const cleanDoc = doc.replace(/\D/g, '');
    const user = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
    return user ? user.name : 'USUÁRIO NÃO LOCALIZADO';
  };

  const getUserStatusByDoc = (doc) => {
    if (!doc) return 'inactive';
    const cleanDoc = doc.replace(/\D/g, '');
    const user = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
    return user && user.active ? 'active' : 'inactive';
  };

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

  const verifyDocument = (doc) => {
    const cleanDoc = doc.replace(/\D/g, '');
    if (cleanDoc.length < 11) {
      setFoundUser(null);
      setDocError('');
      return;
    }
    const userMatch = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
    if (userMatch) {
      setFoundUser(userMatch);
      setDocError('');
      setFormErrors(prev => {
          const next = {...prev};
          delete next.linkedDocument;
          return next;
      });
    } else {
      setFoundUser(null);
      if (cleanDoc.length === 11 || cleanDoc.length === 14) {
        setDocError('Usuário não localizado no sistema');
      }
    }
  };

  const formatWhatsApp = (val) => {
    const v = val.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 10) return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  };

  const handleUserInputChange = (field, value) => {
    let updated = { ...userFormData, [field]: value };
    
    if (field === 'document') {
        const rawValue = String(value);
        // Lógica para separar nome e documento se colado junto (ex: "JOAO SILVA 12345678901")
        if (/[a-zA-Z]/.test(rawValue) && /\d{11}/.test(rawValue)) {
            const docMatch = rawValue.match(/\d{11,14}/);
            if (docMatch) {
                const doc = docMatch[0];
                const namePart = rawValue.replace(doc, '').replace(/[-–—]/g, '').trim();
                if (namePart) {
                    updated.name = namePart.toUpperCase();
                }
                updated.document = formatDocument(doc);
                verifyDocument(doc);
                setUserFormData(updated);
                return;
            }
        }
        verifyDocument(value);
    }
    
    if (field === 'role') {
        if (value === 'demo') {
            updated.planName = '';
            updated.expiresAt = ''; 
        } else if (value === 'customer') {
            updated.planName = ''; 
            updated.expiresAt = ''; 
        }
    }
    
    if (field === 'planName' && userFormData.role === 'customer') {
        const selectedPlan = plans.find(p => p.name === value);
        if (selectedPlan) {
            const d = new Date();
            d.setDate(d.getDate() + selectedPlan.days);
            updated.expiresAt = d.toISOString().split('T')[0];
        }
    }

    setUserFormData(updated);
    
    if (formErrors[field]) {
        const newErrors = { ...formErrors };
        delete newErrors[field];
        setFormErrors(newErrors);
    }
  };

  const handleOpenModal = (plan) => {
    setFoundUser(null);
    setDocError('');
    setFormErrors({});
    
    if (plan) {
      setEditingPlan(plan);
      setFormData(plan);
      
      if (plan.isPersonalized && plan.linkedDocument) {
        const cleanDoc = plan.linkedDocument.replace(/\D/g, '');
        const userMatch = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
        if (userMatch) {
          setFoundUser(userMatch);
          setUserFormData({
            name: userMatch.name,
            establishmentName: userMatch.tenantId,
            document: formatDocument(userMatch.document || ''),
            whatsapp: formatWhatsApp(userMatch.whatsapp || ''),
            whatsappConfirmed: true,
            email: userMatch.email,
            passwordHash: userMatch.passwordHash,
            role: userMatch.role,
            planName: userMatch.planName || '',
            expiresAt: userMatch.expiresAt || '',
            active: userMatch.active,
            originIp: userMatch.originIp || '',
            originLocation: userMatch.originLocation || '',
            createdManually: userMatch.createdManually || false,
            gracePeriod: userMatch.gracePeriod ?? 10
          });
        } else {
          // Se não achar o usuário, reseta o form de usuário
          setUserFormData({
            name: '', establishmentName: '', document: formatDocument(plan.linkedDocument || ''), whatsapp: '', whatsappConfirmed: false,
            email: '', passwordHash: '', role: 'customer', planName: plan.name, expiresAt: '', active: true,
            originIp: '', originLocation: '', createdManually: true, gracePeriod: 10
          });
        }
      }
    } else {
      setEditingPlan(null);
      const isPersonalized = activeTab === 'personalized';
      setFormData({ 
        name: '', 
        days: 30, 
        price: 0, 
        standardPrice: 0,
        description: '', 
        isPersonalized: isPersonalized, 
        linkedDocument: '' 
      });
      setUserFormData({
        name: '', establishmentName: '', document: '', whatsapp: '', whatsappConfirmed: false,
        email: '', passwordHash: '', role: 'customer', 
        planName: '', 
        expiresAt: '', active: true,
        originIp: '', originLocation: '', createdManually: true,
        gracePeriod: 10
      });
    }
    setIsModalOpen(true);
  };

  const validate = () => {
    const errors = {};
    
    if (!formData.isPersonalized) {
        // Validação para Plano Global
        if (!formData.name || !formData.name.trim()) errors.name = 'O nome do plano é obrigatório';
        if (!formData.days || Number(formData.days) <= 0) errors.days = 'Mínimo 1 dia';
        if (formData.price === undefined || Number(formData.price) < 0) errors.price = 'Preço promocional inválido';
    } else {
        // Validação para Plano Personalizado (Cópia do UserManagement)
        const loginClean = userFormData.email.trim().toLowerCase();
        const docClean = userFormData.document.replace(/\D/g, '');

        if (!userFormData.name.trim()) errors.name = 'Obrigatório';
        if (!userFormData.establishmentName.trim()) errors.establishmentName = 'Obrigatório';
        if (!loginClean) errors.email = 'Obrigatório';
        if (!userFormData.passwordHash) errors.passwordHash = 'Obrigatório';
        if (!userFormData.whatsappConfirmed) errors.whatsappConfirmed = 'Confirme o WhatsApp';
        
        if (userFormData.role === 'customer') {
            // No contexto de plano personalizado, o plano é o que estamos criando
            // Mas o form de usuário pede um plano. Vamos deixar passar se o nome do plano for preenchido no form de plano.
            if (!formData.name?.trim()) errors.planName = 'Identificador do plano obrigatório';
        } else if (userFormData.role === 'demo') {
            if (!userFormData.expiresAt) errors.expiresAt = 'Data obrigatória para Demo';
        }

        // Preços (campos extras solicitados)
        if (formData.price === undefined || Number(formData.price) < 0) errors.price = 'Preço atual inválido';
        if (formData.standardPrice === undefined || Number(formData.standardPrice) < 0) errors.standardPrice = 'Preço base inválido';

        // Trava de Unicidade (simplificada para o contexto)
        const existingByLogin = systemUsers.find(u => u.email.toLowerCase() === loginClean && u.id !== foundUser?.id);
        if (existingByLogin) errors.email = 'Este login já está em uso.';

        if (docClean) {
            const existingByDoc = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === docClean && u.id !== foundUser?.id);
            if (existingByDoc) errors.document = 'Este documento já está vinculado a outra conta.';

            const existingPlanByDoc = plans.find(p => p.isPersonalized && (p.linkedDocument || '').replace(/\D/g, '') === docClean && p.id !== editingPlan?.id);
            if (existingPlanByDoc) errors.document = 'Já existe um plano personalizado para este documento.';
        }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSaving(true);
    try {
        const planNameUpper = formData.name.toUpperCase();
        let linkedDoc = (formData.linkedDocument || '').replace(/\D/g, '');

        if (formData.isPersonalized) {
            // 1. Salvar/Atualizar Usuário (Lógica do UserManagement)
            const allUsers = await getUsers();
            const docClean = userFormData.document.replace(/\D/g, '');
            const loginClean = userFormData.email.trim().toLowerCase();
            linkedDoc = docClean;

            const calculateExpiry = () => {
                if (userFormData.expiresAt) return userFormData.expiresAt;
                if (formData.days && Number(formData.days) > 0) {
                    const d = new Date();
                    d.setDate(d.getDate() + Number(formData.days));
                    return d.toISOString().split('T')[0];
                }
                return undefined;
            };

            const newUser = {
                id: foundUser ? foundUser.id : 'user-' + Math.random().toString(36).substr(2, 9),
                name: userFormData.name.toUpperCase(),
                tenantId: userFormData.establishmentName.toUpperCase(),
                email: loginClean,
                passwordHash: userFormData.passwordHash,
                role: userFormData.role,
                active: userFormData.active,
                document: docClean,
                whatsapp: userFormData.whatsapp.replace(/\D/g, ''),
                planName: planNameUpper,
                expiresAt: (userFormData.role === 'customer' || userFormData.role === 'demo') ? calculateExpiry() : undefined,
                createdAt: foundUser?.createdAt || new Date().toISOString(),
                permissions: foundUser?.permissions || ['dashboard', 'new-sale', 'tables', 'deliveries', 'products', 'categories', 'expenses', 'sales-history', 'reports'],
                originIp: foundUser?.originIp || userFormData.originIp,
                originLocation: foundUser?.originLocation || userFormData.originLocation,
                createdManually: foundUser ? foundUser.createdManually : true,
                gracePeriod: (userFormData.role === 'customer' || userFormData.role === 'demo') ? Number(userFormData.gracePeriod) : undefined
            };

            let updatedUsers;
            if (foundUser) updatedUsers = allUsers.map(u => u.id === foundUser.id ? newUser : u);
            else updatedUsers = [...allUsers, newUser];
            
            await saveUsers(updatedUsers);
            setSystemUsers(updatedUsers);

            // 2. Salvar/Atualizar Customer (Lógica do UserManagement)
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
        }

        // 3. Salvar/Atualizar Plano
        const newPlan = {
          id: editingPlan ? editingPlan.id : Math.random().toString(36).substr(2, 9),
          name: planNameUpper,
          days: Number(formData.days),
          price: Number(formData.price),
          standardPrice: formData.isPersonalized ? Number(formData.standardPrice) : Number(formData.price),
          description: formData.description || '',
          isPersonalized: !!formData.isPersonalized,
          linkedDocument: linkedDoc
        };

        const currentPlans = await getGlobalPlans();
        const safePlans = Array.isArray(currentPlans) ? currentPlans : [];
        let updatedPlans;
        if (editingPlan) {
          updatedPlans = safePlans.map(p => p.id === editingPlan.id ? newPlan : p);
        } else {
          updatedPlans = [...safePlans, newPlan];
        }

        await saveGlobalPlans(updatedPlans);
        setPlans(updatedPlans);
        
        setIsModalOpen(false);
        notifyDataChanged();
        refreshPlans();
    } catch (err) {
        console.error("Erro ao salvar:", err);
        alert("Erro técnico ao salvar. Verifique os campos.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
        const currentPlans = await getGlobalPlans();
        const updated = (Array.isArray(currentPlans) ? currentPlans : []).filter(p => p.id !== confirmDeleteId);
        await saveGlobalPlans(updated);
        setPlans(updated);
        setConfirmDeleteId(null);
    } catch (e) {
        alert("Erro ao excluir.");
    }
  };

  const generalPlansList = plans.filter(p => !p.isPersonalized);
  const filteredPersonalizedPlans = useMemo(() => {
    const list = plans.filter(p => p.isPersonalized);
    if (!searchPersonalized) return list;
    const searchLower = searchPersonalized.toLowerCase();
    return list.filter(plan => 
      getClientNameByDoc(plan.linkedDocument).toLowerCase().includes(searchLower) || 
      plan.linkedDocument?.includes(searchPersonalized)
    );
  }, [plans, searchPersonalized, systemUsers]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Ofertas e Planos</h3>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">Configure os preços e promoções do seu ecossistema.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          {activeTab === 'general' ? 'Novo Plano Global' : 'Criar Plano Personalizado'}
        </button>
      </div>

      <div className="flex md:justify-center overflow-x-auto pb-2 px-4 md:px-0">
          <div className="bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full flex shadow-inner whitespace-nowrap">
              <button 
                  onClick={() => setActiveTab('general')} 
                  className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
              >
                  Planos Globais
                  <span className="ml-2 bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded-full text-[8px] font-bold">{generalPlansList.length}</span>
              </button>
              <button 
                  onClick={() => setActiveTab('personalized')} 
                  className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'personalized' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
              >
                  Planos Personalizados
                  <span className="ml-2 bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded-full text-[8px] font-bold">{plans.filter(p => p.isPersonalized).length}</span>
              </button>
          </div>
      </div>

      {activeTab === 'general' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {generalPlansList.map(plan => (
            <div key={plan.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-lg flex flex-col justify-between hover:border-indigo-500 transition-all relative group overflow-hidden">
               <div className="relative z-10 space-y-4">
                  <div>
                     <h4 className="text-xl font-black uppercase italic text-slate-900 dark:text-white tracking-tighter">{plan.name}</h4>
                     <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{plan.days} Dias</p>
                  </div>
                  <div className="py-4 border-y border-slate-100 dark:border-slate-800">
                     <span className="text-3xl font-black text-indigo-600 italic tracking-tighter">R$ {plan.price.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase">{plan.description || 'Nenhuma descrição.'}</p>
               </div>
               <div className="grid grid-cols-2 gap-3 mt-6">
                  <button onClick={() => handleOpenModal(plan)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-black uppercase text-[9px] tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors">Editar</button>
                  <button onClick={() => setConfirmDeleteId(plan.id)} className="py-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl font-black uppercase text-[9px] tracking-widest border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 transition-colors">Excluir</button>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
           <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <svg className="w-5 h-5 text-indigo-600 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5} /></svg>
              <input 
                 value={searchPersonalized}
                 onChange={e => setsearchPersonalized(e.target.value)}
                 placeholder="BUSCAR CLIENTE OU DOCUMENTO..."
                 className="flex-1 bg-transparent border-none outline-none font-black text-[10px] uppercase tracking-widest text-slate-800 dark:text-white"
              />
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left">
                 <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cliente</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Plano</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Status</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Preço Promo</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Preço Renovação</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPersonalizedPlans.map(plan => (
                       <tr key={plan.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-8 py-4">
                             <p className="text-[11px] font-black text-slate-950 dark:text-white uppercase italic">{getClientNameByDoc(plan.linkedDocument)}</p>
                             <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase">{formatDocument(plan.linkedDocument)}</p>
                          </td>
                          <td className="px-8 py-4"><span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">{plan.name}</span></td>
                          <td className="px-8 py-4 text-center">
                             {getUserStatusByDoc(plan.linkedDocument) === 'active' ? (
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest">Ativo</span>
                             ) : (
                                <span className="px-3 py-1 bg-rose-500/10 text-rose-600 rounded-full text-[8px] font-black uppercase tracking-widest">Inativo</span>
                             )}
                          </td>
                          <td className="px-8 py-4 text-center"><span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 italic">R$ {plan.price.toFixed(2)}</span></td>
                          <td className="px-8 py-4 text-center"><span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">R$ {(plan.standardPrice || plan.price).toFixed(2)}</span></td>
                          <td className="px-8 py-4 text-right">
                             <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenModal(plan)} className="p-2 text-slate-600 hover:text-indigo-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg></button>
                                <button onClick={() => setConfirmDeleteId(plan.id)} className="p-2 text-slate-600 hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg></button>
                             </div>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* MODAL EDIT/NEW */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className={`bg-white dark:bg-slate-900 w-full ${formData.isPersonalized ? 'max-w-2xl' : 'max-w-md'} rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar border border-white/20`}>
               <div className="p-8 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center sticky top-0 z-10">
                  <div>
                     <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                       {editingPlan ? (formData.isPersonalized ? 'Ficha do Plano Personalizado' : 'Configurações do Plano') : (formData.isPersonalized ? 'Novo Plano Personalizado' : 'Novo Plano Global')}
                     </h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                        {formData.isPersonalized ? 'Configuração de Acesso e Oferta' : 'Configuração de Oferta Global'}
                     </p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
               </div>
               
               <form onSubmit={handleSave} className="p-10 space-y-8">
                  {formData.isPersonalized && formErrors.document && (
                    <div className="bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-500/30 p-5 rounded-2xl animate-in slide-in-from-top-2">
                       <div className="flex items-center gap-3">
                          <div className="bg-rose-500 text-white p-1.5 rounded-lg">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={3}/></svg>
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Documento Duplicado</p>
                             <p className="text-[9px] font-bold text-rose-500/80 uppercase mt-0.5">{formErrors.document}</p>
                          </div>
                       </div>
                    </div>
                  )}
                  {!formData.isPersonalized ? (
                    /* FORMULÁRIO PLANO GLOBAL (ORIGINAL) */
                    <div className="space-y-5">
                       <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.name ? 'text-rose-600' : 'text-slate-500'}`}>Identificador do Plano *</label>
                          <input 
                            autoFocus 
                            required 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                            className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.name ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                            placeholder="EX: TRIMESTRAL VIP" 
                          />
                          {formErrors.name && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">⚠️ {formErrors.name}</p>}
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.days ? 'text-rose-600' : 'text-slate-500'}`}>Duração (Dias)</label>
                             <input 
                               required 
                               type="number" 
                               value={formData.days} 
                               onChange={e => setFormData({...formData, days: Number(e.target.value)})} 
                               className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.days ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                             />
                          </div>
                          <div className="space-y-1">
                             <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.price ? 'text-rose-600' : 'text-slate-500'}`}>Preço Atual (R$)</label>
                             <input 
                               required 
                               type="number" 
                               step="0.01" 
                               value={formData.price === 0 ? '' : formData.price} 
                               onFocus={e => e.target.select()}
                               onChange={e => setFormData({...formData, price: e.target.value === '' ? 0 : Number(e.target.value)})} 
                               className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.price ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                             />
                          </div>
                       </div>

                       <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase ml-2 text-slate-500">Descrição (Opcional)</label>
                          <textarea 
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})} 
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" 
                            rows={3}
                            placeholder="Descreva os benefícios deste plano..."
                          />
                       </div>
                    </div>
                  ) : (
                    /* FORMULÁRIO PLANO PERSONALIZADO (CÓPIA DO USERMANAGEMENT + CAMPOS EXTRAS) */
                    <div className="space-y-8">
                       <div className="space-y-6">
                          <div className="space-y-1">
                              <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.name ? 'text-rose-600' : 'text-slate-400'}`}>Nome Completo *</label>
                              <input placeholder="Digite o nome completo" value={userFormData.name} onChange={e => handleUserInputChange('name', e.target.value.toUpperCase())} className={`w-full px-6 py-5 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${formErrors.name ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-indigo-500'}`} />
                          </div>
                          <div className="space-y-1">
                              <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.establishmentName ? 'text-rose-600' : 'text-slate-400'}`}>ID Empresa / Tenant *</label>
                              <input 
                                 placeholder="Digite o nome do estabelecimento"
                                 disabled={foundUser?.tenantId === 'MASTER' && foundUser?.role === 'admin'}
                                 value={userFormData.establishmentName} 
                                 onChange={e => handleUserInputChange('establishmentName', e.target.value.toUpperCase())} 
                                 className={`w-full px-6 py-5 border-2 rounded-2xl font-black text-base outline-none transition-all ${foundUser?.tenantId === 'MASTER' ? 'bg-slate-100 opacity-60 cursor-not-allowed' : ''} ${formErrors.establishmentName ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-indigo-500'}`} 
                              />
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                              <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.document ? 'text-rose-600' : 'text-slate-400'}`}>CPF ou CNPJ *</label>
                              <input 
                                  placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                                  value={userFormData.document} 
                                  onChange={e => {
                                      const val = e.target.value;
                                      if (/[a-zA-Z]/.test(val) && /\d{11}/.test(val)) {
                                          handleUserInputChange('document', val);
                                      } else {
                                          handleUserInputChange('document', formatDocument(val));
                                      }
                                  }} 
                                  className={`w-full px-6 py-5 border-2 rounded-2xl font-black text-base outline-none bg-slate-50 dark:bg-slate-800 dark:text-white transition-all ${formErrors.document ? 'border-rose-500 focus:border-rose-500' : 'border-transparent focus:border-indigo-500'}`} 
                              />
                              {formErrors.document && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.document}</p>}
                          </div>
                          <div className="space-y-1">
                              <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.whatsapp ? 'text-rose-600' : 'text-slate-400'}`}>WhatsApp *</label>
                              <input 
                                  placeholder="Digite o WhatsApp com DDD" 
                                  value={userFormData.whatsapp} 
                                  onChange={e => handleUserInputChange('whatsapp', formatWhatsApp(e.target.value))} 
                                  className={`w-full px-6 py-5 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${formErrors.whatsapp ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-emerald-500'}`} 
                              />
                              {formErrors.whatsapp && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.whatsapp}</p>}
                          </div>
                       </div>

                       <div 
                          onClick={() => handleUserInputChange('whatsappConfirmed', !userFormData.whatsappConfirmed)} 
                          className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${userFormData.whatsappConfirmed ? 'bg-emerald-50 border-emerald-500/30' : formErrors.whatsappConfirmed ? 'bg-rose-50 border-rose-500/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/40 dark:border-slate-800'}`}
                       >
                          <div className="flex-1">
                             <span className={`text-[10px] font-black uppercase tracking-widest ${userFormData.whatsappConfirmed ? 'text-emerald-700' : formErrors.whatsappConfirmed ? 'text-rose-600' : 'text-slate-500'}`}>Confirmo o contato do usuário</span>
                             {formErrors.whatsappConfirmed && <p className="text-[8px] font-bold text-rose-600 mt-1 uppercase italic">{formErrors.whatsappConfirmed}</p>}
                          </div>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors ${userFormData.whatsappConfirmed ? 'bg-emerald-500 border-emerald-500' : formErrors.whatsappConfirmed ? 'bg-white border-rose-500' : 'bg-white border-slate-300'}`}>
                              {userFormData.whatsappConfirmed && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>}
                          </div>
                       </div>

                       <div className="space-y-6 pt-4 border-t dark:border-white/5">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 ml-2 italic">Acesso ao Sistema</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div className="space-y-1">
                                  <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.email ? 'text-rose-600' : 'text-slate-400'}`}>Usuário (Login) *</label>
                                  <input placeholder="Digite o login de acesso" value={userFormData.email} onChange={e => handleUserInputChange('email', e.target.value.toLowerCase())} className={`w-full px-5 py-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all bg-white dark:bg-slate-800 dark:text-white ${formErrors.email ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'}`} />
                                  {formErrors.email && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.email}</p>}
                              </div>
                              <div className="space-y-1">
                                  <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.passwordHash ? 'text-rose-600' : 'text-slate-400'}`}>Senha *</label>
                                  <input placeholder="Digite uma senha" type="text" value={userFormData.passwordHash} onChange={e => handleUserInputChange('passwordHash', e.target.value)} className={`w-full px-5 py-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all bg-white dark:bg-slate-800 dark:text-white ${formErrors.passwordHash ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'}`} />
                              </div>
                          </div>
                       </div>

                       <div className="space-y-6 pt-4 border-t dark:border-white/5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Conta</label>
                                  <select 
                                     disabled={foundUser?.tenantId === 'MASTER' && foundUser?.role === 'admin'}
                                     value={userFormData.role} 
                                     onChange={e => handleUserInputChange('role', e.target.value)} 
                                     className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-[11px] uppercase outline-none cursor-pointer ${foundUser?.tenantId === 'MASTER' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                  >
                                      {foundUser?.tenantId === 'MASTER' && foundUser?.role === 'admin' ? (
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
                              
                              <div className="space-y-1 animate-in slide-in-from-top-2">
                                  <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.planName ? 'text-rose-600' : 'text-slate-400'}`}>Identificador do Plano *</label>
                                  <input 
                                    required 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.planName ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                                    placeholder="EX: VIP CUSTOM" 
                                  />
                              </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                              <div className="space-y-1 animate-in slide-in-from-top-2">
                                  <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.expiresAt ? 'text-rose-600' : 'text-slate-400'}`}>Validade do Plano {userFormData.role === 'demo' ? '*' : '(Opcional)'}</label>
                                  <input type="date" value={userFormData.expiresAt} onChange={e => handleUserInputChange('expiresAt', e.target.value)} className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-sm uppercase outline-none ${formErrors.expiresAt ? 'ring-2 ring-rose-500' : ''}`} />
                              </div>
                              <div className="space-y-1 animate-in slide-in-from-top-2">
                                  <label className={`text-[10px] font-black uppercase ml-2 text-slate-400`}>Carência (Dias)</label>
                                  <input 
                                      type="number" 
                                      min="0"
                                      step="1"
                                      value={userFormData.gracePeriod} 
                                      onChange={e => handleUserInputChange('gracePeriod', e.target.value === '' ? '' : parseInt(e.target.value))} 
                                      className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-sm uppercase outline-none`} 
                                  />
                              </div>
                          </div>

                          {/* CAMPOS EXTRAS SOLICITADOS: PREÇO ATUAL E PREÇO BASE DE RENOVAÇÃO */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                              <div className="space-y-1">
                                 <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.price ? 'text-rose-600' : 'text-slate-400'}`}>Preço Atual (R$) *</label>
                                 <input 
                                   required 
                                   type="number" 
                                   step="0.01" 
                                   value={formData.price === 0 ? '' : formData.price} 
                                   onFocus={e => e.target.select()}
                                   onChange={e => setFormData({...formData, price: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                   className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.price ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.standardPrice ? 'text-rose-600' : 'text-slate-400'}`}>Preço Base de Renovação (R$) *</label>
                                 <input 
                                   required 
                                   type="number" 
                                   step="0.01" 
                                   value={formData.standardPrice === 0 ? '' : formData.standardPrice} 
                                   onFocus={e => e.target.select()}
                                   onChange={e => setFormData({...formData, standardPrice: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                   className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.standardPrice ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                                 />
                              </div>
                           </div>
                          
                          <div className="space-y-1 pt-4">
                             <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.days ? 'text-rose-600' : 'text-slate-400'}`}>Duração do Ciclo (Dias) *</label>
                             <input 
                               required 
                               type="number" 
                               value={formData.days} 
                               onChange={e => setFormData({...formData, days: Number(e.target.value)})} 
                               className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.days ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                             />
                          </div>
                       </div>
                    </div>
                  )}

                  <button 
                     type="submit" 
                     disabled={isSaving}
                     className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all mt-4 flex items-center justify-center gap-2"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar no Sistema'}
                  </button>
               </form>
            </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDeleteId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-6 shadow-2xl border border-white/10">
                <h3 className="text-lg font-black text-slate-950 dark:text-white uppercase italic tracking-tighter mb-1">Excluir Plano?</h3>
                <p className="text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase mb-6 leading-relaxed">Deseja remover esta oferta permanentemente?</p>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setConfirmDeleteId(null)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors">Voltar</button>
                   <button onClick={handleDelete} className="py-3 bg-rose-600 text-white font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Confirmar</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default PlanManagement;