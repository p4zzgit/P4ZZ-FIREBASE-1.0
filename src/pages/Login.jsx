import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  getUsers, setCurrentUser, saveAccessRequest,
  savePaymentRequest,
  getGlobalEstablishmentCategories, getGlobalPlans, getAppSettings,
  getAccessRequests, loginWithFirebase, USE_FIREBASE
} from '../services/storage';
import { createPixPayment, checkPaymentStatus } from '../services/mercadoPago';

// --- HELPERS DE FORMATAÇÃO ---

const formatCPF_CNPJ = (val) => {
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

const formatPhone = (val) => {
  const v = val.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

// Helpers de Mascaramento de Segurança
const maskDocumentSafe = (val = '') => {
  const v = val.replace(/\D/g, '');
  if (v.length === 11) return `${v.slice(0, 3)}.***.***-${v.slice(-2)}`;
  if (v.length === 14) return `${v.slice(0, 2)}.***.***/****-${v.slice(-2)}`;
  return v.length > 2 ? `${v.slice(0, 2)}...${v.slice(-2)}` : v;
};

const maskPhoneSafe = (val = '') => {
  const v = val.replace(/\D/g, '');
  if (v.length >= 10) return `(${v.slice(0, 2)}) *****-**${v.slice(-2)}`;
  return v;
};

import { MarketingSection } from '../components/MarketingSection';
import { LoginEffects } from '../components/LoginEffects';

export const Login = ({ settings, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showPublicPayment, setShowPublicPayment] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showPendingBlockModal, setShowPendingBlockModal] = useState(false);
  
  const [reqCategory, setReqCategory] = useState('');
  const [reqPlan, setReqPlan] = useState('');
  const [reqName, setReqName] = useState('');
  const [reqLogin, setReqLogin] = useState('');
  const [reqPassword, setReqPassword] = useState('');
  const [reqDocument, setReqDocument] = useState('');
  const [reqWhatsapp, setReqWhatsapp] = useState('');
  const [reqWhatsappConfirmed, setReqWhatsappConfirmed] = useState(false);
  const [requestSuccess, setReqSuccess] = useState(false);
  
  const [fieldErrors, setFieldErrors] = useState({});

  const [searchDoc, setSearchDoc] = useState('');
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [paymentStep, setPaymentStep] = useState('search');
  const [paymentMode, setPaymentMode] = useState('pix');
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [pixStatus, setPixStatus] = useState('pending');
  const [receiptImg, setReceiptImg] = useState('');
  const [fileError, setFileError] = useState(null);
  const [confirmValueChecked, setConfirmValueChecked] = useState(false);
  const [triedManualSubmit, setTriedManualSubmit] = useState(false); 
  const fileInputRef = useRef(null);
  const loginBoxRef = useRef(null);
  
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [pixAmount, setPixAmount] = useState(0);

  const [masterSettings, setMasterSettings] = useState(null);
  
  const refreshMasterSettings = useCallback(() => {
    getAppSettings('MASTER').then(setMasterSettings);
  }, []);

  useEffect(() => {
    refreshMasterSettings();
    window.addEventListener('p4zz_data_updated', refreshMasterSettings);
    return () => window.removeEventListener('p4zz_data_updated', refreshMasterSettings);
  }, [refreshMasterSettings]);

  const safeSettings = useMemo(() => {
    if (!masterSettings) return settings;
    return { ...settings, ...masterSettings };
  }, [settings, masterSettings]);

  // Função para obter classes de animação
  const getAnimClass = (type?: string) => {
    switch (type) {
      case 'fade-in': return 'animate-in fade-in duration-1000';
      case 'slide': return 'animate-in slide-in-from-left-12 duration-1000';
      case 'bounce': return 'animate-bounce';
      case 'pulse': return 'animate-pulse';
      case 'glitch': return 'animate-pulse skew-x-12'; // Simulação simples de glitch
      default: return '';
    }
  };

  const primaryColor = safeSettings.primaryColor || '#00BFFF';

  useEffect(() => {
    if (showRequestModal || showPlansModal) {
        getGlobalEstablishmentCategories().then(setAvailableCategories);
        getGlobalPlans().then(plans => setAvailablePlans(plans.filter(p => !p.isPersonalized)));
    }
  }, [showRequestModal, showPlansModal]);

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setIsSubmitting(true);
    try {
        if (USE_FIREBASE) {
          try {
            // Tenta login no Firebase Auth
            // Nota: O email deve ser um email válido no Firebase Auth
            // Se o usuário usa apenas um 'username', o Firebase Auth pode falhar se não for formatado como email
            const authEmail = email.includes('@') ? email : `${email}@p4zz.com`;
            await loginWithFirebase(authEmail, password);
          } catch (err) {
            console.warn("Firebase Auth falhou, tentando login legado ou verificando Firestore...");
          }
        }

        const users = await getUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);
        if (!user) { setError('Credenciais inválidas.'); setIsSubmitting(false); return; }
        if (!user.active) { setError(user.deactivatedMessage || 'Conta suspensa.'); setIsSubmitting(false); return; }
        setCurrentUser(user); onLoginSuccess(user);
    } catch (err) { setError('Erro de conexão.'); setIsSubmitting(false); }
  };

  const handleSearchTerminal = async () => {
    const searchClean = searchDoc.replace(/\D/g, '');
    if (searchClean.length < 11) { setSearchError('Número incompleto'); return; }

    const users = await getUsers();
    const user = users.find(u => (u.document || '').replace(/\D/g, '') === searchClean);
    if (user) { 
        const plansList = await getGlobalPlans();
        const matchedPlan = plansList.find(p => p.name === user.planName) || plansList[0];
        setPixAmount(matchedPlan ? matchedPlan.price : 99.90);
        setFoundUser(user); setPaymentStep('method'); setSearchError(''); setFileError(null); setConfirmValueChecked(false); setReceiptImg(''); setTriedManualSubmit(false);
    } else { setSearchError('Terminal não localizado'); }
  };

  const computedStatus = useMemo(() => {
    if (!foundUser) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const deactMsg = (foundUser.deactivatedMessage || '').toUpperCase();
    
    // Bloqueado por Violação/Banimento
    if (!foundUser.active && (deactMsg.includes('BANIDO') || deactMsg.includes('VIOLAÇÃO'))) {
      return { label: 'Bloqueado', color: 'bg-rose-600 text-white', message: 'Acesso bloqueado por violação de termos.', isExpired: true };
    }
    
    // Suspenso Administrativamente
    if (!foundUser.active) {
      return { label: 'Suspenso', color: 'bg-amber-400 text-slate-900', message: 'Terminal suspenso administrativamente ou por inadimplência.', isExpired: true };
    }
    
    if (foundUser.expiresAt) {
      const expiry = new Date(foundUser.expiresAt + 'T12:00:00');
      const graceDays = foundUser.gracePeriod ?? 10;
      const toleranceLimit = new Date(expiry);
      toleranceLimit.setDate(toleranceLimit.getDate() + graceDays);
      
      if (today <= expiry) {
        return { label: 'Ativo', color: 'bg-emerald-500 text-white', message: 'Parabéns, seu plano está ativo.', isExpired: false };
      }
      
      if (today <= toleranceLimit) {
        return { label: 'Em Carência', color: 'bg-amber-500 text-white', message: 'Licença vencida. Regularize para evitar bloqueio.', isExpired: true };
      }
    }
    
    return { label: 'Bloqueado', color: 'bg-rose-600 text-white', message: 'Licença expirada. Efetue o pagamento para reativar.', isExpired: true };
  }, [foundUser]);

  const handlePublicGeneratePix = async () => {
    if (!foundUser?.email || !safeSettings.mercadoPagoAccessToken) {
        alert("Configurações de pagamento incompletas.");
        return;
    }
    setIsGeneratingPix(true);
    try {
      const data = await createPixPayment(pixAmount, `Renovação ${foundUser.name}`, foundUser.email);
      if (data) { setPixData(data); setPixStatus('pending'); }
    } catch (err: any) {
        alert(err.message || "Erro ao gerar PIX");
    } finally { setIsGeneratingPix(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      const maxSize = 15 * 1024 * 1024; 
      if (!allowedTypes.includes(file.type)) {
        setFileError("Arquivo inválido.");
        setReceiptImg('');
        return;
      }
      if (file.size > maxSize) {
        setFileError("Arquivo muito grande.");
        setReceiptImg('');
        return;
      }
      setFileError(null);
      const reader = new FileReader();
      reader.onloadend = () => setReceiptImg(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleReqDocumentChange = (val: string) => {
    setReqDocument(formatCPF_CNPJ(val));
    if (fieldErrors.document) {
      setFieldErrors(prev => { const next = {...prev}; delete next.document; return next; });
    }
  };

  const handleSearchDocChange = (val: string) => {
    setSearchDoc(formatCPF_CNPJ(val));
    if (searchError) setSearchError('');
  };

  const validateRequestForm = async () => {
    const errors: Record<string, string> = {};
    const docClean = reqDocument.replace(/\D/g, '');
    const phoneClean = reqWhatsapp.replace(/\D/g, '');
    const loginClean = reqLogin.trim().toLowerCase();
    
    if (!reqName.trim()) errors.name = 'Obrigatório.';
    if (docClean.length < 11) errors.document = 'Número incompleto.';
    if (phoneClean.length < 11) errors.whatsapp = 'WhatsApp incompleto.';
    if (!reqCategory) errors.category = 'Selecione o ramo.';
    if (!reqPlan) errors.plan = 'Escolha um plano.';
    if (!loginClean) errors.login = 'Defina um usuário.';
    if (!reqPassword.trim()) errors.password = 'Defina uma senha.';
    if (!reqWhatsappConfirmed) errors.confirm = 'Confirme os dados.';

    // Validação de Duplicidade contra usuários existentes
    const allUsers = await getUsers();
    if (allUsers.some(u => u.email.toLowerCase() === loginClean)) {
        errors.login = 'Este usuário já está em uso.';
    }
    if (allUsers.some(u => (u.document || '').replace(/\D/g, '') === docClean)) {
        errors.document = 'Este documento já está cadastrado.';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    const isValid = await validateRequestForm();
    if (!isValid) return;

    const allRequests = await getAccessRequests();
    const docClean = reqDocument.replace(/\D/g, '');
    const hasPending = allRequests.some(r => r.document.replace(/\D/g, '') === docClean && r.status === 'pending');
    
    if (hasPending) { 
        setShowRequestModal(false); 
        setShowPendingBlockModal(true); 
        return; 
    }

    const requestId = Math.random().toString(36).substr(2, 9);
    const newRequest: AccessRequest = {
        id: requestId, 
        name: reqName.toUpperCase(), 
        document: docClean, 
        whatsapp: reqWhatsapp.replace(/\D/g, ''),
        category: reqCategory, 
        plan: reqPlan, 
        login: reqLogin.toLowerCase().trim(),
        passwordHash: reqPassword, 
        createdAt: new Date().toISOString(), 
        status: 'pending'
    };
    await saveAccessRequest(newRequest);
    localStorage.setItem('p4zz_active_request_id', requestId);
    setReqSuccess(true);
  };

  const handleInformaDeposito = async () => {
    setTriedManualSubmit(true);
    if (!confirmValueChecked || !receiptImg) return;
    setIsSubmitting(true);
    try {
        const req: PaymentRequest = { 
            id: Math.random().toString(36).substr(2, 9), 
            userId: foundUser!.id, 
            tenantId: foundUser!.tenantId, 
            userName: foundUser!.name, 
            payerName: foundUser!.name, 
            payerDocument: searchDoc.replace(/\D/g, ''), 
            paymentTime: new Date().toLocaleTimeString(), 
            receiptImage: receiptImg, 
            createdAt: new Date().toISOString(), 
            status: 'pending', 
            amount: pixAmount 
        }; 
        await savePaymentRequest(req); 
        alert("Comprovante enviado! Aguarde a liberação manual pelo administrador."); 
        setShowPublicPayment(false);
    } catch (err) {
        alert("Erro ao processar envio.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderLoginButton = (prefix: 'Plans' | 'Request' | 'Regularize' | 'Support') => {
    const defaultTexts = { Plans: 'Nossos Planos', Request: 'Solicitar Acesso', Regularize: 'Regularização', Support: 'Suporte VIP' };
    const defaultIcons = { Plans: '💎', Request: '🚀', Regularize: '⚠️', Support: '💬' };
    const defaultColors = { Plans: '#4f46e5', Request: '#10b981', Regularize: '#f59e0b', Support: '#059669' };
    const text = (safeSettings as any)[`loginBtn${prefix}Text`] || defaultTexts[prefix];
    const subtext = (safeSettings as any)[`loginBtn${prefix}Subtext`] || '';
    const bgColor = (safeSettings as any)[`loginBtn${prefix}Color`] || defaultColors[prefix];
    const textColor = (safeSettings as any)[`loginBtn${prefix}TextColor`] || '#ffffff';
    const iconBase64 = (safeSettings as any)[`loginBtn${prefix}Icon`];
    const showIcon = (safeSettings as any)[`loginBtn${prefix}ShowIcon`] !== false;
    
    const action = async () => {
      if (prefix === 'Plans') setShowPlansModal(true);
      else if (prefix === 'Request') {
        const activeId = localStorage.getItem('p4zz_active_request_id');
        const allReqs = await getAccessRequests();
        const isPending = allReqs.some(r => r.id === activeId && r.status === 'pending');
        if (isPending) { setShowPendingBlockModal(true); return; }
        setFieldErrors({}); setReqSuccess(false); setShowRequestModal(true);
      }
      else if (prefix === 'Regularize') { setFoundUser(null); setSearchDoc(''); setPaymentStep('search'); setShowPublicPayment(true); }
      else window.open(safeSettings.whatsappLink || "https://wa.me/5587981649139", "_blank");
    };

    return (
      <button key={prefix} type="button" onClick={action} className="flex items-center gap-4 p-4 rounded-[2.2rem] border border-white/10 shadow-lg active:scale-95 hover:brightness-110 transition-all cursor-pointer w-full text-left" style={{ backgroundColor: bgColor }}>
        {showIcon && (
          <div className="w-10 h-10 rounded-2xl bg-black/10 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
            {iconBase64 ? <img src={iconBase64} className="w-full h-full object-contain p-1" alt="icon" /> : <div className="text-xl">{defaultIcons[prefix]}</div>}
          </div>
        )}
        <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1" style={{ color: textColor }}>{text}</span>
            {subtext && <span className="text-[7px] font-bold opacity-70 uppercase tracking-tight" style={{ color: textColor }}>{subtext}</span>}
        </div>
      </button>
    );
  };

  const boxPosition = safeSettings.loginBoxPosition || 'center';
  const justifyClass = boxPosition === 'left' ? 'md:justify-start md:px-20' : boxPosition === 'right' ? 'md:justify-end md:px-20' : 'md:justify-center';

  const getLogoAnimClass = (type?: string) => {
    switch (type) {
      case 'floating': return 'animate-bounce';
      case 'bounce': return 'animate-bounce';
      case 'pulse': return 'animate-pulse';
      case 'wave': return 'animate-pulse';
      case 'spin-slow': return 'animate-[spin_8s_linear_infinite]';
      case 'shake': return 'animate-[wiggle_1s_ease-in-out_infinite]';
      case 'zoom': return 'animate-[pulse_2s_ease-in-out_infinite]';
      case 'slide-side': return 'animate-[slide_3s_ease-in-out_infinite]';
      case 'swing': return 'animate-[swing_2s_ease-in-out_infinite]';
      case 'heartbeat': return 'animate-[pulse_1s_ease-in-out_infinite]';
      case 'rubber-band': return 'animate-[pulse_1.5s_ease-in-out_infinite]';
      case 'glitch': return 'animate-pulse skew-x-12';
      case 'rotate-y': return 'animate-[spin_5s_linear_infinite]';
      default: return '';
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center ${justifyClass} relative overflow-hidden`}>
      {/* Fundo Dinâmico */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {safeSettings.loginScreenBgType === 'video' && safeSettings.loginScreenBgUrl ? (
          <video 
            autoPlay 
            muted 
            loop={safeSettings.loginScreenBgLoop} 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover"
            src={safeSettings.loginScreenBgUrl}
          />
        ) : (safeSettings.loginScreenBgType === 'image' || safeSettings.loginScreenBgType === 'gif') && safeSettings.loginScreenBgUrl ? (
          <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${safeSettings.loginScreenBgUrl})` }}
          />
        ) : (
          <div 
            className="absolute inset-0 w-full h-full"
            style={{ backgroundColor: safeSettings.loginScreenBgColor || safeSettings.loginBgColor || '#010818' }}
          />
        )}
        
        {/* Overlay sutil para garantir legibilidade se necessário */}
        <div className="absolute inset-0 bg-black/20"></div>

        {/* Efeitos Animados */}
        <LoginEffects 
          effect={safeSettings.loginEffect || 'none'} 
          color={safeSettings.loginEffectColorEnabled ? (safeSettings.loginEffectColor || safeSettings.loginMarketingPrimaryColor || primaryColor) : (safeSettings.loginMarketingPrimaryColor || primaryColor)} 
        />
      </div>

      {/* Seção de Marketing (Lado Esquerdo) */}
      <div className="hidden md:block">
        <MarketingSection settings={safeSettings} />
      </div>
      
      <div 
          ref={loginBoxRef}
          className="relative w-full max-w-[360px] backdrop-blur-3xl border z-[60] transition-all duration-700 mx-4 md:mx-0 shadow-2xl" 
          style={{ 
            backgroundColor: safeSettings.loginBoxBgColorEnabled ? (safeSettings.loginBoxBgColor || 'rgba(15, 23, 42, 0.8)') : 'rgba(15, 23, 42, 0.8)',
            borderColor: safeSettings.loginBoxBorderColorEnabled ? (safeSettings.loginBoxBorderColor || 'rgba(255, 255, 255, 0.1)') : 'rgba(255, 255, 255, 0.1)',
            borderRadius: `${safeSettings.loginBoxBorderRadius ?? safeSettings.loginBorderRadius ?? 72}px`,
            padding: `${safeSettings.loginBoxPadding ?? 40}px`,
            transform: window.innerWidth < 768 
              ? `translateY(50px) scale(${safeSettings.loginBoxScale ?? 1.0})` 
              : `translate(${safeSettings.loginBoxLeft ?? 550}px, ${safeSettings.loginBoxTop ?? 0}px) scale(${safeSettings.loginBoxScale ?? 1.0})` 
          }}>


          <div className="text-center space-y-3">
              <h2 
                className="text-2xl font-black uppercase tracking-[0.3em] italic leading-none"
                style={{ color: safeSettings.loginBoxTitleColorEnabled ? (safeSettings.loginBoxTitleColor || '#ffffff') : '#ffffff' }}
              >
                {safeSettings.loginTitle || 'ACESSO RESTRITO'}
              </h2>
              <div className="h-1.5 w-16 mx-auto rounded-full shadow-lg" style={{ backgroundColor: safeSettings.loginBoxBtnColorEnabled ? (safeSettings.loginBoxBtnColor || primaryColor) : primaryColor }}></div>
          </div>
          <form onSubmit={handleAuth} className="space-y-5">
              <div className="group relative space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Usuário</label>
                  <input 
                    type="text" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="E-mail ou usuário..." 
                    className="w-full px-6 py-4 bg-white/5 border-b-2 border-white/10 rounded-2xl text-white font-bold outline-none transition-all placeholder:text-slate-600" 
                    style={{ 
                      borderColor: safeSettings.loginBoxBorderColorEnabled ? (safeSettings.loginBoxBorderColor || 'rgba(255, 255, 255, 0.1)') : 'rgba(255, 255, 255, 0.1)',
                      color: safeSettings.loginBoxTextColorEnabled ? (safeSettings.loginBoxTextColor || '#ffffff') : '#ffffff'
                    }}
                  />
              </div>
              <div className="group relative space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Senha</label>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Senha secreta..." 
                    className="w-full px-6 py-4 bg-white/5 border-b-2 border-white/10 rounded-2xl text-white font-bold outline-none transition-all placeholder:text-slate-600" 
                    style={{ 
                      borderColor: safeSettings.loginBoxBorderColorEnabled ? (safeSettings.loginBoxBorderColor || 'rgba(255, 255, 255, 0.1)') : 'rgba(255, 255, 255, 0.1)',
                      color: safeSettings.loginBoxTextColorEnabled ? (safeSettings.loginBoxTextColor || '#ffffff') : '#ffffff'
                    }}
                  />
              </div>
              {error && <p className="text-[10px] text-rose-500 font-black text-center uppercase tracking-widest bg-rose-500/10 py-2 rounded-xl border border-rose-500/20">{error}</p>}
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full py-5 rounded-2xl font-black uppercase text-[12px] tracking-[0.4em] text-white shadow-2xl active:scale-95 hover:brightness-110 transition-all"
                style={{ backgroundColor: safeSettings.loginBoxBtnColorEnabled ? (safeSettings.loginBoxBtnColor || primaryColor) : primaryColor }}
              >
                {isSubmitting ? 'VALIDANDO...' : 'ENTRAR'}
              </button>
          </form>
          <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
              {(safeSettings.loginButtonsOrder || ['Plans', 'Request', 'Regularize', 'Support']).map(btn => renderLoginButton(btn as any))}
          </div>
      </div>

      {showPlansModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[1000] p-4 flex items-center justify-center animate-in fade-in">
           <div className="bg-[#0a0f1e] w-full max-w-4xl rounded-[3rem] p-8 border border-white/10 text-white flex flex-col max-h-[95vh] overflow-hidden">
              <div className="flex justify-between items-center mb-8 shrink-0">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Nossos Planos</h3>
                <button onClick={() => setShowPlansModal(false)} className="p-2 bg-white/5 rounded-xl text-slate-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-10 px-2 pb-6">
                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border-2 border-indigo-500/30 flex flex-col justify-between hover:scale-[1.02] transition-transform">
                      <div className="space-y-4">
                        <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase">OFERTA INICIAL</span>
                        <h4 className="text-2xl font-black uppercase italic tracking-tighter">Demo Grátis</h4>
                        <p className="text-3xl font-black italic text-indigo-400">R$ 0,00</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Acesso total por 3 dias para testes.</p>
                      </div>
                      <button onClick={() => { setShowPlansModal(false); setReqPlan('DEMO GRÁTIS – 3 DIAS'); setShowRequestModal(true); }} className="w-full mt-8 py-4 bg-indigo-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Solicitar Teste</button>
                  </div>
                  {availablePlans.map(plan => (
                    <div key={plan.id} className="relative bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/10 flex flex-col justify-between hover:border-indigo-500/50 transition-all">
                        {plan.days === 30 && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30">
                              <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite] text-slate-900 px-5 py-2 rounded-full text-[9px] font-black uppercase shadow-[0_8px_20px_-4px_rgba(245,158,11,0.5)] whitespace-nowrap border border-amber-200/50 flex items-center gap-1.5">
                                <span className="text-xs">⭐</span>
                                <span>Mais Escolhido</span>
                              </div>
                            </div>
                        )}
                        <div className="space-y-4">
                          <h4 className="text-2xl font-black uppercase italic tracking-tighter">{plan.name}</h4>
                          <p className="text-3xl font-black italic text-emerald-400">R$ {plan.price.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">{plan.days} dias de acesso ilimitado.</p>
                        </div>
                        <button onClick={() => { setShowPlansModal(false); setReqPlan(plan.name); setShowRequestModal(true); }} className="w-full mt-8 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Escolher Plano</button>
                    </div>
                  ))}
              </div>
           </div>
        </div>
      )}

      {showRequestModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[1000] p-4 flex items-center justify-center animate-in fade-in">
           <div className="bg-[#0a0f1e] w-full max-w-lg rounded-[3rem] p-8 border border-white/10 text-white flex flex-col max-h-[95vh] overflow-hidden">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Solicitar Acesso</h3>
                <button onClick={() => setShowRequestModal(false)} className="p-2 bg-white/5 rounded-xl text-slate-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
              </div>
              {requestSuccess ? (
                <div className="text-center py-10 space-y-6">
                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto"><svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg></div>
                    <h4 className="text-xl font-black uppercase tracking-tighter italic">Sucesso!</h4>
                    <p className="text-xs text-slate-400 uppercase font-bold px-6">Seu acesso foi configurado ou está em análise.</p>
                    <button onClick={() => setShowRequestModal(false)} className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest">OK</button>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1"><label className={`text-[9px] font-black uppercase ${fieldErrors.name ? 'text-rose-500' : 'text-slate-500'} ml-1`}>Nome ou Empresa *</label><input value={reqName} onChange={e => setReqName(e.target.value.toUpperCase())} placeholder="Nome comercial..." className={`w-full px-5 py-3.5 bg-slate-900 border ${fieldErrors.name ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700`} /></div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ${fieldErrors.document ? 'text-rose-500' : 'text-slate-500'} ml-1`}>CPF ou CNPJ *</label>
                          <input 
                            value={reqDocument} 
                            onChange={e => handleReqDocumentChange(e.target.value)} 
                            className={`w-full px-5 py-3.5 bg-slate-900 border ${fieldErrors.document ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-black outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700`} 
                            placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                          />
                          {fieldErrors.document && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">{fieldErrors.document}</p>}
                        </div>
                        <div className="space-y-1"><label className={`text-[9px] font-black uppercase ${fieldErrors.whatsapp ? 'text-rose-500' : 'text-slate-500'} ml-1`}>WhatsApp *</label><input value={reqWhatsapp} onChange={e => setReqWhatsapp(formatPhone(e.target.value))} className={`w-full px-5 py-3.5 bg-slate-900 border ${fieldErrors.whatsapp ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-bold outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700`} placeholder="(00) 00000-0000" /></div>
                        <div className="space-y-1"><label className={`text-[9px] font-black uppercase ${fieldErrors.category ? 'text-rose-500' : 'text-slate-500'} ml-1`}>Ramo *</label><select value={reqCategory} onChange={e => setReqCategory(e.target.value)} className={`w-full px-4 py-3.5 bg-slate-900 border ${fieldErrors.category ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-bold outline-none`}><option value="">SELECIONE</option>{availableCategories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Plano Desejado</label>
                          <select 
                            value={reqPlan} 
                            onChange={e => setReqPlan(e.target.value)} 
                            className="w-full px-4 py-3.5 bg-slate-950 border-2 border-indigo-500/30 rounded-2xl font-black text-indigo-400 outline-none"
                          >
                            <option value="">SELECIONE UM PLANO</option>
                            <option value="DEMO GRÁTIS – 3 DIAS">DEMO GRÁTIS – 3 DIAS</option>
                            {availablePlans.map(p => (
                                <option key={p.id} value={p.name}>{p.name} – R$ {p.price.toFixed(2)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="bg-black/40 p-5 rounded-[2rem] border border-white/5 space-y-4">
                            <p className="text-[10px] font-black text-indigo-400 uppercase italic">Dados de Acesso</p>
                            <div className="space-y-1">
                                <label className={`text-[8px] font-black uppercase ${fieldErrors.login ? 'text-rose-500' : 'text-slate-600'} ml-1`}>Usuário *</label>
                                <input value={reqLogin} onChange={e => setReqLogin(e.target.value.toLowerCase())} className={`w-full px-5 py-3 bg-slate-950 border ${fieldErrors.login ? 'border-rose-500' : 'border-white/5'} rounded-xl font-bold outline-none placeholder:text-slate-700`} placeholder="USUÁRIO..." />
                                {fieldErrors.login && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">{fieldErrors.login}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className={`text-[8px] font-black uppercase ${fieldErrors.password ? 'text-rose-500' : 'text-slate-600'} ml-1`}>Senha *</label>
                                <input type="password" value={reqPassword} onChange={e => setReqPassword(e.target.value)} className={`w-full px-5 py-3 bg-slate-950 border ${fieldErrors.password ? 'border-rose-500' : 'border-white/5'} rounded-xl font-bold outline-none placeholder:text-slate-700`} placeholder="SENHA..." />
                            </div>
                        </div>
                        <div onClick={() => setReqWhatsappConfirmed(!reqWhatsappConfirmed)} className={`p-4 rounded-2xl bg-black/40 border-2 ${fieldErrors.confirm ? 'border-rose-500' : 'border-white/10'} cursor-pointer flex justify-between items-center transition-all`}><span className={`text-[9px] font-black uppercase ${reqWhatsappConfirmed ? 'text-emerald-500' : 'text-slate-500'}`}>Confirmo meus dados</span><div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${reqWhatsappConfirmed ? 'bg-indigo-600 border-indigo-600' : 'border-white/20'}`}>{reqWhatsappConfirmed && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={5}/></svg>}</div></div>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[1.8rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Enviar Solicitação</button>
                </form>
              )}
           </div>
        </div>
      )}

      {showPublicPayment && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[1000] p-4 flex items-center justify-center animate-in fade-in">
           <div className="bg-[#0a0f1e] w-full max-w-lg rounded-[3rem] p-8 border border-white/10 text-white flex flex-col max-h-[95vh] overflow-hidden">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Regularização</h3>
                  <button 
                    onClick={() => window.open(safeSettings.whatsappLink || "https://wa.me/5587981649139", "_blank")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-500 rounded-full border border-emerald-500/30 hover:bg-emerald-600/30 transition-all active:scale-95"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-4.821 4.754a8.117 8.117 0 01-3.841-.963L3.5 20l1.657-5.332a8.105 8.105 0 01-1.101-4.12c0-4.491 3.655-8.146 8.148-8.146 2.175 0 4.22.846 5.756 2.384a8.102 8.102 0 012.387 5.763c0 4.492-3.655 8.147-8.149 8.147m0-17.647C7.34 1.489 2.23 6.599 2.23 12.856c0 2.001.523 3.954 1.516 5.682L1.5 22.5l4.111-1.079a10.56 10.56 0 005.239 1.385h.005c6.262 0 11.371-5.11 11.371-11.367 0-3.036-1.181-5.891-3.328-8.038a11.306 11.306 0 00-8.048-3.332z"/></svg>
                    <span className="text-[8px] font-black uppercase tracking-widest">Suporte</span>
                  </button>
                </div>
                <button onClick={() => setShowPublicPayment(false)} className="p-2 bg-white/5 rounded-xl text-slate-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
              </div>
              
              {paymentStep === 'search' ? (
                <div className="space-y-6">
                    <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ${searchError ? 'text-rose-500' : 'text-slate-500'} ml-1`}>Documento do Terminal (CPF/CNPJ)</label>
                        <input 
                          value={searchDoc} 
                          onChange={e => handleSearchDocChange(e.target.value)} 
                          placeholder="000.000.000-00" 
                          className={`w-full px-6 py-4 bg-slate-900 border ${searchError ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500`} 
                        />
                        {searchError && <p className="text-[10px] text-rose-500 font-black uppercase ml-2 mt-1">{searchError}</p>}
                    </div>
                    <button onClick={handleSearchTerminal} className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Localizar Terminal</button>
                </div>
              ) : (
                <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-6">
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 space-y-4">
                        <div className="flex justify-between items-start">
                            <h4 className="text-lg font-black uppercase italic text-white leading-tight">{foundUser?.name}</h4>
                            <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${computedStatus?.color}`}>{computedStatus?.label}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-white/5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Documento</p>
                                    <p className="text-[10px] font-bold text-slate-200">
                                      {foundUser?.document ? maskDocumentSafe(foundUser.document) : '---'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">WhatsApp</p>
                                    <p className="text-[10px] font-bold text-slate-200">{foundUser?.whatsapp ? maskPhoneSafe(foundUser.whatsapp) : '---'}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                <div>
                                    <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Plano Ativo</p>
                                    <p className="text-[10px] font-black text-white uppercase italic">{foundUser?.planName || 'PERSONALIZADO'}</p>
                                </div>
                                <div>
                                    <p className={`text-[7px] font-black uppercase tracking-widest ${computedStatus?.label !== 'Ativo' ? 'text-rose-500' : 'text-emerald-400'}`}>Vencimento</p>
                                    <p className={`text-[10px] font-black ${computedStatus?.label !== 'Ativo' ? 'text-rose-500' : 'text-white'}`}>
                                      {foundUser?.expiresAt ? new Date(foundUser.expiresAt + 'T12:00:00').toLocaleDateString() : '---'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {computedStatus?.label === 'Ativo' ? (
                        <div className="bg-emerald-500/10 p-8 rounded-[2.5rem] border-2 border-emerald-500/30 flex flex-col items-center gap-4 animate-in zoom-in-95 text-center">
                            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={5}/></svg>
                            </div>
                            <h4 className="text-lg font-black uppercase text-emerald-500 italic leading-tight">Parabéns, seu plano está ativo.</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Não existem faturas pendentes.</p>
                            <button onClick={() => setShowPublicPayment(false)} className="mt-4 px-10 py-3 bg-white text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Fechar</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed text-center">{computedStatus?.message}</p>
                            </div>

                            <div className="flex bg-slate-900 p-1.5 rounded-full shadow-inner mb-4">
                                <button onClick={() => setPaymentMode('pix')} className={`flex-1 py-3 rounded-full text-[9px] font-black uppercase transition-all ${paymentMode === 'pix' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>PIX Auto</button>
                                <button onClick={() => setPaymentMode('manual')} className={`flex-1 py-3 rounded-full text-[9px] font-black uppercase transition-all ${paymentMode === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>PIX Manual</button>
                            </div>

                            {paymentMode === 'pix' ? (
                                <div className="space-y-6 text-center">
                                    {!pixData ? (
                                        <div className="space-y-6">
                                            <div className="p-5 bg-indigo-600/10 rounded-[2rem] border border-indigo-600/30 flex flex-col items-center gap-1">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">VALOR</span>
                                                <span className="text-3xl font-black italic text-white tracking-tighter leading-none">R$ {pixAmount.toFixed(2)}</span>
                                            </div>
                                            <button onClick={handlePublicGeneratePix} disabled={isGeneratingPix} className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 transition-all">
                                                {isGeneratingPix ? 'GERANDO...' : `Pagar via Pix Automático`}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="animate-in zoom-in-95">
                                            <div className="bg-white p-4 rounded-3xl inline-block mb-4 shadow-2xl border-4 border-indigo-500"><img src={`data:image/png;base64,${pixData.qr_code_base64}`} className="w-48 h-48" alt="QR" /></div>
                                            <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); alert('Copiado!'); }} className="w-full py-4 bg-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest mb-4">Copiar Código PIX</button>
                                            <div className="text-emerald-500 animate-pulse text-[9px] font-black uppercase flex items-center justify-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div>Aguardando confirmação bancária...</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="p-5 bg-emerald-600/10 rounded-[2rem] border border-emerald-600/30 flex flex-col items-center gap-1">
                                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">VALOR</span>
                                        <span className="text-3xl font-black italic text-white tracking-tighter leading-none">R$ {pixAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-950 p-6 rounded-[2.2rem] border border-white/5">
                                        <p className="text-[8px] font-black text-indigo-400 uppercase mb-2 tracking-[0.2em] italic">Instruções de Depósito</p>
                                        <p className="text-[11px] font-bold leading-relaxed">{safeSettings.paymentInstructions || 'Solicite a chave PIX no suporte.'}</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div 
                                            onClick={() => fileInputRef.current?.click()} 
                                            className={`py-6 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${receiptImg ? 'bg-emerald-500/10 border-emerald-500/50' : (triedManualSubmit && !receiptImg ? 'bg-rose-50 border-rose-500 shadow-lg ring-1 ring-rose-200' : 'bg-white/5 border-white/10')}`}
                                        >
                                            {receiptImg ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-emerald-500 font-black uppercase text-[10px]">Comprovante Anexado ✓</span>
                                                    <button onClick={(e) => { e.stopPropagation(); setReceiptImg(''); }} className="text-rose-500 text-[8px] font-black uppercase underline">Remover</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <svg className={`w-6 h-6 ${triedManualSubmit && !receiptImg ? 'text-rose-500 animate-bounce' : 'text-slate-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={2}/></svg>
                                                    <span className={`text-[9px] font-black uppercase ${triedManualSubmit && !receiptImg ? 'text-rose-500' : 'text-slate-500'}`}>Anexar comprovante</span>
                                                </>
                                            )}
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,application/pdf" onChange={(e) => { handleFileChange(e); setTriedManualSubmit(false); }} />
                                        </div>
                                        
                                        <div 
                                            onClick={() => { setConfirmValueChecked(!confirmValueChecked); setTriedManualSubmit(false); }} 
                                            className={`flex items-center gap-3 cursor-pointer group p-3 bg-black/20 rounded-2xl border transition-all ${triedManualSubmit && !confirmValueChecked ? 'border-rose-500 shadow-lg ring-1 ring-rose-200' : 'border-white/5'}`}
                                        >
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${confirmValueChecked ? 'bg-indigo-600 border-indigo-600 shadow-lg' : (triedManualSubmit && !confirmValueChecked ? 'border-rose-500 bg-rose-50' : 'border-white/20')}`}>{confirmValueChecked && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={5}/></svg>}</div>
                                            <span className={`text-[9px] font-black uppercase ${confirmValueChecked ? 'text-white' : (triedManualSubmit && !confirmValueChecked ? 'text-rose-500' : 'text-slate-400 group-hover:text-white')} transition-colors`}>Confirmo o valor de R$ {pixAmount.toFixed(2)}</span>
                                        </div>

                                        <button onClick={handleInformaDeposito} disabled={isSubmitting} className="w-full py-5 bg-emerald-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                                            {isSubmitting ? 'ENVIANDO...' : 'Pagar via Pix Manual'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
              )}
           </div>
        </div>
      )}

      {showPendingBlockModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[1000] p-4 flex items-center justify-center animate-in fade-in">
           <div className="bg-[#0a0f1e] w-full max-w-[340px] rounded-[3rem] p-10 border-2 border-amber-500/30 text-white text-center shadow-2xl">
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20"><svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={3}/></svg></div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-4 text-amber-500 leading-tight">Solicitação Já Enviada</h3>
                <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed mb-10 px-4">Aguarde a aprovação do seu cadastro.</p>
                <div className="space-y-4 pt-4 border-t border-white/5">
                   <button onClick={() => window.open(safeSettings.whatsappLink || "https://wa.me/5587981649139", "_blank")} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">Falar no WhatsApp</button>
                   <button onClick={() => setShowPendingBlockModal(false)} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[8px] tracking-widest">Entendi</button>
                </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Login;