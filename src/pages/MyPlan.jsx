import React, { useMemo, useState, useEffect } from 'react';
import { getCurrentUser, getGlobalPlans } from '../services/storage';

const MyPlan = () => {
  const user = getCurrentUser();
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    getGlobalPlans().then(setPlans);
  }, []);

  const details = useMemo(() => {
    if (!user) return null;

    const matchedPlan = plans.find(p => p.name === user.planName);
    
    // Lógica de Alta Precisão (72h exatas) para Demo
    const hasExpiryDate = !!user.expiresAt && user.expiresAt.trim() !== '';
    const now = new Date();
    const createdAt = user.createdAt ? new Date(user.createdAt) : null;
    
    let daysLeftDisplay = '0';
    let expiryDisplayStr = 'ACESSO VITALÍCIO';

    if (hasExpiryDate) {
        const expiryDate = new Date(user.expiresAt);
        const diff = expiryDate.getTime() - now.getTime();
        
        if (diff > 0) {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            // Para exibição grande no painel, mostramos apenas o dia se for > 0, ou horas se for < 1 dia
            if (user.role === 'demo') {
                daysLeftDisplay = d > 0 ? `${d}D ${h}H` : `${h}H ${m}M`;
            } else {
                daysLeftDisplay = d.toString();
            }
        } else {
            daysLeftDisplay = '0';
        }
        
        expiryDisplayStr = expiryDate.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } else {
        daysLeftDisplay = '∞';
    }

    const expiry = hasExpiryDate ? new Date(user.expiresAt) : null;
    const isExpired = expiry ? now > expiry : false;
    const graceDays = user.gracePeriod ?? 10;
    
    const toleranceLimit = expiry ? new Date(expiry.getTime()) : null;
    if (toleranceLimit) {
        toleranceLimit.setDate(toleranceLimit.getDate() + graceDays);
    }
    
    const isInGrace = isExpired && toleranceLimit ? now <= toleranceLimit : false;

    let statusLabel = 'ATIVO';
    let statusColor = 'bg-emerald-600';
    let statusDesc = 'Sua licença está em dia.';

    if (user.role === 'demo') {
        statusLabel = 'CONTA DEMO';
        statusColor = 'bg-indigo-600';
        statusDesc = 'Acesso de teste de 72h. Após o prazo, o terminal será bloqueado automaticamente.';
    } else if (!user.active) {
      statusLabel = 'BLOQUEADO';
      statusColor = 'bg-rose-600';
      statusDesc = 'Acesso interrompido. Regularize sua fatura para reativar o terminal.';
    } else if (isInGrace) {
      statusLabel = 'EM CARÊNCIA';
      statusColor = 'bg-orange-500';
      const graceRemaining = toleranceLimit ? Math.ceil((toleranceLimit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      statusDesc = `Licença vencida. Bloqueio total em ${graceRemaining} dias.`;
    }

    return {
      matchedPlan,
      daysLeft: daysLeftDisplay,
      statusLabel,
      statusColor,
      statusDesc,
      createdAtStr: createdAt ? createdAt.toLocaleDateString('pt-BR') : 'Não registrado',
      expiryStr: expiryDisplayStr,
      isVitalicio: !hasExpiryDate
    };
  }, [user, plans]);

  if (!user || !details) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {user.role === 'demo' && (
          <div className="bg-indigo-600 p-6 rounded-[2rem] text-white flex items-center gap-4 shadow-xl animate-pulse border-4 border-indigo-400">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">LICENÇA TEMPORÁRIA ATIVA</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Seu tempo restante é de {details.daysLeft}. Aproveite os recursos.</p>
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden">
           <div className={`absolute top-0 right-0 px-8 py-3 rounded-bl-[2rem] text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-lg ${details.statusColor}`}>
              {details.statusLabel}
           </div>
           
           <div className="space-y-6">
              <div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-tight">Olá, {user.name}</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">ID DO TERMINAL: {user.tenantId}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-50 dark:border-slate-800">
                 <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Documento Registrado</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200">{user.document || '---'}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Início do Acesso</p>
                    <p className="text-sm font-black text-indigo-500 uppercase italic">{details.createdAtStr}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Término do Acesso</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200">{details.expiryStr}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipo de Licença</p>
                    <p className={`text-sm font-black uppercase ${user.role === 'demo' ? 'text-indigo-500' : 'text-emerald-500'}`}>{user.role.toUpperCase()}</p>
                 </div>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase italic bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">{details.statusDesc}</p>
           </div>

           <div className="mt-12 flex items-end justify-between">
              <div>
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Validade Programada</p>
                 <p className="text-2xl font-black italic tracking-tighter text-indigo-500">{details.expiryStr}</p>
              </div>
              <div className="text-right">
                 <span className="text-6xl font-black italic tracking-tighter text-slate-900 dark:text-white">
                    {details.daysLeft}
                 </span>
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tempo Restante</p>
              </div>
           </div>
        </div>

        <div className="bg-slate-950 p-8 md:p-10 rounded-[3rem] shadow-2xl flex flex-col justify-between text-white relative overflow-hidden">
           <div className="relative z-10">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 mb-6">Plano Ativo</h3>
              <div className="space-y-4">
                 <h4 className="text-4xl font-black italic uppercase tracking-tighter">{user.planName || 'PERSONALIZADO'}</h4>
                 <div className="inline-block px-4 py-2 bg-white/10 rounded-2xl border border-white/5 font-black text-emerald-400 text-2xl tracking-tighter italic">
                    {details.matchedPlan?.price === 0 ? 'GRÁTIS' : `R$ ${details.matchedPlan?.price.toFixed(2) || '0.00'}`}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MyPlan;