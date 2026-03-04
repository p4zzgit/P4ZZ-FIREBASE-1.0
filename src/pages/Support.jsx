import React, { useState, useEffect } from 'react';
import { getAppSettings, saveAppSettings, getCurrentUser, DEFAULT_SETTINGS } from '../services/storage';

const Support = ({ onUpdate }) => {
  const user = getCurrentUser();
  const isMaster = user?.tenantId === 'MASTER' && user?.role === 'admin';
  
  // localSettings carregará as definições do MASTER para visualização de todos
  const [localSettings, setLocalSettings] = useState(DEFAULT_SETTINGS);
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Carrega sempre do MASTER para garantir que todos vejam o suporte oficial configurado pelo dono do sistema
    getAppSettings('MASTER').then(setLocalSettings);
  }, []);

  const handleSave = () => {
    if (!isMaster) return;
    setIsSaving(true);
    setTimeout(async () => {
      await saveAppSettings(localSettings, 'MASTER');
      setIsSaving(false);
      setShowToast(true);
      if (onUpdate) onUpdate();
      setTimeout(() => setShowToast(false), 3000);
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 animate-in fade-in duration-500">
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-[9px] uppercase tracking-widest animate-in slide-in-from-top-4">
          Central de Suporte Atualizada
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
           
           {/* Removido o SVG decorativo absoluto que criava o círculo ao fundo */}

           <div className="relative z-10">
              {isMaster ? (
                <div className="space-y-8">
                   <div className="flex items-center gap-4 border-b dark:border-white/5 pb-6">
                      <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner overflow-hidden border border-slate-100 dark:border-slate-800">
                         {localSettings.logoUrl ? (
                            <img src={localSettings.logoUrl} className="w-full h-full object-contain p-2" alt="Sua Logo" />
                         ) : (
                            <div className="text-xl font-black italic">S</div>
                         )}
                      </div>
                      <div>
                         <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Editor de Suporte</h3>
                         <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Configure o que seus clientes verão nesta aba</p>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className="space-y-1.5">
                         <label className="text-[9px] font-black uppercase text-indigo-500 ml-2 tracking-widest">Título da Página</label>
                         <input 
                            value={localSettings.supportPageTitle || ''} 
                            onChange={e => setLocalSettings({...localSettings, supportPageTitle: e.target.value.toUpperCase()})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                         />
                      </div>

                      <div className="space-y-1.5">
                         <label className="text-[9px] font-black uppercase text-indigo-500 ml-2 tracking-widest">Conteúdo (Mensagem)</label>
                         <textarea 
                            value={localSettings.supportPageContent || ''} 
                            onChange={e => setLocalSettings({...localSettings, supportPageContent: e.target.value})}
                            rows={8}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none"
                            placeholder="Descreva as instruções de suporte..."
                         />
                      </div>

                      <div className="space-y-1.5">
                         <label className="text-[9px] font-black uppercase text-emerald-500 ml-2 tracking-widest">Link Direto WhatsApp</label>
                         <input 
                            value={localSettings.whatsappLink || ''} 
                            onChange={e => setLocalSettings({...localSettings, whatsappLink: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                            placeholder="https://wa.me/55..."
                         />
                      </div>
                   </div>

                   <button 
                      onClick={handleSave} 
                      disabled={isSaving}
                      style={{ backgroundColor: localSettings.primaryColor }}
                      className="w-full py-6 rounded-3xl text-white font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all disabled:opacity-50"
                   >
                      {isSaving ? 'SALVANDO...' : 'ATUALIZAR CENTRAL DE SUPORTE'}
                   </button>
                </div>
              ) : (
                <div className="space-y-10 text-center animate-in zoom-in-95 duration-500">
                   
                   {/* LOGO LIMPA DO WORKSPACE (Sem fundos circulares ou sombras excessivas) */}
                   {localSettings.logoUrl && (
                     <div className="inline-flex w-32 h-32 items-center justify-center mb-4 overflow-hidden transition-transform hover:scale-105">
                        <img src={localSettings.logoUrl} className="w-full h-full object-contain drop-shadow-lg" alt="Logo Workspace" />
                     </div>
                   )}
                   
                   <div className={!localSettings.logoUrl ? "pt-12" : ""}>
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-tight mb-4">
                        {localSettings.supportPageTitle || 'CENTRAL DE SUPORTE'}
                      </h2>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner max-w-2xl mx-auto">
                         <p className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase leading-relaxed whitespace-pre-line tracking-wide">
                            {localSettings.supportPageContent || 'Nossa equipe está disponível para lhe ajudar.'}
                         </p>
                      </div>
                   </div>

                   <div className="pt-6">
                      <a 
                         href={localSettings.whatsappLink || '#'} 
                         target="_blank" 
                         rel="noreferrer"
                         className="inline-flex items-center gap-4 bg-emerald-500 hover:bg-emerald-600 text-white px-12 py-7 rounded-3xl font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl transition-all transform active:scale-95 group"
                      >
                         <svg className="w-6 h-6 animate-bounce" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338-11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                         Falar com Suporte VIP
                      </a>
                   </div>
                </div>
              )}
           </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 flex items-start gap-4">
           <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-500 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest italic leading-none">Informativo</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed mt-2">
                 O Administrador Master gerencia as informações de suporte exibidas aqui. Todos os usuários acessam os mesmos canais oficiais de contato.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Support;