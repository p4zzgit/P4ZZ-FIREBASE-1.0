import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ProductList from './pages/ProductList';
import CategoryManagement from './pages/CategoryManagement';
import NewSale from './pages/NewSale';
import SalesHistory from './pages/SalesHistory';
import Reports from './pages/Reports';
import Tables from './pages/Tables';
import Deliveries from './pages/Deliveries';
import UserManagement from './pages/UserManagement';
import CustomerManagement from './pages/CustomerManagement';
import ExpenseManagement from './pages/ExpenseManagement';
import AdminSettings from './pages/AdminSettings';
import { Login } from './pages/Login';
import Payment from './pages/Payment';
import PlanManagement from './pages/PlanManagement';
import MyPlan from './pages/MyPlan';
import EmployeeManagement from './pages/EmployeeManagement';
import Support from './pages/Support';
import EmployeeReports from './pages/EmployeeReports';
import { LOW_STOCK_LIMIT } from '@/constants';
import { 
  getProducts, 
  getSales, 
  getCurrentUser, 
  setCurrentUser, 
  getUsers,
  saveUsers,
  getExpenses, 
  getConsumptions,
  getAppSettings, 
  getDeliveries, 
  getAccessRequests, 
  getPaymentRequests, 
  getOpenShift,
  openCashierShift,
  saveCashierClosure,
  closeCashierShift,
  DEFAULT_MENU_STRUCTURE,
  DEFAULT_SETTINGS,
  onFirebaseAuthStateChanged
} from './services/storage';

const App = () => {
  const [user, setUser] = useState(getCurrentUser());
  
  useEffect(() => {
    const unsubscribe = onFirebaseAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // Se o usuário estiver logado no Firebase, mas não no estado local,
        // podemos buscar os dados dele no Firestore ou apenas manter o estado.
        // Por enquanto, apenas garantimos que o estado local reflita o Firebase se necessário.
        console.log("Firebase Auth State Changed: Logged In", firebaseUser.email);
      } else {
        // Se deslogar do Firebase, desloga do app se estiver usando Firebase
        if (import.meta.env.VITE_USE_FIREBASE === 'true') {
          // setUser(null);
          // setCurrentUser(null);
        }
      }
    });
    return () => unsubscribe();
  }, []);
  const [currentView, setCurrentView] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [consumptions, setConsumptions] = useState([]);
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState(0);
  const [pendingAccessRequestsCount, setPendingAccessRequestsCount] = useState(0);
  const [pendingPaymentRequestsCount, setPendingPaymentRequestsCount] = useState(0); 
  const [lowStockCount, setLowStockCount] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  
  const [activeShift, setActiveShift] = useState(null);
  const [isCashierOpening, setIsCashierOpening] = useState(false);
  const [isCashierClosing, setIsCashierClosing] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState('');
  const [finalCashInput, setFinalCashInput] = useState('');
  const [isProcessingShift, setIsProcessingShift] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const isDemo = user?.role === 'demo';

  // Lógica de Tempo Restante para Conta Demo com Precisão de Segundos
  const demoStatus = useMemo(() => {
    if (!user || !user.expiresAt || user.role !== 'demo') return { text: '', isExpired: false, expiryStr: '' };
    
    const now = new Date().getTime();
    const expiryDate = new Date(user.expiresAt);
    const expiry = expiryDate.getTime();
    const diff = expiry - now;
    const expiryStr = expiryDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (diff <= 0) return { text: 'EXPIRADO', isExpired: true, expiryStr };

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let label = '';
    if (d > 0) label = `${d}D ${h}H ${m}M RESTANTES`;
    else if (h > 0) label = `${h}H ${m}M RESTANTES`;
    else label = `${m}M RESTANTES`;

    return { text: label, isExpired: false, expiryStr };
  }, [user]);

  const t = (key, def) => settings.customLabels?.[key] || def;

  const VIEW_LABELS = {
    'dashboard': t('menu_dashboard', 'PAINEL'),
    'products': t('menu_products', 'ESTOQUE'),
    'categories': t('menu_categories', 'CATEGORIAS'),
    'new-sale': t('menu_new-sale', 'VENDA DIRETA'),
    'sales-history': t('menu_sales-history', 'HISTÓRICO'),
    'reports': t('menu_reports', 'RELATÓRIOS'),
    'tables': t('menu_tables', 'MESAS'),
    'deliveries': t('menu_deliveries', 'ENTREGAS'),
    'user-management': 'GESTÃO DE USUÁRIOS',
    'customer-management': 'GESTÃO DE LICENÇAS',
    'expenses': t('menu_expenses', 'DESPESAS'),
    'settings': t('menu_settings', 'CONFIGURAÇÕES'),
    'payment': t('menu_payment', 'PAGAMENTOS'),
    'plan-management': 'PLANOS & OFERTAS',
    'my-plan': t('menu_my-plan', 'MEU PLANO'),
    'employee-management': t('menu_employee-management', 'FUNCIONÁRIOS'),
    'support': t('menu_support', 'SUPORTE TÉCNICO'),
    'employee-consumption': t('menu_employee-consumption', 'CONSUMO DE FUNCIONÁRIOS'),
    'employee-reports': t('menu_employee-reports', 'RELATÓRIOS DE EQUIPE'),
  };

  const handleNavigate = useCallback((view) => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const isMasterArea = ['user-management', 'customer-management', 'plan-management'].includes(view);
    if (isMasterArea && currentUser.tenantId !== 'MASTER') return;
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); handleNavigate('tables'); }
      else if (e.key === 'F2') { e.preventDefault(); handleNavigate('new-sale'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNavigate]);

  const handleLogout = useCallback(() => {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role !== 'admin' && currentUser.cashierStatus === 'Aberto') {
        setLogoutError('Por segurança, realize o fechamento do seu caixa antes de sair.');
        setTimeout(() => setLogoutError(null), 5000);
        return;
    }
    setCurrentUser(null);
    setUser(null);
  }, []);

  // Bloqueio Automático de Demo Expirada
  useEffect(() => {
    if (user?.role === 'demo' && demoStatus.isExpired && user.active) {
      const handleExpire = async () => {
        const allUsers = await getUsers();
        const updatedUsers = allUsers.map(u => {
          if (u.id === user.id) {
            return { ...u, active: false, deactivatedMessage: 'DEMO_EXPIRADA' };
          }
          return u;
        });
        await saveUsers(updatedUsers);
        alert('Sua conta DEMO expirou após 72 horas de uso. Entre em contato para adquirir um plano.');
        handleLogout();
      };
      handleExpire();
    }
  }, [user, demoStatus.isExpired, handleLogout]);

  const refreshData = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        setIsLoading(false);
        return;
    }
    
    try {
      const [
        localSetts, 
        masterSetts, 
        prods, 
        sls, 
        exps, 
        cons,
        dels, 
        accReqs, 
        payReqs,
        openShift
      ] = await Promise.all([
        getAppSettings(currentUser.tenantId || 'MASTER'),
        getAppSettings('MASTER'),
        getProducts(),
        getSales(),
        getExpenses(),
        getConsumptions(),
        getDeliveries(),
        getAccessRequests(),
        getPaymentRequests(),
        getOpenShift(currentUser.id)
      ]);

      setProducts(prods);
      setLowStockCount(prods.filter(p => p.stock < LOW_STOCK_LIMIT).length);
      setSales(sls);
      setExpenses(exps);
      setConsumptions(cons);
      setPendingDeliveriesCount(dels.filter(d => d.deliveryStage !== 'paused').length);
      setPendingAccessRequestsCount(accReqs.filter(r => r.status === 'pending').length);
      setPendingPaymentRequestsCount(payReqs.filter(p => p.status === 'pending').length);
      
      setActiveShift(openShift);

      if (!openShift && currentUser.role === 'employee' && !currentUser.skipCashierClosure && !isCashierOpening) {
        setIsCashierOpening(true);
      }

      setSettings({
        ...localSetts,
        menuStructure: localSetts.menuStructure || masterSetts.menuStructure || DEFAULT_MENU_STRUCTURE,
        menuShortcuts: localSetts.menuShortcuts || masterSetts.menuShortcuts || {},
        customLabels: { ...(masterSetts.customLabels || {}), ...(localSetts.customLabels || {}) },
        footerText: masterSetts.footerText || localSetts.footerText,
        billingThankYouMessage: masterSetts.billingThankYouMessage || localSetts.billingThankYouMessage
      });
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isCashierOpening]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    
    const handleUpdate = () => refreshData();
    window.addEventListener('p4zz_data_updated', handleUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('p4zz_data_updated', handleUpdate);
    };
  }, [refreshData, user?.id]);

  const handleOpenShift = async () => {
    if (!user || isProcessingShift) return;
    const cash = parseFloat(initialCashInput);
    if (isNaN(cash) || cash < 0) {
        alert("Valor inválido.");
        return;
    }
    setIsProcessingShift(true);
    try {
        const shift = await openCashierShift(user.id, user.tenantId, user.name, cash);
        setActiveShift(shift);
        setIsCashierOpening(false);
        setInitialCashInput('');
        const updatedUser = { ...user, cashierStatus: 'Aberto' as const };
        setCurrentUser(updatedUser);
        setUser(updatedUser);
    } finally {
        setIsProcessingShift(false);
    }
  };

  const cashierSummary = useMemo(() => {
    if (!activeShift) return { pix: 0, card: 0, cash: 0, totalExpected: 0 };
    const shiftSales = sales.filter(s => 
        s.userId === activeShift.userId && 
        s.status === 'Concluída' && 
        new Date(s.date) >= new Date(activeShift.openDate)
    );
    const pix = shiftSales.filter(s => s.paymentMethod === 'Pix').reduce((acc, s) => acc + s.total, 0);
    const card = shiftSales.filter(s => s.paymentMethod === 'Cartão').reduce((acc, s) => acc + s.total, 0);
    const cash = shiftSales.filter(s => s.paymentMethod === 'Dinheiro').reduce((acc, s) => acc + s.total, 0);
    return { 
        pix, card, cash, 
        totalExpected: activeShift.initialCash + cash 
    };
  }, [sales, activeShift]);

  const handleCloseShift = async () => {
    if (!user || !activeShift || isProcessingShift) return;
    const finalCash = parseFloat(finalCashInput);
    if (isNaN(finalCash) || finalCash < 0) {
        alert("Informe o valor contado.");
        return;
    }
    setIsProcessingShift(true);
    try {
        const metrics = cashierSummary;
        const totalInformed = metrics.pix + metrics.card + finalCash;
        const closure: CashierClosure = {
            id: Math.random().toString(36).substr(2, 9),
            userId: user.id, userName: user.name, tenantId: user.tenantId,
            date: new Date().toISOString(),
            systemPix: metrics.pix, systemCard: metrics.card, systemCash: metrics.cash,
            informedPix: metrics.pix, informedCard: metrics.card, informedCash: finalCash,
            totalSystem: metrics.totalExpected, totalInformed: totalInformed,
            difference: totalInformed - metrics.totalExpected
        };
        await saveCashierClosure(closure);
        await closeCashierShift(activeShift.id, finalCash);
        
        const updatedUser = { ...user, cashierStatus: 'Fechado' as const };
        setCurrentUser(updatedUser);
        setUser(updatedUser);
        setActiveShift(null);
        setIsCashierClosing(false);
        setFinalCashInput('');
        alert("Caixa fechado com sucesso.");
    } catch (err) {
        alert("Erro ao fechar o caixa.");
    } finally {
        setIsProcessingShift(false);
    }
  };

  const workspaceContrastColor = useMemo(() => {
    const isCustom = settings.workspaceBgColorEnabled;
    const bgColor = isCustom ? (settings.workspaceBgColor || (settings.themeMode === 'dark' ? '#020617' : '#f8fafc')) : (settings.themeMode === 'dark' ? '#020617' : '#f8fafc');
    const color = bgColor.replace('#', '');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#0f172a' : '#ffffff';
  }, [settings.workspaceBgColor, settings.workspaceBgColorEnabled, settings.themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.themeMode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    
    const isCustomBg = settings.workspaceBgColorEnabled;
    const finalBg = isCustomBg ? (settings.workspaceBgColor || (settings.themeMode === 'dark' ? '#020617' : '#f8fafc')) : (settings.themeMode === 'dark' ? '#020617' : '#f8fafc');

    const isCustomPrimary = settings.primaryColorEnabled;
    const finalPrimary = isCustomPrimary ? (settings.primaryColor || '#00BFFF') : '#00BFFF';

    root.style.setProperty('--sidebar-width', isSidebarExpanded ? `${settings.sidebarWidth || 255}px` : '80px');
    root.style.setProperty('--workspace-bg', finalBg);
    root.style.setProperty('--workspace-text', workspaceContrastColor);
    root.style.setProperty('--primary-color', finalPrimary);
  }, [settings, isSidebarExpanded, workspaceContrastColor]);

  if (!user) {
    return <Login settings={settings} onLoginSuccess={(u) => { setCurrentView('dashboard'); setUser(u); refreshData(); }} />;
  }

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className={`flex min-h-screen ${isDemo ? 'pt-8' : ''}`}>
       {isDemo && (
         <div className="fixed top-0 left-0 right-0 h-8 bg-amber-400 text-slate-900 z-[9999] flex items-center justify-center font-black text-[10px] uppercase tracking-[0.2em] shadow-md border-b border-amber-500">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2.5}/></svg>
              CONTA DEMO ATIVA — EXPIRA EM: {demoStatus.expiryStr} ({demoStatus.text})
            </span>
         </div>
       )}

       <Sidebar 
        currentView={currentView} onNavigate={handleNavigate} user={user} onLogout={handleLogout} settings={settings}
        onToggleTheme={() => setSettings({...settings, themeMode: settings.themeMode === 'light' ? 'dark' : 'light'})}
        isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} isExpanded={isSidebarExpanded}
        onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
        pendingDeliveriesCount={pendingDeliveriesCount} pendingAccessRequestsCount={pendingAccessRequestsCount}
        pendingPaymentRequestsCount={pendingPaymentRequestsCount} lowStockCount={lowStockCount}
      />

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 
          ${isSidebarExpanded ? 'md:ml-[var(--sidebar-width)]' : 'md:ml-20'} 
          ml-0`}
        style={{ backgroundColor: 'var(--workspace-bg)', color: 'var(--workspace-text)' }}
      >
        <header className="p-4 md:p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center no-print sticky top-0 backdrop-blur-md z-40" style={{ backgroundColor: 'transparent' }}>
           <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsMobileMenuOpen(true)}
               className="p-3 md:hidden text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-90"
               aria-label="Abrir Menu"
             >
               <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
               </svg>
             </button>
             <h1 className="text-lg md:text-xl font-black uppercase italic truncate max-w-[200px] md:max-w-none">{VIEW_LABELS[currentView]}</h1>
           </div>
           {user.role === 'employee' && !user.skipCashierClosure && user.cashierStatus === 'Aberto' && (
             <button onClick={() => setIsCashierClosing(true)} className="px-3 md:px-4 py-2 bg-rose-600 text-white rounded-lg font-black text-[10px] md:text-xs uppercase shadow-lg active:scale-95 transition-all">Fechar Caixa</button>
           )}
        </header>

        <main className="p-6 flex-1 overflow-y-auto">
          {currentView === 'dashboard' && <Dashboard products={products} sales={sales} expenses={expenses} />}
          {currentView === 'products' && <ProductList products={products} onUpdate={refreshData} />}
          {currentView === 'categories' && <CategoryManagement />}
          {currentView === 'new-sale' && <NewSale products={products} onSaleComplete={refreshData} onBack={() => handleNavigate('dashboard')} />}
          {currentView === 'sales-history' && <SalesHistory sales={sales} onRefresh={refreshData} />}
          {currentView === 'reports' && <Reports sales={sales} products={products} expenses={expenses} consumptions={consumptions} user={user} />}
          {currentView === 'tables' && <Tables products={products} onBack={() => handleNavigate('dashboard')} onUpdate={refreshData} />}
          {currentView === 'deliveries' && <Deliveries products={products} onRefresh={refreshData} />}
          {currentView === 'user-management' && <UserManagement />}
          {currentView === 'customer-management' && <CustomerManagement />}
          {currentView === 'expenses' && <ExpenseManagement expenses={expenses} onUpdate={refreshData} />}
          {currentView === 'settings' && <AdminSettings settings={settings} onUpdateSettings={setSettings} />}
          {currentView === 'payment' && <Payment onUpdate={refreshData} />}
          {currentView === 'plan-management' && <PlanManagement />}
          {currentView === 'my-plan' && <MyPlan />}
          {currentView === 'employee-management' && <EmployeeManagement onNavigate={handleNavigate} />}
          {currentView === 'support' && <Support onUpdate={refreshData} />}
          {currentView === 'employee-reports' && <EmployeeReports />}
        </main>
      </div>

      {isCashierOpening && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div className="bg-[var(--card-bg)] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-center border border-[var(--card-border)]">
                <h3 className="text-xl font-black uppercase italic mb-4 text-slate-800 dark:text-white">Abertura de Caixa</h3>
                <input autoFocus type="number" value={initialCashInput} onChange={e => setInitialCashInput(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl text-2xl font-black text-center mb-6 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white" placeholder="R$ 0.00" />
                <button onClick={handleOpenShift} disabled={isProcessingShift} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">Abrir Turno</button>
            </div>
         </div>
      )}

      {isCashierClosing && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div className="bg-[var(--card-bg)] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-[var(--card-border)]">
                <h3 className="text-xl font-black uppercase italic mb-4 text-center text-slate-800 dark:text-white">Fechamento</h3>
                <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl">
                    <div className="flex justify-between text-xs font-bold uppercase text-slate-400"><span>Entradas Dinheiro:</span><span className="text-slate-800 dark:text-white">R$ {cashierSummary.cash.toFixed(2)}</span></div>
                    <div className="flex justify-between font-black border-t border-slate-100 dark:border-slate-800 pt-2 mt-2 text-slate-800 dark:text-white"><span>Esperado:</span><span className="text-indigo-600">R$ {cashierSummary.totalExpected.toFixed(2)}</span></div>
                </div>
                <input autoFocus type="number" value={finalCashInput} onChange={e => setFinalCashInput(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl text-2xl font-black text-center mb-6 outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-white" placeholder="R$ 0.00" />
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setIsCashierClosing(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-xs">Voltar</button>
                    <button onClick={handleCloseShift} disabled={isProcessingShift} className="py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Fechar</button>
                </div>
            </div>
         </div>
      )}

      {logoutError && (
        <div className="fixed bottom-10 right-10 bg-rose-600 text-white p-4 rounded-xl shadow-2xl z-[1000] font-black uppercase text-xs animate-in slide-in-from-bottom-4">
            {logoutError}
        </div>
      )}
    </div>
  );
};

export default App;