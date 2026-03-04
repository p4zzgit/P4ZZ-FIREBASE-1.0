import React, { useState, useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { MarketingSection } from '../components/MarketingSection';
import { 
  saveAppSettings, exportFullBackup, exportTenantBackup, 
  importFullBackup, getCurrentUser, DEFAULT_MENU_STRUCTURE, getAppSettings,
  notifyDataChanged, saveMenuBackup, getMenuBackup, DEFAULT_SETTINGS
} from '../services/storage';

const AdminSettings = ({ settings, onUpdateSettings }) => {
  const user = getCurrentUser();
  const isMaster = user?.tenantId === 'MASTER' && user?.role === 'admin';
  
  const [localSettings, setLocalSettings] = useState(settings);
  const lastSettingsRef = useRef(JSON.stringify(settings));
  const [activeTab, setActiveTab] = useState('workspace');
  const [showSuccessToast, setShowToast] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);
  const [showMenuConfirm, setShowMenuConfirm] = useState({
    show: false,
    title: '',
    action: () => {},
    color: 'bg-indigo-600'
  });

  // Sincronizar localSettings apenas quando settings mudar de fato (ex: via save ou outro tenant)
  useEffect(() => {
    const currentSettingsStr = JSON.stringify(settings);
    if (currentSettingsStr !== lastSettingsRef.current) {
      setLocalSettings(settings);
      lastSettingsRef.current = currentSettingsStr;
    }
  }, [settings]);
  
  const logoInputRef = useRef(null);
  const importInputRef = useRef(null);
  const plansIconRef = useRef(null);
  const requestIconRef = useRef(null);
  const regularizeIconRef = useRef(null);
  const supportIconRef = useRef(null);
  const marketingImageInputRef = useRef(null);

  const [loginBoxSpecs, setLoginBoxSpecs] = useState({ width: 360, height: 700, borderRadius: 72, padding: 40 });

  useEffect(() => {
    const el = document.getElementById('login-box-preview');
    if (!el) return;

    const measure = () => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      
      // O transform: scale(0.8) afeta o getBoundingClientRect, mas não o getComputedStyle (width/height)
      // No entanto, se o elemento tiver max-width ou flexbox, o getComputedStyle.width pode ser 'auto' ou o valor resolvido.
      // Para garantir a precisão do que está renderizado, usamos rect e dividimos pela escala.
      
      setLoginBoxSpecs({
        width: Math.round(rect.width / 0.8),
        height: Math.round(rect.height / 0.8),
        borderRadius: parseInt(style.borderRadius) || 0,
        padding: parseInt(style.padding) || 0
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    
    // Medição inicial e após um pequeno delay para garantir que estilos inline/classes foram aplicados
    measure();
    const timer = setTimeout(measure, 100);
    
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [localSettings.loginBorderRadius, localSettings.loginBoxPadding, localSettings.loginBoxBgColor, localSettings.loginBoxScale]);

  const sidebarThemes = [
    { id: 'dark', label: 'Escuro' },
    { id: 'light', label: 'Claro' },
    { id: 'glacier', label: 'Minimalista' },
    { id: 'colored', label: 'Personalizado' }
  ];

  const allPossibleViews = [
    { id: 'dashboard', label: 'Painel Principal' },
    { id: 'new-sale', label: 'Venda Direta' },
    { id: 'tables', label: 'Mesas' },
    { id: 'deliveries', label: 'Entregas' },
    { id: 'products', label: 'Estoque' },
    { id: 'categories', label: 'Categorias' },
    { id: 'expenses', label: 'Despesas' },
    { id: 'sales-history', label: 'Histórico' },
    { id: 'reports', label: 'Relatórios' },
    { id: 'my-plan', label: 'Meu Plano' },
    { id: 'employee-management', label: 'Funcionários' },
    { id: 'support', label: 'Suporte' },
    { id: 'payment', label: 'Pagamentos' },
    { id: 'user-management', label: 'Usuários' },
    { id: 'customer-management', label: 'Licenças' },
    { id: 'plan-management', label: 'Planos' },
    { id: 'settings', label: 'Configurações do Menu' }
  ];

  const handleUpdate = (updates) => {
    setLocalSettings(prev => ({ ...prev, ...updates }));
  };

  const saveToStorage = async () => {
    await saveAppSettings(localSettings, user?.tenantId || 'MASTER');
    onUpdateSettings(localSettings);
    window.dispatchEvent(new CustomEvent('p4zz_data_updated'));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleUpdate({ logoUrl: reader.result });
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIconUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result;
      if (base64Data) { handleUpdate({ [field]: base64Data }); e.target.value = ''; }
    };
    reader.readAsDataURL(file);
  };

  const handleMarketingImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo (PNG, JPEG, GIF ou MP4)
    const allowedTypes = ['image/png', 'image/gif', 'image/jpeg', 'video/mp4'];
    if (!allowedTypes.includes(file.type)) {
      alert('Apenas arquivos PNG, JPEG, GIF ou MP4 são permitidos.');
      e.target.value = '';
      return;
    }

    // Validar tamanho (15MB)
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('O tamanho máximo permitido é 15MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result;
      if (base64Data) {
        handleUpdate({ loginMarketingImageUrl: base64Data });
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoginBoxBorderImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      alert('Apenas arquivos PNG transparentes são permitidos para a borda.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 5MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result;
      if (base64Data) {
        handleUpdate({ loginBoxBorderImageUrl: base64Data });
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        if (importFullBackup(content)) {
          alert('Backup restaurado com sucesso! O sistema será reinicializado.');
          window.location.reload();
        } else {
          alert('Erro crítico: O arquivo de backup é inválido.');
        }
      };
      reader.readAsText(file);
    }
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const currentStructure = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
    currentStructure.push({
      id: 'cat_' + Math.random().toString(36).substr(2, 5),
      label: newCatName.toUpperCase(),
      items: []
    });
    handleUpdate({ menuStructure: currentStructure });
    setNewCatName('');
  };

  const removeCategory = (id) => {
    if (id === 'master') return;
    const currentStructure = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE)).filter((c) => c.id !== id);
    handleUpdate({ menuStructure: currentStructure });
    setConfirmDeleteCat(null);
  };

  const moveCategory = (index, direction) => {
    const struct = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
    if (direction === 'up' && index > 0) {
      [struct[index], struct[index - 1]] = [struct[index - 1], struct[index]];
    } else if (direction === 'down' && index < struct.length - 1) {
      [struct[index], struct[index + 1]] = [struct[index + 1], struct[index]];
    }
    handleUpdate({ menuStructure: struct });
  };

  const moveItemOrder = (catIdx, itemIdx, direction) => {
    const struct = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
    const items = [...struct[catIdx].items];
    if (direction === 'up' && itemIdx > 0) {
      [items[itemIdx], items[itemIdx - 1]] = [items[itemIdx - 1], items[itemIdx]];
    } else if (direction === 'down' && itemIdx < items.length - 1) {
      [items[itemIdx], items[itemIdx + 1]] = [items[itemIdx + 1], items[itemIdx]];
    }
    struct[catIdx].items = items;
    handleUpdate({ menuStructure: struct });
  };

  const updateItemLabel = (id, label) => {
    const labels = { ...(localSettings.customLabels || {}) };
    labels[`menu_${id}`] = label.toUpperCase();
    handleUpdate({ customLabels: labels });
  };

  const updateItemShortcut = (id, key) => {
    const shortcuts = { ...(localSettings.menuShortcuts || {}) };
    if (!key) {
      delete shortcuts[id];
    } else {
      Object.keys(shortcuts).forEach(k => {
        if (shortcuts[k] === key) delete shortcuts[k];
      });
      shortcuts[id] = key;
    }
    handleUpdate({ menuShortcuts: shortcuts });
  };

  const moveItemToCategory = (viewId, fromCatId, toCatId) => {
    let struct = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
    
    // Remover de todas as categorias primeiro para garantir que não haja duplicatas
    struct = struct.map((cat) => ({
      ...cat,
      items: cat.items.filter(i => i !== viewId)
    }));

    // Se o destino não for 'none', adicionar à categoria de destino
    if (toCatId !== 'none') {
      struct = struct.map((cat) => {
        if (cat.id === toCatId) {
          return { ...cat, items: [...cat.items, viewId] };
        }
        return cat;
      });
    }

    handleUpdate({ menuStructure: struct });
  };

  const restoreMenuStructure = async () => {
    setShowMenuConfirm({
      show: true,
      title: 'Restaurar Gestor de Menu',
      color: 'bg-rose-600',
      action: async () => {
        const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_MENU_STRUCTURE));
        
        // Limpar labels customizados do menu para voltar aos nomes padrão
        const newLabels = { ...(localSettings.customLabels || {}) };
        Object.keys(newLabels).forEach(key => {
          if (key.startsWith('menu_')) delete newLabels[key];
        });

        const updatedSettings = { 
          ...localSettings, 
          menuStructure: defaultCopy,
          menuShortcuts: {},
          customLabels: newLabels
        };
        
        // Persistir e atualizar
        await saveAppSettings(updatedSettings, user?.tenantId || 'MASTER');
        setLocalSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
        notifyDataChanged();
        
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        alert('Gestor de Menu restaurado para o padrão com sucesso!');
        setShowMenuConfirm(prev => ({ ...prev, show: false }));
      }
    });
  };

  const moveLoginButton = (index, direction) => {
    const currentOrder = [...(localSettings.loginButtonsOrder || ['Plans', 'Request', 'Regularize', 'Support'])];
    if (direction === 'up' && index > 0) {
      [currentOrder[index], currentOrder[index - 1]] = [currentOrder[index - 1], currentOrder[index]];
    } else if (direction === 'down' && index < currentOrder.length - 1) {
      [currentOrder[index], currentOrder[index + 1]] = [currentOrder[index + 1], currentOrder[index]];
    }
    handleUpdate({ loginButtonsOrder: currentOrder });
  };

  const restoreMarketingSettings = () => {
    const marketingFields = [
      'loginSalesTitle', 'loginSalesTitleSize', 'loginSalesTitleX', 'loginSalesTitleY', 'loginSalesTitleAnim', 'loginSalesTitleColor', 'loginSalesTitleFont', 'loginSalesTitleWidth', 'loginSalesTitleHeight',
      'loginSalesText', 'loginSalesTextSize', 'loginSalesTextX', 'loginSalesTextY', 'loginSalesTextAnim', 'loginSalesTextColor', 'loginSalesTextFont', 'loginSalesTextWidth', 'loginSalesTextHeight',
      'loginFeatures', 'loginFeaturesX', 'loginFeaturesY', 'loginFeaturesAnimSpeed', 'loginFeaturesColor', 'loginFeaturesTextColor', 'loginFeaturesBorderRadius', 'loginFeaturesPadding', 'loginFeaturesGap', 'loginFeaturesAnimType',
      'loginMarketingLeft', 'loginMarketingTop', 'loginMarketingScale', 'loginMarketingAlign', 'loginMarketingFontSize', 'loginMarketingTitleSize', 'loginMarketingTitleOpacity', 'loginMarketingFeatureFontSize', 'loginMarketingFeatureIconSize', 'loginMarketingFeatureGap', 'loginMarketingFeaturePadding', 'loginMarketingFeatureBorderRadius', 'loginMarketingTitleLetterSpacing', 'loginMarketingFeatureScale', 'loginMarketingFeatureOpacity', 'loginMarketingFeatureMoveX', 'loginMarketingFeatureAnim', 'loginMarketingFeatureAnimSpeed', 'loginMarketingFeatureWidth', 'loginMarketingFeaturesSideBySide',
      'loginBoxTop', 'loginBoxLeft', 'loginBoxScale', 'loginBoxPadding',
      'loginBalloonColor', 'loginBalloonHeight', 'loginEffect', 'loginEffectColor', 'loginEffectColorEnabled',
      'loginMarketingImageEnabled', 'loginMarketingImageUrl', 'loginMarketingImageX', 'loginMarketingImageY', 'loginMarketingImageScale', 'loginMarketingImageAnim', 'loginMarketingTextEnabled',
      'loginScreenBgColor', 'loginMarketingPrimaryColor', 'loginThematicBorder'
    ];

    const restored = {};
    marketingFields.forEach(field => {
      if (field in DEFAULT_SETTINGS) {
        restored[field] = DEFAULT_SETTINGS[field];
      }
    });

    handleUpdate(restored);
    alert('Configurações de Marketing restauradas para o padrão original!');
  };

  const renderButtonConfigGroup = (type, index, total) => {
    const iconRef = type === 'Plans' ? plansIconRef : type === 'Request' ? requestIconRef : type === 'Regularize' ? regularizeIconRef : supportIconRef;
    const title = type === 'Plans' ? 'Botão: Nossos Planos' : type === 'Request' ? 'Botão: Solicitar Acesso' : type === 'Regularize' ? 'Botão: Regularização' : 'Botão: Suporte VIP';
    const themeColor = type === 'Plans' ? '#4f46e5' : type === 'Request' ? '#10b981' : type === 'Regularize' ? '#f59e0b' : '#059669';

    const iconKey = `loginBtn${type}Icon`;
    const showIconKey = `loginBtn${type}ShowIcon`;
    const textKey = `loginBtn${type}Text`;
    const subtextKey = `loginBtn${type}Subtext`;
    const colorKey = `loginBtn${type}Color`;
    const textColorKey = `loginBtn${type}TextColor`;
    
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-6 relative group/box">
        <div className="flex items-center justify-between border-b dark:border-white/5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: themeColor }}></div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white italic">{title}</h4>
          </div>
          <div className="flex gap-1">
             <button onClick={() => moveLoginButton(index, 'up')} disabled={index === 0} className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-slate-400 hover:text-indigo-500 disabled:opacity-0 transition-all">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth={3}/></svg>
             </button>
             <button onClick={() => moveLoginButton(index, 'down')} disabled={index === total - 1} className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-slate-400 hover:text-indigo-500 disabled:opacity-0 transition-all">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3}/></svg>
             </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">1. Ícone</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-opacity ${localSettings[showIconKey] === false ? 'opacity-30' : 'opacity-100'}`}>
                {localSettings[iconKey] ? <img src={localSettings[iconKey]} className="w-full h-full object-contain p-2" alt="icon" /> : <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 01-1.586-1.586a2 2 0 012.828 0L20 14" strokeWidth={2}/></svg>}
              </div>
              <div className="flex flex-col items-center gap-1">
                <button type="button" onClick={() => iconRef.current?.click()} className="text-[7px] font-black uppercase text-indigo-600">Escolher Imagem</button>
                {localSettings[iconKey] && (
                  <button type="button" onClick={() => handleUpdate({ [iconKey]: '' })} className="text-[7px] font-black uppercase text-rose-500">Remover Imagem</button>
                )}
              </div>
              <input type="file" ref={iconRef} className="hidden" accept="image/*" onChange={(e) => handleIconUpload(e, iconKey)} />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">2. Cores</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="color" value={localSettings[colorKey] || themeColor} onChange={e => handleUpdate({ [colorKey]: e.target.value })} className="w-8 h-8 rounded bg-transparent" title="Cor de Fundo" />
              <input type="color" value={localSettings[textColorKey] || '#ffffff'} onChange={e => handleUpdate({ [textColorKey]: e.target.value })} className="w-8 h-8 rounded bg-transparent" title="Cor do Texto" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">3. Textos</p>
            <input value={localSettings[textKey] || ''} onChange={e => handleUpdate({ [textKey]: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-black text-[9px] uppercase outline-none focus:ring-1 focus:ring-indigo-500" placeholder="TEXTO PRINCIPAL" />
            <input value={localSettings[subtextKey] || ''} onChange={e => handleUpdate({ [subtextKey]: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-bold text-[8px] uppercase outline-none focus:ring-1 focus:ring-indigo-500" placeholder="SUBTEXTO" />
          </div>
        </div>
      </div>
    );
  };

  const getTabBtnClass = (tabId) => `tab-btn px-6 md:px-8 py-3.5 md:py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
    activeTab === tabId 
      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' 
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
  }`;

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-500">
      {showSuccessToast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-[9px] uppercase tracking-widest animate-in slide-in-from-top-4">Preferências Salvas</div>}

      <div className="flex md:justify-center mb-10 overflow-x-auto pb-4 px-4 md:px-0 no-print scrollbar-hide">
        <div className="bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full flex shadow-inner whitespace-nowrap min-w-max">
          <button onClick={() => setActiveTab('workspace')} className={getTabBtnClass('workspace')}>Workspace</button>
          
          {isMaster && (
            <button onClick={() => setActiveTab('marketing')} className={getTabBtnClass('marketing')}>Marketing</button>
          )}
          
          <button onClick={() => setActiveTab('menu')} className={getTabBtnClass('menu')}>Gestor</button>
          
          {isMaster && (
            <>
              <button onClick={() => setActiveTab('loginButtons')} className={getTabBtnClass('loginButtons')}>Botões</button>
              <button onClick={() => setActiveTab('payments')} className={getTabBtnClass('payments')}>Faturamento</button>
            </>
          )}
          
          <button onClick={() => setActiveTab('data')} className={getTabBtnClass('data')}>Backup</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl no-print">
        {activeTab === 'workspace' && (
          <div className="space-y-10 animate-in slide-in-from-left-4">
            <section className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-slate-400">Identidade Visual</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Texto da Logo / Sistema</label>
                    <input value={localSettings.systemName} onChange={e => handleUpdate({ systemName: e.target.value.toUpperCase() })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 ml-2">
                      <input 
                        type="checkbox" 
                        id="primaryColorEnabled"
                        checked={localSettings.primaryColorEnabled || false} 
                        onChange={e => handleUpdate({ primaryColorEnabled: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="primaryColorEnabled" className="text-[9px] font-black uppercase text-indigo-500 italic tracking-widest cursor-pointer">Personalizar Cor Principal</label>
                    </div>
                    {localSettings.primaryColorEnabled && (
                      <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner animate-in zoom-in-95">
                          <input type="color" value={localSettings.primaryColor || '#00BFFF'} onChange={e => handleUpdate({ primaryColor: e.target.value })} className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-none" />
                          <div className="flex-1">
                             <p className="text-[10px] font-black uppercase text-[var(--workspace-text)]">Destaque de Botões & Menus</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase italic">Padrão: Azul Claro Brilhante</p>
                          </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Modo de Exibição do Painel</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner h-14">
                        <button onClick={() => handleUpdate({ themeMode: 'light' })} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[9px] font-black uppercase transition-all ${localSettings.themeMode === 'light' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-400'}`}><span className="text-sm">☀️</span> Claro</button>
                        <button onClick={() => handleUpdate({ themeMode: 'dark' })} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[9px] font-black uppercase transition-all ${localSettings.themeMode === 'dark' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-400'}`}><span className="text-sm">🌙</span> Escuro</button>
                      </div>
                      {localSettings.workspaceBgColorEnabled && (
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner flex items-center justify-center animate-in zoom-in-95">
                          <input type="color" value={localSettings.workspaceBgColor || (localSettings.themeMode === 'dark' ? '#020617' : '#f8fafc')} onChange={e => handleUpdate({ workspaceBgColor: e.target.value })} className="w-full h-full rounded-xl cursor-pointer bg-transparent border-none" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <input 
                        type="checkbox" 
                        id="workspaceBgColorEnabled"
                        checked={localSettings.workspaceBgColorEnabled || false} 
                        onChange={e => handleUpdate({ workspaceBgColorEnabled: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="workspaceBgColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Ativar Cor de Fundo Personalizada</label>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center w-full">Imagem da Logo</label>
                  <div className="relative">
                    <div className="w-28 h-28 md:w-32 md:h-32 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner transition-all group-hover:border-indigo-500">
                      {localSettings.logoUrl ? <img src={localSettings.logoUrl} className="w-full h-full object-contain p-4" alt="logo preview" /> : <svg className="w-10 h-10 text-slate-200 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 01-1.586-1.586a2 2 0 012.828 0L20 14" /></svg>}
                    </div>
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-12 h-12 md:w-10 md:h-10 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-10"><svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3}/></svg></button>
                    <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </div>
                  {localSettings.logoUrl && <button onClick={() => { handleUpdate({ logoUrl: '' }); if(logoInputRef.current) logoInputRef.current.value = ''; }} className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-600 transition-colors">Remover Logo</button>}
                </div>
              </div>
            </section>

            <section className="space-y-6 pt-10 border-t dark:border-white/5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-slate-400">Automação</h3>
              <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-[var(--workspace-text)]">Impressão Automática</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase italic">Ativar impressão automática ao finalizar pagamento</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => handleUpdate({ autoPrintOnPayment: !localSettings.autoPrintOnPayment })} 
                  className={`w-12 h-6 rounded-full transition-all relative ${localSettings.autoPrintOnPayment ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.autoPrintOnPayment ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </section>

            <section className="space-y-6 pt-10 border-t dark:border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-indigo-500">Tema Base do Sistema</h3>
              </div>
              
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Escolher Tema</label>
                <select value={localSettings.sidebarTheme} onChange={e => handleUpdate({ sidebarTheme: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner">
                    {sidebarThemes.map(t => (
                      <option key={t.id} value={t.id}>{t.label.toUpperCase()}</option>
                    ))}
                </select>
              </div>

              {localSettings.sidebarTheme === 'colored' && (
                <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-slate-800 space-y-8 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-1">
                        <input 
                          type="checkbox" 
                          id="sidebarMainColorEnabled"
                          checked={localSettings.sidebarMainColorEnabled || false} 
                          onChange={e => handleUpdate({ sidebarMainColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="sidebarMainColorEnabled" className="text-[9px] font-black uppercase text-slate-500 tracking-widest cursor-pointer">Cor do Fundo (Menu Lateral)</label>
                      </div>
                      {localSettings.sidebarMainColorEnabled && (
                        <input type="color" value={localSettings.sidebarMainColor || '#0f172a'} onChange={e => handleUpdate({ sidebarMainColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-2 border-white/10 animate-in zoom-in-95" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-1">
                        <input 
                          type="checkbox" 
                          id="sidebarTextColorEnabled"
                          checked={localSettings.sidebarTextColorEnabled || false} 
                          onChange={e => handleUpdate({ sidebarTextColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="sidebarTextColorEnabled" className="text-[9px] font-black uppercase text-slate-500 tracking-widest cursor-pointer">Cor do Texto</label>
                      </div>
                      {localSettings.sidebarTextColorEnabled && (
                        <input type="color" value={localSettings.sidebarTextColor || '#ffffff'} onChange={e => handleUpdate({ sidebarTextColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-2 border-white/10 animate-in zoom-in-95" />
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pt-2">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Ativar Degradê</label>
                        <button type="button" onClick={() => handleUpdate({ sidebarGradientEnabled: !localSettings.sidebarGradientEnabled })} className={`w-12 h-6 rounded-full transition-all relative ${localSettings.sidebarGradientEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.sidebarGradientEnabled ? 'left-7' : 'left-1'}`}></div></button>
                      </div>
                      {localSettings.sidebarGradientEnabled && (
                        <div className="animate-in slide-in-from-top-2 space-y-2">
                          <div className="flex items-center gap-3 ml-1">
                            <input 
                              type="checkbox" 
                              id="sidebarSecondaryColorEnabled"
                              checked={localSettings.sidebarSecondaryColorEnabled || false} 
                              onChange={e => handleUpdate({ sidebarSecondaryColorEnabled: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="sidebarSecondaryColorEnabled" className="text-[9px] font-black uppercase text-slate-500 tracking-widest cursor-pointer">Cor Secundária</label>
                          </div>
                          {localSettings.sidebarSecondaryColorEnabled && (
                            <input type="color" value={localSettings.sidebarSecondaryColor || '#020617'} onChange={e => handleUpdate({ sidebarSecondaryColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-2 border-white/10 animate-in zoom-in-95" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Ajustes de Dimensões - FIXO E SEMPRE VISÍVEL ABAIXO DOS TEMAS */}
            <section className="space-y-6 pt-10 border-t dark:border-white/5">
                <h4 className="text-[9px] font-black uppercase text-indigo-500 tracking-widest italic">Ajustes de Dimensões</h4>
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Largura da Barra: {localSettings.sidebarWidth || 260}px</span></div>
                          <input type="range" min="200" max="350" step="5" value={localSettings.sidebarWidth || 260} onChange={e => handleUpdate({ sidebarWidth: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Espaçamento Item: {localSettings.sidebarItemPadding || 12}px</span></div>
                          <input type="range" min="8" max="24" step="1" value={localSettings.sidebarItemPadding || 12} onChange={e => handleUpdate({ sidebarItemPadding: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Tamanho da Fonte: {localSettings.sidebarFontSize || 11}px</span></div>
                          <input type="range" min="9" max="14" step="1" value={localSettings.sidebarFontSize || 11} onChange={e => handleUpdate({ sidebarFontSize: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Tamanho do Ícone: {localSettings.sidebarIconSize || 22}px</span></div>
                          <input type="range" min="16" max="32" step="1" value={localSettings.sidebarIconSize || 22} onChange={e => handleUpdate({ sidebarIconSize: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                  </div>
                </div>
            </section>

            {isMaster && (
              <>
                <section className="space-y-6 pt-10 border-t dark:border-white/5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-slate-400">Rodapé & WhatsApp</h3>
                  <div className="space-y-6">
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Mensagem de Rodapé</label><input value={localSettings.footerText || ''} onChange={e => handleUpdate({ footerText: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div className="space-y-1 pt-6 border-t dark:border-white/5"><label className="text-[9px] font-black uppercase text-emerald-500 ml-2 tracking-widest italic">Link do WhatsApp (Suporte)</label><input value={localSettings.whatsappLink || ''} onChange={e => handleUpdate({ whatsappLink: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" placeholder="https://wa.me/55..." /></div>
                  </div>
                </section>

                <section className="space-y-6 pt-10 border-t dark:border-white/5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-rose-500">Mensagens de Bloqueio</h3>
                  <div className="space-y-6">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Mensagem de Suspensão</label>
                        <textarea 
                            value={localSettings.globalSuspensionMessage || ''} 
                            onChange={e => handleUpdate({ globalSuspensionMessage: e.target.value })} 
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500 resize-none" 
                            rows={2}
                            placeholder="ACESSO SUSPENSO: Regularize sua fatura para reativar o acesso ao sistema."
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Mensagem de Banimento</label>
                        <textarea 
                            value={localSettings.globalBanMessage || ''} 
                            onChange={e => handleUpdate({ globalBanMessage: e.target.value })} 
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-rose-500 resize-none" 
                            rows={2}
                            placeholder="ACESSO BLOQUEADO: Este terminal foi banido por violação dos termos de uso."
                        />
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-10 animate-in slide-in-from-right-4">
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-indigo-500">Organização do Menu Lateral</h3>
                <div className="flex gap-2">
                  <input 
                    value={newCatName} 
                    onChange={e => setNewCatName(e.target.value)} 
                    placeholder="NOVA CATEGORIA" 
                    className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-black text-[9px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={addCategory} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg transition-all active:scale-95">+</button>
                </div>
              </div>

              <div className="space-y-6">
                {(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).map((cat, catIdx) => (
                  <div key={cat.id} className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-4 animate-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between border-b dark:border-white/5 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                        <input 
                          value={cat.label} 
                          onChange={e => {
                            const struct = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
                            struct[catIdx].label = e.target.value.toUpperCase();
                            handleUpdate({ menuStructure: struct });
                          }}
                          className="bg-transparent font-black text-[10px] uppercase tracking-widest text-[var(--workspace-text)] outline-none focus:border-b-2 border-indigo-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => moveCategory(catIdx, 'up')} disabled={catIdx === 0} className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-slate-400 disabled:opacity-30 transition-all hover:text-indigo-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth={3}/></svg>
                        </button>
                        <button onClick={() => moveCategory(catIdx, 'down')} disabled={catIdx === (localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).length - 1} className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-slate-400 disabled:opacity-30 transition-all hover:text-indigo-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3}/></svg>
                        </button>
                        {cat.id !== 'master' && (
                          <button onClick={() => setConfirmDeleteCat(cat.id)} className="p-2 bg-rose-50 text-rose-500 rounded-lg shadow-sm transition-all hover:bg-rose-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {cat.items.filter(itemId => {
                        // Regras de visibilidade no editor
                        if (!isMaster) {
                          if (itemId === 'payment' || itemId === 'settings') return false;
                          if (itemId === 'user-management' || itemId === 'customer-management' || itemId === 'plan-management') return false;
                        }
                        return true;
                      }).map((itemId, itemIdx) => {
                        const viewInfo = allPossibleViews.find(v => v.id === itemId);
                        return (
                          <div key={itemId} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 group/item">
                            <div className="flex gap-1 shrink-0">
                                <button onClick={() => moveItemOrder(catIdx, itemIdx, 'up')} disabled={itemIdx === 0} className="p-1 text-slate-300 hover:text-indigo-500 disabled:opacity-0 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth={4}/></svg></button>
                                <button onClick={() => moveItemOrder(catIdx, itemIdx, 'down')} disabled={itemIdx === cat.items.length - 1} className="p-1 text-slate-300 hover:text-indigo-500 disabled:opacity-0 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={4}/></svg></button>
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="text-[7px] font-black uppercase text-slate-400 block ml-1">Nome no Menu</label>
                              <input 
                                value={localSettings.customLabels?.[`menu_${itemId}`] || (viewInfo?.label.toUpperCase())} 
                                onChange={e => updateItemLabel(itemId, e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="w-full md:w-32 space-y-1">
                              <label className="text-[7px] font-black uppercase text-slate-400 block ml-1">Atalho</label>
                              <select 
                                value={localSettings.menuShortcuts?.[itemId] || ''} 
                                onChange={e => updateItemShortcut(itemId, e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none cursor-pointer"
                              >
                                <option value="">NENHUM</option>
                                {[1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12].map(num => (
                                  <option key={num} value={`F${num}`}>F{num}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-full md:w-40 space-y-1">
                              <label className="text-[7px] font-black uppercase text-slate-400 block ml-1">Mover para</label>
                              <select 
                                onChange={e => moveItemToCategory(itemId, cat.id, e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none cursor-pointer"
                                value={cat.id}
                              >
                                {(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).map(c => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                                <option value="none">NENHUM (OCULTAR)</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                      {cat.items.length === 0 && (
                        <p className="text-[8px] font-black text-slate-300 text-center py-4 uppercase italic">Categoria Vazia</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Itens Ocultos (Nenhum) */}
                {(() => {
                  const allVisibleItems = (localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).flatMap(c => c.items);
                  const hiddenItems = allPossibleViews.filter(v => {
                    // Se já estiver visível em alguma categoria, não é um item oculto
                    if (allVisibleItems.includes(v.id)) return false;
                    
                    // Regras de visibilidade no editor (mesmas do loop principal)
                    if (!isMaster) {
                      if (v.id === 'payment' || v.id === 'settings') return false;
                      if (v.id === 'user-management' || v.id === 'customer-management' || v.id === 'plan-management') return false;
                    }
                    return true;
                  });
                  
                  if (hiddenItems.length === 0) return null;

                  return (
                    <div className="p-6 bg-slate-100/50 dark:bg-slate-800/20 rounded-[2.5rem] border border-dashed border-slate-300 dark:border-slate-700 space-y-4">
                      <div className="flex items-center gap-3 border-b dark:border-white/5 pb-3">
                        <div className="w-1.5 h-6 bg-slate-400 rounded-full"></div>
                        <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Itens Ocultos (Nenhum)</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {hiddenItems.map(item => (
                          <div key={item.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="flex-1">
                              <span className="font-black text-[9px] uppercase tracking-widest text-slate-600 dark:text-slate-300">{item.label}</span>
                            </div>
                            <div className="w-full md:w-40 space-y-1">
                              <label className="text-[7px] font-black uppercase text-slate-400 block ml-1">Mover para</label>
                              <select 
                                onChange={e => moveItemToCategory(item.id, 'none', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none cursor-pointer"
                                value="none"
                              >
                                <option value="none">NENHUM (OCULTAR)</option>
                                {(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).map(c => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-6 border-t dark:border-white/5 flex flex-wrap justify-center gap-4">
                <button 
                  onClick={restoreMenuStructure}
                  className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Restaurar Gestor de Menu
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'marketing' && isMaster && (
          <div className="animate-in slide-in-from-right-4 space-y-10 max-w-4xl mx-auto">
            <div className="space-y-12 pb-20 flex flex-col items-center">
              <div className="grid grid-cols-1 gap-12 w-full max-w-4xl mx-auto">
                {/* --- IMAGEM DE MARKETING & FUNDO --- */}
                <section className="space-y-8 bg-white dark:bg-slate-900/50 p-8 md:p-12 rounded-[3.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
                  <div className="text-center space-y-2">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic text-indigo-500">Imagem de Marketing & Fundo</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Defina as imagens e o ambiente visual de fundo</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full">
                    {/* Imagem de Marketing (ao lado do box) */}
                    <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center w-full block">Imagem de Marketing (Lateral)</label>
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <div className="w-28 h-28 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner transition-all group-hover:border-indigo-500">
                            {localSettings.loginMarketingImageUrl ? (
                              localSettings.loginMarketingImageUrl.startsWith('data:video') ? (
                                <video src={localSettings.loginMarketingImageUrl} className="w-full h-full object-contain p-4" muted />
                              ) : (
                                <img src={localSettings.loginMarketingImageUrl} className="w-full h-full object-contain p-4" alt="marketing preview" />
                              )
                            ) : (
                              <svg className="w-10 h-10 text-slate-200 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 01-1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                            )}
                          </div>
                          <button 
                            type="button" 
                            onClick={() => marketingImageInputRef.current?.click()} 
                            className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-10"
                          >
                            <Upload className="w-5 h-5" />
                          </button>
                          <input type="file" ref={marketingImageInputRef} className="hidden" accept="image/png,image/gif,image/jpeg,video/mp4" onChange={handleMarketingImageUpload} />
                        </div>
                        {localSettings.loginMarketingImageUrl && (
                          <button onClick={() => handleUpdate({ loginMarketingImageUrl: '' })} className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-600 transition-colors">Remover Imagem</button>
                        )}
                      </div>

                      <div className="space-y-6 p-6 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-white/5 mt-4">
                        <p className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] italic text-center">Coordenadas da Imagem</p>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo X: {localSettings.loginMarketingImageX ?? -350}px</span></div>
                            <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginMarketingImageX ?? -350} onChange={e => handleUpdate({ loginMarketingImageX: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo Y: {localSettings.loginMarketingImageY ?? 0}px</span></div>
                            <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginMarketingImageY ?? 0} onChange={e => handleUpdate({ loginMarketingImageY: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Escala: {localSettings.loginMarketingImageScale ?? 1.0}x</span></div>
                            <input type="range" min="0.1" max="5.0" step="0.1" value={localSettings.loginMarketingImageScale ?? 1.0} onChange={e => handleUpdate({ loginMarketingImageScale: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fundo da Tela */}
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Tipo de Fundo da Tela</label>
                        <select 
                          value={localSettings.loginScreenBgType || 'color'} 
                          onChange={e => handleUpdate({ loginScreenBgType: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                        >
                          <option value="color">COR SÓLIDA</option>
                          <option value="image">IMAGEM (JPEG/PNG)</option>
                          <option value="gif">GIF ANIMADO</option>
                          <option value="video">VÍDEO CURTO (MP4)</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Tema Animado (Efeito)</label>
                        <select 
                          value={localSettings.loginEffect || 'none'} 
                          onChange={e => handleUpdate({ loginEffect: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                        >
                          <option value="none">NENHUM EFEITO</option>
                          <option value="aurora">AURORA BOREAL</option>
                          <option value="particles">PARTÍCULAS FLUTUANTES</option>
                          <option value="stars">ESTRELAS CADENTES</option>
                          <option value="rain">CHUVA DIGITAL</option>
                          <option value="matrix">MATRIX CODE</option>
                          <option value="cyber">CYBERPUNK GRID</option>
                        </select>
                        <div className="flex items-center gap-3 ml-2 mt-2">
                          <input 
                            type="checkbox" 
                            id="loginEffectColorEnabled"
                            checked={localSettings.loginEffectColorEnabled || false} 
                            onChange={e => handleUpdate({ loginEffectColorEnabled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="loginEffectColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Personalizar Cor do Efeito</label>
                        </div>
                        {localSettings.loginEffectColorEnabled && (
                          <div className="flex gap-4 items-center animate-in zoom-in-95 mt-2">
                            <input type="color" value={localSettings.loginEffectColor || localSettings.primaryColor || '#00BFFF'} onChange={e => handleUpdate({ loginEffectColor: e.target.value })} className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-2 border-slate-100 dark:border-white/10" />
                            <p className="text-[8px] font-bold text-slate-400 uppercase italic">A cor do efeito se adapta a esta escolha</p>
                          </div>
                        )}
                      </div>

                      {localSettings.loginScreenBgType === 'color' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 ml-2">
                            <input 
                              type="checkbox" 
                              id="loginScreenBgColorEnabled"
                              checked={localSettings.loginScreenBgColorEnabled || false} 
                              onChange={e => handleUpdate({ loginScreenBgColorEnabled: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="loginScreenBgColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Personalizar Cor de Fundo</label>
                          </div>
                          {localSettings.loginScreenBgColorEnabled && (
                            <div className="flex gap-4 items-center animate-in zoom-in-95">
                              <input type="color" value={localSettings.loginScreenBgColor || '#0a0f1e'} onChange={e => handleUpdate({ loginScreenBgColor: e.target.value })} className="w-16 h-16 rounded-2xl cursor-pointer bg-transparent border-2 border-slate-100 dark:border-white/10" />
                              <input type="text" value={localSettings.loginScreenBgColor || '#0a0f1e'} onChange={e => handleUpdate({ loginScreenBgColor: e.target.value })} className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono text-xs outline-none" />
                            </div>
                          )}
                        </div>
                      )}
                      {localSettings.loginScreenBgType !== 'color' && (
                        <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Arquivo de Fundo (Upload/URL)</label>
                          <div className="flex gap-2">
                            <input 
                              value={localSettings.loginScreenBgUrl || ''} 
                              onChange={e => handleUpdate({ loginScreenBgUrl: e.target.value })} 
                              placeholder="https://..."
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-[10px] outline-none"
                            />
                            <button 
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = localSettings.loginScreenBgType === 'video' ? 'video/mp4' : 'image/*';
                                input.onchange = (e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => handleUpdate({ loginScreenBgUrl: ev.target?.result });
                                    reader.readAsDataURL(file);
                                  }
                                };
                                input.click();
                              }}
                              className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Especificações de Tamanho e Looping */}
                          <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/10">
                              <p className="text-[8px] font-black uppercase text-indigo-500 mb-1 tracking-widest">Tamanho Recomendado</p>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Full HD: 1920×1080</p>
                              <p className="text-[8px] font-medium text-slate-400 uppercase mt-1">Compatível com outros tamanhos proporcionais</p>
                            </div>
                            
                            {(localSettings.loginScreenBgType === 'gif' || localSettings.loginScreenBgType === 'video') && (
                              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-white/5">
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Ativar Looping</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase italic">Repetir automaticamente</p>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => handleUpdate({ loginScreenBgLoop: !localSettings.loginScreenBgLoop })} 
                                  className={`w-10 h-5 rounded-full transition-all relative ${localSettings.loginScreenBgLoop ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.loginScreenBgLoop ? 'left-5.5' : 'left-0.5'}`}></div>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 pt-4 border-t dark:border-white/5">
                        <div className="flex items-center gap-3 ml-2">
                          <input 
                            type="checkbox" 
                            id="loginMarketingPrimaryColorEnabled"
                            checked={localSettings.loginMarketingPrimaryColorEnabled || false} 
                            onChange={e => handleUpdate({ loginMarketingPrimaryColorEnabled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="loginMarketingPrimaryColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Personalizar Destaque Marketing (Hover)</label>
                        </div>
                        {localSettings.loginMarketingPrimaryColorEnabled && (
                          <div className="flex gap-4 items-center animate-in zoom-in-95">
                            <input type="color" value={localSettings.loginMarketingPrimaryColor || '#6366f1'} onChange={e => handleUpdate({ loginMarketingPrimaryColor: e.target.value })} className="w-16 h-16 rounded-2xl cursor-pointer bg-transparent border-2 border-slate-100 dark:border-white/10" />
                            <div className="flex-1">
                              <p className="text-[10px] font-black uppercase text-slate-500">Cor de Destaque</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase italic">Usada em efeitos de hover nos balões</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* --- PERSONALIZAÇÃO DO BOX DE LOGIN --- */}
                <section className="space-y-8 bg-white dark:bg-slate-900/50 p-8 md:p-12 rounded-[3.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
                  <div className="text-center space-y-2">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic text-indigo-500">Personalização do Box de Login</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ajuste as cores e o estilo do box</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxBgColorEnabled"
                          checked={localSettings.loginBoxBgColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxBgColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxBgColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Fundo do Box</label>
                      </div>
                      {localSettings.loginBoxBgColorEnabled && (
                        <input type="color" value={localSettings.loginBoxBgColor || '#0f172a'} onChange={e => handleUpdate({ loginBoxBgColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-2 border-white/10 animate-in zoom-in-95" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxBorderColorEnabled"
                          checked={localSettings.loginBoxBorderColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxBorderColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxBorderColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Borda do Box</label>
                      </div>
                      {localSettings.loginBoxBorderColorEnabled && (
                        <input type="color" value={localSettings.loginBoxBorderColor || '#ffffff'} onChange={e => handleUpdate({ loginBoxBorderColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-2 border-white/10 animate-in zoom-in-95" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxTitleColorEnabled"
                          checked={localSettings.loginBoxTitleColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxTitleColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxTitleColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Título do Box</label>
                      </div>
                      {localSettings.loginBoxTitleColorEnabled && (
                        <input type="color" value={localSettings.loginBoxTitleColor || '#ffffff'} onChange={e => handleUpdate({ loginBoxTitleColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-2 border-white/10 animate-in zoom-in-95" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxBtnColorEnabled"
                          checked={localSettings.loginBoxBtnColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxBtnColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxBtnColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Botão "Entrar"</label>
                      </div>
                      {localSettings.loginBoxBtnColorEnabled && (
                        <input type="color" value={localSettings.loginBoxBtnColor || '#00BFFF'} onChange={e => handleUpdate({ loginBoxBtnColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-2 border-white/10 animate-in zoom-in-95" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxTextColorEnabled"
                          checked={localSettings.loginBoxTextColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxTextColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxTextColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Texto do Box</label>
                      </div>
                      {localSettings.loginBoxTextColorEnabled && (
                        <input type="color" value={localSettings.loginBoxTextColor || '#94a3b8'} onChange={e => handleUpdate({ loginBoxTextColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-2 border-white/10 animate-in zoom-in-95" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 tracking-widest px-2"><span>Raio da Borda: {localSettings.loginBoxBorderRadius ?? 72}px</span></div>
                      <input type="range" min="0" max="150" step="1" value={localSettings.loginBoxBorderRadius ?? 72} onChange={e => handleUpdate({ loginBoxBorderRadius: parseInt(e.target.value) })} className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 tracking-widest px-2"><span>Padding Interno: {localSettings.loginBoxPadding ?? 40}px</span></div>
                      <input type="range" min="10" max="100" step="1" value={localSettings.loginBoxPadding ?? 40} onChange={e => handleUpdate({ loginBoxPadding: parseInt(e.target.value) })} className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                  </div>
                </section>

                <section className="space-y-8 bg-white dark:bg-slate-900/50 p-8 md:p-12 rounded-[3.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
                  <div className="text-center space-y-2">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic text-indigo-500">Alinhamento & Posição</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ajustes de layout estrutural</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full">
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Alinhamento Marketing</label>
                       <select value={localSettings.loginMarketingAlign || 'center'} onChange={e => handleUpdate({ loginMarketingAlign: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.8rem] px-6 py-5 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner">
                          <option value="left">ESQUERDA</option>
                          <option value="center">CENTRO</option>
                          <option value="right">DIREITA</option>
                       </select>
                    </div>
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Alinhamento do Box</label>
                       <select value={localSettings.loginBoxPosition || 'center'} onChange={e => handleUpdate({ loginBoxPosition: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.8rem] px-6 py-5 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner">
                          <option value="left">ESQUERDA</option>
                          <option value="center">CENTRO</option>
                          <option value="right">DIREITA</option>
                       </select>
                    </div>
                  </div>
                  <div className="flex flex-col items-center w-full">
                    <div className="w-full max-w-md space-y-6 p-8 bg-slate-50/50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5">
                      <p className="text-[11px] font-black uppercase text-indigo-400 tracking-[0.2em] italic text-center">Coordenadas Box</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo X: {localSettings.loginBoxLeft ?? 550}px</span></div>
                          <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginBoxLeft ?? 550} onChange={e => handleUpdate({ loginBoxLeft: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo Y: {localSettings.loginBoxTop ?? 0}px</span></div>
                          <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginBoxTop ?? 0} onChange={e => handleUpdate({ loginBoxTop: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Escala: {localSettings.loginBoxScale ?? 1.0}x</span></div>
                          <input type="range" min="0.1" max="3.0" step="0.1" value={localSettings.loginBoxScale ?? 1.0} onChange={e => handleUpdate({ loginBoxScale: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'loginButtons' && isMaster && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            {(localSettings.loginButtonsOrder || ['Plans', 'Request', 'Regularize', 'Support']).map((type, idx, arr) => (
               <React.Fragment key={type}>
                  {renderButtonConfigGroup(type, idx, arr.length)}
               </React.Fragment>
            ))}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-4">
             <section className="space-y-8">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 dark:border-blue-900/40">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </div>
                   <div>
                      <h3 className="text-sm font-black uppercase italic tracking-tighter text-blue-600 dark:text-blue-400 leading-none">Gestão de Dados</h3>
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Snapshot e Restauração do Terminal</p>
                   </div>
                </div>
                <div className="flex flex-col items-center justify-center py-12 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
                    <button 
                       type="button" 
                       onClick={isMaster ? exportFullBackup : () => exportTenantBackup(user?.tenantId || '')} 
                       className="flex flex-col items-center gap-4 p-10 bg-slate-50 dark:bg-slate-800 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm group"
                    >
                       <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform shadow-inner">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                       </div>
                       <div className="text-center">
                         <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white block">Baixar backup</span>
                         <span className="text-[7px] font-bold text-slate-400 uppercase mt-1">Exportar arquivo .json</span>
                       </div>
                    </button>

                    <button 
                       type="button" 
                       onClick={() => importInputRef.current?.click()} 
                       className="flex flex-col items-center gap-4 p-10 bg-slate-50 dark:bg-slate-800 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-500 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm group"
                    >
                       <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-inner">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 17l-4 4m0 0l-4-4m4 4V3" /></svg>
                       </div>
                       <div className="text-center">
                         <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white block">Restaurar</span>
                         <span className="text-[7px] font-bold text-slate-400 uppercase mt-1">Importar arquivo de dados</span>
                       </div>
                       <input type="file" ref={importInputRef} onChange={handleImportBackup} className="hidden" accept=".json" />
                    </button>
                   </div>
                </div>
             </section>
          </div>
        )}

        {activeTab === 'payments' && isMaster && (
          <div className="space-y-10 animate-in fade-in">
             <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-indigo-500 border-b dark:border-white/5 pb-2">1. Integração Mercado Pago</h3>
                <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Access Token (Produção)</label>
                    <input 
                      type="password" 
                      value={localSettings.mercadoPagoAccessToken || ''} 
                      onChange={e => handleUpdate({ mercadoPagoAccessToken: e.target.value })} 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                      placeholder="APP_USR-..."
                    />
                </div>
             </section>
             <section className="space-y-6 pt-10 border-t dark:border-white/5">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-indigo-500 border-b dark:border-white/5 pb-2">2. Pagamento Manual</h3>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Instruções de Pagamento</label>
                        <textarea 
                          value={localSettings.paymentInstructions || ''} 
                          onChange={e => handleUpdate({ paymentInstructions: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-300 dark:placeholder:text-slate-600" 
                          rows={3} 
                          placeholder="Chave PIX: 00.000.000/0001-00 (CNPJ)"
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Mensagem: Recebimento Manual</label>
                        <input 
                          value={localSettings.billingManualPendingMessage || ''} 
                          onChange={e => handleUpdate({ billingManualPendingMessage: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="Parabéns, o administrador irá verificar seu pagamento"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Mensagem: Pagamento Aprovado</label>
                        <input 
                          value={localSettings.billingApprovedMessage || ''} 
                          onChange={e => handleUpdate({ billingApprovedMessage: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                          placeholder="Parabéns, pagamento aprovado!"
                        />
                    </div>
                </div>
             </section>
          </div>
        )}

        <div className="pt-10 border-t border-slate-50 dark:border-slate-800 mt-10">
          <button onClick={saveToStorage} style={{ backgroundColor: localSettings.primaryColor }} className="w-full py-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">Salvar Preferências</button>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão de Categoria */}
      {confirmDeleteCat && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-8 shadow-2xl border border-white/10 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl text-rose-500 border border-rose-100 dark:border-rose-900/50">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-[var(--workspace-text)]">Excluir Categoria?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">Esta ação irá remover a categoria. Os itens dentro dela não serão apagados, apenas perderão o vínculo.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setConfirmDeleteCat(null)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={() => removeCategory(confirmDeleteCat)} className="py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Genérico para Gestor de Menu */}
      {showMenuConfirm.show && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-8 shadow-2xl border border-white/10 text-center animate-in zoom-in-95">
            <div className={`w-16 h-16 ${showMenuConfirm.color} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl text-white`}>
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-[var(--workspace-text)] leading-tight">{showMenuConfirm.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">Tem certeza que deseja continuar?</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowMenuConfirm(prev => ({ ...prev, show: false }))} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={showMenuConfirm.action} className={`py-4 ${showMenuConfirm.color} text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95`}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;