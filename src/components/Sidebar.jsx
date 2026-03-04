import React, { useMemo } from 'react';
import { DEFAULT_MENU_STRUCTURE } from '../services/storage';

const Sidebar = ({ 
  currentView, 
  onNavigate, 
  user, 
  onLogout, 
  settings, 
  isOpen, 
  onClose, 
  isExpanded = true,
  onToggleExpand,
  onToggleTheme,
  pendingDeliveriesCount = 0, 
  pendingAccessRequestsCount = 0,
  pendingPaymentRequestsCount = 0,
  lowStockCount = 0
}) => {
  const isAdmin = user.role === 'admin';
  const isEmployee = user.role === 'employee';
  const isMaster = user.tenantId === 'MASTER' && isAdmin;
  const isDemo = user.role === 'demo';
  const isCustomerOrDemo = user.role === 'customer' || user.role === 'demo';

  // Lógica para mostrar a aba de Pagamentos (5 dias antes do vencimento ou carência)
  const showPaymentTab = useMemo(() => {
    if (isMaster) return true;
    if (isEmployee) return false;
    if (!user.expiresAt) return false;

    const now = new Date();
    now.setHours(0,0,0,0);
    const expiry = new Date(user.expiresAt + 'T00:00:00');
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Exibe se faltar 5 dias ou menos, ou se já estiver vencido (carência)
    return diffDays <= 5;
  }, [user, isMaster, isEmployee]);

  const DEFAULT_LABELS = {
    'dashboard': 'PAINEL',
    'tables': 'MESAS',
    'new-sale': 'VENDA DIRETA',
    'deliveries': 'ENTREGAS',
    'products': 'ESTOQUE',
    'categories': 'CATEGORIAS',
    'expenses': 'DESPESAS',
    'sales-history': 'HISTÓRICO',
    'reports': 'RELATÓRIOS',
    'my-plan': 'MEU PLANO',
    'payment': 'PAGAMENTO',
    'user-management': 'USUÁRIOS',
    'customer-management': 'LICENÇAS',
    'plan-management': 'PLANOS',
    'settings': 'CONFIGURAÇÕES',
    'employee-management': 'FUNCIONÁRIOS',
    'support': 'SUPORTE'
  };

  const t = (id, def) => settings.customLabels?.[`menu_${id}`] || def;

  const dynamicTextColor = useMemo(() => {
    const lightThemes = ['light', 'glacier', 'eas-anim', 'spr-anim', 'sum-anim'];
    const isLightTheme = lightThemes.includes(settings.sidebarTheme);
    
    if (settings.sidebarTheme === 'colored' && settings.sidebarTextColorEnabled) {
      return settings.sidebarTextColor || '#ffffff';
    }
    
    if (settings.sidebarTheme === 'dark' || settings.sidebarTheme === 'light') {
      return 'var(--sidebar-text)';
    }

    return isLightTheme ? '#0f172a' : '#ffffff';
  }, [settings.sidebarTextColor, settings.sidebarTextColorEnabled, settings.sidebarTheme]);

  const isLightMode = dynamicTextColor === '#0f172a';

  const sidebarThemeData = useMemo(() => {
    const themeMap = {
        'dark': { background: 'var(--sidebar-bg)', className: '' },
        'light': { background: 'var(--sidebar-bg)', className: '' },
        'midnight': { background: '#020617', className: '' },
        'carbon': { background: '#171717', className: '' },
        'nebula': { background: 'linear-gradient(180deg, #3b0764 0%, #0f172a 100%)', className: '' },
        'ocean': { background: 'linear-gradient(180deg, #164e63 0%, #083344 100%)', className: '' },
        'forest': { background: 'linear-gradient(180deg, #14532d 0%, #020617 100%)', className: '' },
        'glacier': { background: 'linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%)', className: '' },
        'colored': { 
          background: settings.sidebarGradientEnabled && settings.sidebarSecondaryColorEnabled
            ? `linear-gradient(180deg, ${settings.sidebarMainColorEnabled ? (settings.sidebarMainColor || settings.primaryColor || '#00BFFF') : (settings.primaryColor || '#00BFFF')} 0%, ${settings.sidebarSecondaryColor || '#020617'} 100%)`
            : (settings.sidebarMainColorEnabled ? (settings.sidebarMainColor || settings.primaryColor || '#00BFFF') : (settings.primaryColor || '#00BFFF')), 
          className: '' 
        },
        'aurora-anim': { background: 'linear-gradient(270deg, #059669, #06b6d4, #8b5cf6, #ec4899)', className: 'theme-anim-fluid' },
        'neon-anim': { background: '#000000', className: 'theme-anim-matrix' },
        'ocean-anim': { background: 'linear-gradient(180deg, #083344, #0e7490, #164e63)', className: 'theme-anim-fluid' },
        'neb-anim': { background: 'linear-gradient(45deg, #0f172a, #3b0764, #1e1b4b, #0f172a)', className: 'theme-anim-fluid' },
        'mat-anim': { background: '#000000', className: 'theme-anim-matrix' },
        'wav-anim': { background: 'linear-gradient(135deg, #1e3a8a, #3b82f6, #60a5fa)', className: 'theme-anim-fluid' },
        'sno-anim': { background: 'linear-gradient(180deg, #1e293b, #0f172a)', className: 'theme-anim-snow' },
        'aur-anim': { background: 'linear-gradient(270deg, #065f46, #0d9488, #4338ca)', className: 'theme-anim-fluid' },
        'ste-anim': { background: '#020617', className: 'theme-anim-stars' },
        'geo-anim': { background: 'linear-gradient(45deg, #111827, #1f2937, #111827)', className: 'theme-anim-fluid' },
        'cyb-anim': { background: 'linear-gradient(180deg, #020617, #312e81, #020617)', className: 'theme-anim-pulse' },
        'fir-anim': { background: 'linear-gradient(180deg, #450a0a, #000000)', className: 'theme-anim-pulse' },
        'flu-anim': { background: '#0f172a', className: 'theme-anim-matrix' },
        'xma-anim': { background: 'linear-gradient(180deg, #7f1d1d, #064e3b)', className: 'theme-anim-snow' },
        'eas-anim': { background: 'linear-gradient(135deg, #fef3c7, #fae8ff, #dcfce7)', className: 'theme-anim-fluid' },
        'jun-anim': { background: 'linear-gradient(180deg, #d97706, #7c2d12, #000000)', className: 'theme-anim-pulse' },
        'bra-anim': { background: 'linear-gradient(135deg, #15803d, #eab308, #1d4ed8)', className: 'theme-anim-fluid' },
        'nyr-anim': { background: '#020617', className: 'theme-anim-stars' },
        'hal-anim': { background: 'linear-gradient(180deg, #2e1065, #000000, #4c1d95)', className: 'theme-anim-pulse' },
        'car-anim': { background: 'linear-gradient(45deg, #db2777, #7c3aed, #2563eb, #db2777)', className: 'theme-anim-fluid' },
        'aut-anim': { background: 'linear-gradient(180deg, #9a3412, #431407)', className: 'theme-anim-fluid' },
        'spr-anim': { background: 'linear-gradient(135deg, #fce7f3, #dcfce7, #fdf2f8)', className: 'theme-anim-fluid' },
        'sum-anim': { background: 'linear-gradient(180deg, #0ea5e9, #fbbf24)', className: 'theme-anim-sun' }
    };

    return themeMap[settings.sidebarTheme] || { background: '#0f172a', className: '' };
  }, [settings.sidebarTheme, settings.sidebarMainColor, settings.primaryColor]);

  const renderItem = (id, label, icon) => {
    const isActive = currentView === id;
    const primaryColor = settings.primaryColor || '#00BFFF';
    
    const badgeCount = (id === 'deliveries' && pendingDeliveriesCount > 0) ? pendingDeliveriesCount : 
                      (id === 'user-management' && (pendingAccessRequestsCount + pendingPaymentRequestsCount) > 0) ? (pendingAccessRequestsCount + pendingPaymentRequestsCount) :
                      (id === 'payment' && isMaster && pendingPaymentRequestsCount > 0) ? pendingPaymentRequestsCount :
                      (id === 'products' && lowStockCount > 0) ? lowStockCount : 0;

    const badgeColorClass = 'bg-rose-600';

    return (
      <button
        key={id}
        type="button"
        onClick={() => { onNavigate(id); if (onClose) onClose(); }}
        className={`relative flex items-center transition-all duration-300 group rounded-xl active:scale-95
          ${isExpanded ? 'w-[calc(100%-1rem)] px-2.5 mx-2' : 'w-12 h-12 justify-center mx-auto'}
          ${isActive ? 'shadow-2xl scale-105' : 'hover:bg-white/10'}
          ${!isLightMode ? 'sidebar-text-shadow' : ''}
        `}
        style={{ 
          backgroundColor: isActive ? primaryColor : 'transparent',
          color: isActive ? '#fff' : dynamicTextColor,
          marginBottom: `${settings.sidebarItemPadding || 8}px`,
          paddingTop: isExpanded ? '6px' : '0',
          paddingBottom: isExpanded ? '6px' : '0'
        }}
        title={!isExpanded ? label : undefined}
      >
        <div className="relative flex items-center justify-center">
            <svg style={{ width: `${settings.sidebarIconSize || 21}px`, height: `${settings.sidebarIconSize || 21}px` }} fill="none" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
            {badgeCount > 0 && !isExpanded && (
                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900 ${badgeColorClass}`}></span>
            )}
        </div>

        <div className={`flex-1 flex items-center justify-between overflow-hidden transition-all duration-300 ${isExpanded ? 'ml-3 opacity-100' : 'w-0 opacity-0 ml-0 hidden'}`}>
            <span className="font-black uppercase tracking-widest whitespace-nowrap leading-tight" style={{ fontSize: `${settings.sidebarFontSize || 10}px` }}>{label}</span>
            {badgeCount > 0 && (
                <span className={`${badgeColorClass} text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold min-w-[18px] text-center ml-2 shadow-sm`}>
                   {badgeCount}
                </span>
            )}
        </div>
      </button>
    );
  };

  const MENU_ICONS = {
    'dashboard': 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    'tables': 'M3 10h18M3 14h18M3 18h18M3 6h18',
    'new-sale': 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
    'deliveries': 'M13 10V3L4 14h7v7l9-11h-7z',
    'products': 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    'categories': 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    'expenses': 'M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
    'sales-history': 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    'reports': 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    'my-plan': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    'user-management': 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 01-9-3.5',
    'customer-management': 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z',
    'plan-management': 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l4.318-4.318a2.25 2.25 0 000-3.182L11.16 3.659A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z',
    'settings': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    'support': 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
    'employee-management': 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2',
    'employee-consumption': 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
    'employee-reports': 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    'payment': 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'
  };

  const dynamicMenuStructure = useMemo(() => {
    const struct = settings.menuStructure || DEFAULT_MENU_STRUCTURE;
    return struct.map(cat => {
      const visibleItems = cat.items.filter(id => {
        if (isEmployee) return user.permissions?.includes(id);
        
        // Regras de visibilidade para itens da categoria MASTER
        if (id === 'payment') return isMaster;
        if (id === 'user-management') return isMaster;
        if (id === 'customer-management') return isMaster;
        if (id === 'plan-management') return isMaster;
        if (id === 'settings') return isMaster || isCustomerOrDemo;
        
        return true;
      });
      return { ...cat, items: visibleItems };
    }).filter(cat => cat.items.length > 0);
  }, [settings.menuStructure, user.permissions, isEmployee, isMaster, isCustomerOrDemo, showPaymentTab]);

  return (
    <>
      <aside 
        className={`fixed left-0 bottom-0 flex flex-col z-[70] transition-all duration-500 border-r border-slate-200 dark:border-white/10 shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${sidebarThemeData.className}`} 
        style={{ 
          background: sidebarThemeData.background,
          width: isExpanded || (typeof window !== 'undefined' && window.innerWidth < 768) ? `${settings.sidebarWidth || 255}px` : '80px',
          top: isDemo ? '32px' : '0'
        }}
      >
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex flex-col gap-3 bg-black/5 dark:bg-black/10">
           <div className="flex items-center justify-between">
              <div className="flex items-center">
                 <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 shadow-lg">
                   {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain p-1" alt="Logo" /> : <span className="text-xl font-black italic text-white" style={{ color: settings.primaryColor }}>P</span>}
                 </div>
                 <div className={`ml-3 overflow-hidden transition-all duration-300 ${isExpanded || (typeof window !== 'undefined' && window.innerWidth < 768) ? 'opacity-100' : 'w-0 opacity-0'}`}>
                   <span className={`text-[11px] font-black tracking-tight uppercase truncate leading-tight block ${!isLightMode ? 'sidebar-text-shadow' : ''}`} style={{ color: dynamicTextColor }}>
                     {isMaster ? settings.systemName : user.name.split(' ')[0]}
                   </span>
                   <span className={`text-[8px] font-bold uppercase tracking-widest block ${!isLightMode ? 'sidebar-text-shadow opacity-70' : ''}`} style={{ color: dynamicTextColor }}>
                     {isMaster ? 'ADMIN MASTER' : user.tenantId}
                   </span>
                 </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                 {/* Botão de Fechar para Mobile */}
                 <button 
                   onClick={onClose} 
                   className="p-2 md:hidden hover:bg-white/10 rounded-lg transition-colors active:scale-90" 
                   style={{ color: dynamicTextColor }}
                   aria-label="Fechar Menu"
                 >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>

                 {(isExpanded || (typeof window !== 'undefined' && window.innerWidth < 768)) && (
                   <>
                     <button onClick={onToggleTheme} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Trocar Tema" style={{ color: dynamicTextColor }}>
                        {settings.themeMode === 'light' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.364 17.636l-.707.707M6.364 6.364l-.707.707m12.728 12.728l-.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                        )}
                     </button>
                     <button onClick={onToggleExpand} className="hidden md:block p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Recolher Menu" style={{ color: dynamicTextColor }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                     </button>
                   </>
                 )}
              </div>
           </div>

           {!isExpanded && (typeof window !== 'undefined' && window.innerWidth >= 768) && (
             <div className="flex flex-col items-center gap-2">
                <button onClick={onToggleTheme} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" style={{ color: dynamicTextColor }}>
                  {settings.themeMode === 'light' ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.364 17.636l-.707.707M6.364 6.364l-.707.707m12.728 12.728l-.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
                </button>
                <button onClick={onToggleExpand} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors rotate-180" style={{ color: dynamicTextColor }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
             </div>
           )}
        </div>

        <div className={`flex-1 overflow-y-auto custom-scrollbar py-4 space-y-4`} style={{ padding: '8px 0' }}>
          {dynamicMenuStructure.map((section) => (
            <div key={section.id}>
              <div className={`px-4 mb-2 transition-opacity duration-300 ${(isExpanded || (typeof window !== 'undefined' && window.innerWidth < 768)) ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                 <p className={`text-[9px] font-black uppercase tracking-[0.2em] italic text-slate-500 ${!isLightMode ? 'sidebar-text-shadow' : ''}`}>{section.label}</p>
              </div>
              <div>{section.items.map(viewId => renderItem(viewId, t(viewId, DEFAULT_LABELS[viewId]), MENU_ICONS[viewId] || ''))}</div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-black/5 dark:bg-black/20 flex-shrink-0 flex flex-col items-center justify-center">
          <button 
            onClick={onLogout} 
            className={`flex items-center transition-all rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 ${(isExpanded || (typeof window !== 'undefined' && window.innerWidth < 768)) ? 'px-4 py-3 w-full' : 'justify-center w-12 h-12'} hover:text-rose-500`}
            style={{ color: isLightMode ? '#64748b' : 'rgba(255,255,255,0.7)' }}
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
             <span className={`ml-3 text-[10px] font-black uppercase tracking-widest overflow-hidden transition-all ${(isExpanded || (typeof window !== 'undefined' && window.innerWidth < 768)) ? 'opacity-100' : 'w-0 opacity-0'}`}>Sair da Conta</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;