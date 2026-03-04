import { db as firestore, auth, storage as firebaseStorage } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

const STORAGE_PREFIX = 'p4zz_system_';

// Controle de estado da API em tempo de execução
let apiEnabled = true;
export const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

// Firebase Storage Helper
export const uploadImage = async (path, base64) => {
  if (!USE_FIREBASE || !firebaseStorage || !base64.startsWith('data:')) return base64;
  try {
    const storageRef = ref(firebaseStorage, path);
    await uploadString(storageRef, base64, 'data_url');
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Erro no upload para Firebase Storage:", error);
    return base64;
  }
};

// Firebase Auth Helpers
export const loginWithFirebase = async (email, pass) => {
  if (!USE_FIREBASE || !auth) return null;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    return userCredential.user;
  } catch (error) {
    console.error("Erro no login Firebase:", error);
    throw error;
  }
};

export const logoutWithFirebase = async () => {
  if (!USE_FIREBASE || !auth) return;
  await signOut(auth);
};

export const onFirebaseAuthStateChanged = (callback) => {
  if (!USE_FIREBASE || !auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

const IS_SERVER_MODE = typeof window !== 'undefined' && 
                       !window.location.hostname.includes('webcontainer') && 
                       !window.location.hostname.includes('localhost') &&
                       !window.location.hostname.includes('stackblitz') &&
                       !window.location.hostname.includes('github.io') &&
                       !window.location.hostname.includes('run.app') &&
                       !window.location.hostname.includes('vercel.app') &&
                       !window.location.hostname.includes('netlify.app') &&
                       window.location.hostname !== '127.0.0.1';

const API_URL = './api.php';

// Evento customizado para notificar mudanças de dados entre componentes
export const notifyDataChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('p4zz_data_updated'));
  }
};

const db = {
  get: async (key, defaultValue, tenantId = 'MASTER') => {
    if (USE_FIREBASE && firestore) {
      try {
        const docRef = doc(firestore, tenantId, key);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data().value;
        }
        return defaultValue;
      } catch (e) {
        console.error("Erro ao buscar no Firebase:", e);
      }
    }

    if (IS_SERVER_MODE && apiEnabled) {
      try {
        const response = await fetch(`${API_URL}?action=get&tenant=${tenantId}&key=${key}`, {
            signal: AbortSignal.timeout(3000)
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        return data || defaultValue;
      } catch (e) {
        if (IS_SERVER_MODE) {
          console.warn("API indisponível ou erro de conexão. Usando armazenamento local temporariamente.");
          apiEnabled = false;
          setTimeout(() => { apiEnabled = true; }, 30000);
        }
      }
    }
    const data = localStorage.getItem(STORAGE_PREFIX + key);
  try {
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`Error parsing storage key ${key}:`, e);
    return defaultValue;
  }
  },
  set: async (key, value, tenantId = 'MASTER') => {
    if (USE_FIREBASE && firestore) {
      try {
        const docRef = doc(firestore, tenantId, key);
        await setDoc(docRef, { value, updatedAt: new Date().toISOString() });
      } catch (e) {
        console.error("Erro ao salvar no Firebase:", e);
      }
    }

    if (IS_SERVER_MODE && apiEnabled) {
      try {
        const response = await fetch(`${API_URL}?action=set&tenant=${tenantId}&key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
          signal: AbortSignal.timeout(3000)
        });
        if (!response.ok) throw new Error();
      } catch (e) {
        if (IS_SERVER_MODE) {
          apiEnabled = false;
          setTimeout(() => { apiEnabled = true; }, 30000);
        }
      }
    }
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    notifyDataChanged(); // Notifica o App sobre a mudança
  }
};

const getActiveTenantId = () => {
  const userStr = localStorage.getItem('p4zz_session_user');
  if (!userStr) return 'MASTER';
  try {
    const user = JSON.parse(userStr);
    return user.tenantId || 'MASTER';
  } catch {
    return 'MASTER';
  }
};

export const DEFAULT_MENU_STRUCTURE = [
  { id: 'main', label: 'Operacional', items: ['dashboard', 'tables', 'new-sale', 'deliveries'] },
  { id: 'inventory', label: 'CATEGORIAS', items: ['products', 'categories'] },
  { id: 'financial', label: 'Financeiro', items: ['expenses', 'sales-history', 'reports'] },
  { id: 'config', label: 'Configurações', items: ['my-plan', 'employee-management', 'support'] },
  { id: 'master', label: 'MASTER', items: ['payment', 'user-management', 'customer-management', 'plan-management', 'settings'] }
];

export const DEFAULT_SETTINGS = {
  systemName: 'P4ZZ SYSTEM',
  primaryColor: '#00BFFF',
  accentColor: '#00BFFF',
  loginStyle: 'apple',
  themeMode: 'light',
  sidebarTheme: 'dark',
  sidebarColor: '#0f0f12',
  sidebarActiveColor: '#ffffff',
  sidebarWidth: 230,        // Padrão solicitado: 230px
  sidebarItemPadding: 6,    // Padrão solicitado: 6px
  sidebarFontSize: 10,      // Padrão solicitado: 10px
  sidebarIconSize: 16,      // Padrão solicitado: 16px
  sidebarEffectOpacity: 0.1,
  uiDensity: 'standard',
  buttonStyle: 'rounded',
  cardShadow: 'soft',
  glassIntensity: 20,
  loginTitle: 'ACESSO RESTRITO',
  loginWelcomeMessage: 'Bem-vindo de volta',
  loginButtonText: 'Entrar',
  loginBgColor: '#010818',
  loginAnimColor: '#00BFFF',
  loginAnimSpeed: 0.5,
  loginOrbDensity: 1,
  loginShowGradient: true,
  loginBoxTop: 0,
  loginBoxLeft: 550,
  loginBoxScale: 1.0,
  loginBoxPosition: 'center',
  
  // Defaults para Marketing
  loginSalesTitle: 'P4ZZ CONTROL',
  loginSalesTitleSize: 72,
  loginSalesTitleX: 0,
  loginSalesTitleY: 0,
  loginSalesTitleAnim: 'slide',
  loginSalesTitleColor: '#ffffff',
  loginSalesText: 'O SISTEMA MAIS COMPLETO E INTELIGENTE PARA GESTÃO DE ESTABELECIMENTOS.',
  loginSalesTextSize: 12,
  loginSalesTextX: 0,
  loginSalesTextY: 0,
  loginSalesTextAnim: 'typing',
  loginSalesTextColor: '#94a3b8',
  loginMarketingAlign: 'left',
  loginFeatures: 'GESTÃO COMPLETA\nSUPORTE 24H\nRELATÓRIOS INTELIGENTES',
  loginFeaturesX: 0,
  loginFeaturesY: 0,
  loginFeaturesAnimSpeed: 3,
  loginFeaturesColor: '#0f172a',
  loginFeaturesTextColor: '#ffffff',
  loginFeaturesBorderRadius: 40,
  loginFeaturesPadding: 16,
  loginFeaturesGap: 16,
  loginFeaturesAnimType: 'bounce',
  loginMarketingLeft: -350,
  loginMarketingTop: 0,
  loginMarketingScale: 1.0,
  loginBalloonColor: '#0f172a',
  loginBalloonHeight: 60,
  loginMarketingTextEnabled: true,
  loginMarketingImageEnabled: false,
  loginMarketingImageUrl: '',
  loginMarketingImageX: -350,
  loginMarketingImageY: 0,
  loginMarketingImageScale: 1.0,
  loginMarketingImageAnim: 'none',
  loginScreenBgColor: '#0a0f1e',
  loginMarketingPrimaryColor: '#6366f1',
  loginThematicBorder: 'Nenhum',
  loginEffect: 'aurora',
  loginEffectColor: '#00BFFF',

  borderRadius: '1.5rem',
  glassMode: false,
  sidebarBubbles: false,
  sidebarTextColor: '#ffffff',
  workspaceBgColor: '#f8fafc',
  globalBanMessage: 'ACESSO BLOQUEADO: Este terminal foi banido por violação dos termos de uso.',
  globalSuspensionMessage: 'ACESSO SUSPENSO: Regularize sua fatura para reativar o acesso ao sistema.',
  autoPrintOnPayment: false,
  loginBoxBgColor: 'rgba(15, 23, 42, 0.8)',
  loginBoxBorderColor: 'rgba(255, 255, 255, 0.1)',
  loginBoxTitleColor: '#ffffff',
  loginBoxBtnColor: '#00BFFF',
  loginBoxTextColor: '#94a3b8',
  loginBoxBorderRadius: 72,
  loginBoxPadding: 40,
  loginScreenBgType: 'color',
  loginScreenBgUrl: '',
  loginScreenBgLoop: false,
  loginBoxBorderImageUrl: '',
  loginBoxBorderImageScale: 1.0,
  loginBoxBorderImageX: 0,
  loginBoxBorderImageY: 0,
  loginBoxThemes: [
    { name: 'Padrão', settings: { loginBoxBgColor: 'rgba(15, 23, 42, 0.8)', loginBoxBorderColor: 'rgba(255, 255, 255, 0.1)', loginBoxTitleColor: '#ffffff', loginBoxBtnColor: '#00BFFF', loginBoxTextColor: '#94a3b8', loginBoxBorderImageUrl: '' } }
  ],
  primaryColorEnabled: false,
  workspaceBgColorEnabled: false,
  loginBoxBgColorEnabled: false,
  loginBoxBorderColorEnabled: false,
  loginBoxTitleColorEnabled: false,
  loginBoxBtnColorEnabled: false,
  loginBoxTextColorEnabled: false,
  loginScreenBgColorEnabled: false,
  loginMarketingPrimaryColorEnabled: false,
  sidebarMainColorEnabled: false,
  sidebarTextColorEnabled: false,
  sidebarSecondaryColorEnabled: false,
  loginEffectColorEnabled: false,
};

const ALL_PERMISSIONS = [
  'dashboard', 'products', 'categories', 'new-sale', 'sales-history', 
  'reports', 'tables', 'deliveries', 'user-management', 'expenses', 
  'settings', 'customer-management', 'payment', 'plan-management', 
  'my-plan', 'employee-management', 'support'
];

export const getUsers = async () => {
  if (USE_FIREBASE && firestore) {
    try {
      const docRef = doc(firestore, 'MASTER', 'users');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().value;
      }
    } catch (e) {
      console.error("Erro ao buscar usuários no Firebase:", e);
    }
  }

  if (IS_SERVER_MODE && apiEnabled) {
    try {
      const response = await fetch(`${API_URL}?action=get_users`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return await response.json();
      throw new Error();
    } catch (e) {
      if (IS_SERVER_MODE) {
        apiEnabled = false;
        setTimeout(() => { apiEnabled = true; }, 30000);
      }
    }
  }
  
  let parsed = [];
  try {
    const usersData = localStorage.getItem(STORAGE_PREFIX + 'users');
    parsed = usersData ? JSON.parse(usersData) : [];
  } catch (e) {
    console.error("Error parsing users list:", e);
  }
  
  if (parsed.length === 0) {
    const admin = {
      id: 'admin-id',
      name: 'ADMINISTRADOR',
      tenantId: 'MASTER',
      email: 'admin',
      passwordHash: 'admin',
      role: 'admin',
      active: true,
      permissions: ALL_PERMISSIONS
    };
    await saveUsers([admin]);
    return [admin];
  }
  return parsed;
};

export const saveUsers = async (users) => {
  if (USE_FIREBASE && firestore) {
    try {
      const docRef = doc(firestore, 'MASTER', 'users');
      await setDoc(docRef, { value: users, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.error("Erro ao salvar usuários no Firebase:", e);
    }
  }

  if (IS_SERVER_MODE && apiEnabled) {
    try {
      const response = await fetch(`${API_URL}?action=save_users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users),
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) throw new Error();
    } catch (e) {
      if (IS_SERVER_MODE) {
        apiEnabled = false;
        setTimeout(() => { apiEnabled = true; }, 30000);
      }
    }
  }
  localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify(users));
  notifyDataChanged();
};

export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('p4zz_session_user');
  try {
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Error parsing session user:", e);
    localStorage.removeItem('p4zz_session_user');
    return null;
  }
};

export const setCurrentUser = (user) => {
  if (user) localStorage.setItem('p4zz_session_user', JSON.stringify(user));
  else localStorage.removeItem('p4zz_session_user');
  notifyDataChanged();
};

export const getProducts = async () => {
  const tenantId = getActiveTenantId();
  return await db.get(`products_${tenantId}`, [], tenantId);
};

export const saveProducts = async (products) => {
  const tenantId = getActiveTenantId();
  await db.set(`products_${tenantId}`, products, tenantId);
};

export const getConsumptions = async () => {
  const tenantId = getActiveTenantId();
  return await db.get(`consumptions_${tenantId}`, [], tenantId);
};

export const saveConsumption = async (record) => {
  try {
    const tenantId = getActiveTenantId();
    const consumptions = await getConsumptions();
    consumptions.push(record);
    await db.set(`consumptions_${tenantId}`, consumptions, tenantId);
    
    const products = await getProducts();
    const p = products.find(prod => prod.id === record.productId);
    if (p) {
        p.stock = Math.max(0, p.stock - record.quantity);
        await saveProducts(products);
    }
    return true;
  } catch (e) {
    return false;
  }
};

export const saveAllConsumptions = async (consumptions) => {
  const tenantId = getActiveTenantId();
  await db.set(`consumptions_${tenantId}`, consumptions, tenantId);
};

export const deleteConsumption = async (id) => {
  try {
    const tenantId = getActiveTenantId();
    const consumptions = await getConsumptions();
    const record = consumptions.find(c => c.id === id);
    
    if (record) {
      const products = await getProducts();
      const p = products.find(prod => prod.id === record.productId);
      if (p) {
        p.stock += record.quantity;
        await saveProducts(products);
      }
      
      const updatedConsumptions = consumptions.filter(c => c.id !== id);
      await db.set(`consumptions_${tenantId}`, updatedConsumptions, tenantId);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const getCashierClosures = async () => {
  const tenantId = getActiveTenantId();
  return await db.get(`closures_${tenantId}`, [], tenantId);
};

export const saveCashierClosure = async (closure) => {
  const tenantId = getActiveTenantId();
  const closures = await getCashierClosures();
  closures.push(closure);
  await db.set(`closures_${tenantId}`, closures, tenantId);
};

export const deleteCashierClosure = async (id) => {
  const tenantId = getActiveTenantId();
  const closures = await getCashierClosures();
  const updated = closures.filter(c => c.id !== id);
  await db.set(`closures_${tenantId}`, updated, tenantId);
};

export const getCashierShifts = async () => {
  const tenantId = getActiveTenantId();
  return await db.get(`shifts_${tenantId}`, [], tenantId);
};

export const saveCashierShifts = async (shifts) => {
  const tenantId = getActiveTenantId();
  await db.set(`shifts_${tenantId}`, shifts, tenantId);
};

export const getOpenShift = async (userId) => {
  const shifts = await getCashierShifts();
  return shifts.find(s => s.userId === userId && s.status === 'aberto') || null;
};

export const openCashierShift = async (userId, tenantId, userName, initialCash) => {
  const shifts = await getCashierShifts();
  const newShift = {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    tenantId,
    userName,
    openDate: new Date().toISOString(),
    initialCash,
    status: 'aberto'
  };
  shifts.push(newShift);
  await saveCashierShifts(shifts);
  return newShift;
};

export const closeCashierShift = async (shiftId, finalCash) => {
  const shifts = await getCashierShifts();
  const index = shifts.findIndex(s => s.id === shiftId);
  if (index !== -1) {
    shifts[index].status = 'fechado';
    shifts[index].closeDate = new Date().toISOString();
    shifts[index].finalCash = finalCash;
    await saveCashierShifts(shifts);
  }
};

export const getSales = async () => {
  const tenantId = getActiveTenantId();
  return await db.get(`sales_${tenantId}`, [], tenantId);
};

export const saveSale = async (sale) => {
  try {
    const tenantId = getActiveTenantId();
    const sales = await getSales();
    sales.push(sale);
    await db.set(`sales_${tenantId}`, sales, tenantId);
    
    const products = await getProducts();
    sale.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) p.stock = Math.max(0, p.stock - item.quantity);
    });
    await saveProducts(products);
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteSale = async (id) => {
  const tenantId = getActiveTenantId();
  const sales = await getSales();
  const saleToRemove = sales.find(s => s.id === id);
  if (saleToRemove) {
    const products = await getProducts();
    saleToRemove.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) p.stock += item.quantity;
    });
    await saveProducts(products);
  }
  const updated = sales.filter(s => s.id !== id);
  await db.set(`sales_${tenantId}`, updated, tenantId);
};

export const getAppSettings = async (tenantId) => {
  const tid = tenantId || getActiveTenantId();
  return await db.get(`settings_${tid}`, DEFAULT_SETTINGS, tid);
};

export const saveAppSettings = async (settings, tenantId) => {
  const tid = tenantId || getActiveTenantId();
  await db.set(`settings_${tid}`, settings, tid);
};

export const getCategories = async () => {
  const tenantId = getActiveTenantId();
  return await db.get(`categories_${tenantId}`, [], tenantId);
};

export const saveCategories = async (categories) => {
  const tenantId = getActiveTenantId();
  await db.set(`categories_${tenantId}`, categories, tenantId);
};

export const getExpenses = async () => {
  const tenantId = getActiveTenantId();
  return await db.get(`expenses_${tenantId}`, [], tenantId);
};

export const saveExpense = async (expense) => {
  const tenantId = getActiveTenantId();
  const expenses = await getExpenses();
  expenses.push(expense);
  await db.set(`expenses_${tenantId}`, expenses, tenantId);
};

export const deleteExpense = async (id) => {
  const tenantId = getActiveTenantId();
  const expenses = await getExpenses();
  const updated = expenses.filter(e => e.id !== id);
  await db.set(`expenses_${tenantId}`, updated, tenantId);
};

export const getDeliveries = async () => {
  const tenantId = getActiveTenantId();
  return await db.get(`deliveries_${tenantId}`, [], tenantId);
};

export const saveDelivery = async (delivery) => {
  const tenantId = getActiveTenantId();
  const deliveries = await getDeliveries();
  const index = deliveries.findIndex(d => d.id === delivery.id);
  if (index !== -1) deliveries[index] = delivery;
  else deliveries.push(delivery);
  await db.set(`deliveries_${tenantId}`, deliveries, tenantId);
};

export const saveAllDeliveries = async (deliveries) => {
  const tenantId = getActiveTenantId();
  await db.set(`deliveries_${tenantId}`, deliveries, tenantId);
};

export const removeDelivery = async (id) => {
  const tenantId = getActiveTenantId();
  const deliveries = await getDeliveries();
  const updated = deliveries.filter(d => d.id !== id);
  await db.set(`deliveries_${tenantId}`, updated, tenantId);
};

export const getNextDeliveryNumber = async () => {
  const sales = await getSales();
  const deliveries = await getDeliveries();
  const lastSaleNum = sales.filter(s => s.isDelivery).reduce((max, s) => Math.max(max, s.deliveryNumber || 0), 0);
  const lastDelivNum = deliveries.reduce((max, d) => Math.max(max, d.displayId || 0), 0);
  return Math.max(lastSaleNum, lastDelivNum) + 1;
};

export const getAccessRequests = async () => {
  return await db.get('access_requests', []);
};

export const saveAccessRequest = async (request) => {
  const requests = await getAccessRequests();
  requests.push(request);
  await db.set('access_requests', requests);
};

export const removeAccessRequest = async (id) => {
  const requests = await getAccessRequests();
  const updated = requests.filter(r => r.id !== id);
  await db.set('access_requests', updated);
};

export const getPaymentRequests = async () => {
  return await db.get('payment_requests', []);
};

export const savePaymentRequest = async (request) => {
  const requests = await getPaymentRequests();
  const index = requests.findIndex(r => r.id === request.id);
  if (index !== -1) requests[index] = request;
  else requests.push(request);
  await db.set('payment_requests', requests);
};

export const removePaymentRequest = async (id) => {
  const requests = await getPaymentRequests();
  const updated = requests.filter(r => r.id !== id);
  await db.set('payment_requests', updated);
};

export const getGlobalEstablishmentCategories = async () => {
  return await db.get('global_est_categories', ["Restaurante", "Pizzaria", "Lanchonete", "Loja", "Outros"]);
};

export const saveGlobalEstablishmentCategories = async (categories) => {
  await db.set('global_est_categories', categories);
};

export const getGlobalPlans = async () => {
  const plans = await db.get('global_plans', []);
  if (plans.length === 0) {
    const defaultPlans = [
      { id: 'p1', name: 'MENSAL BRONZE', days: 30, price: 99.90, description: 'Acesso básico' },
      { id: 'p2', name: 'ANUAL OURO', days: 365, price: 999.00, description: 'Melhor custo benefício' }
    ];
    await db.set('global_plans', defaultPlans);
    return defaultPlans;
  }
  return plans;
};

export const saveGlobalPlans = async (plans) => {
  await db.set('global_plans', plans);
};

export const getCustomers = async (tenantId) => {
  return await db.get(`customers_${tenantId}`, [], tenantId);
};

export const saveCustomers = async (customers, tenantId) => {
  await db.set(`customers_${tenantId}`, customers, tenantId);
};

export const getTables = async () => {
  const tenantId = getActiveTenantId();
  const tables = await db.get(`tables_${tenantId}`, [], tenantId);
  if (tables.length === 0) {
    const initialTables = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      label: (i + 1).toString().padStart(2, '0'),
      status: 'Livre',
      items: []
    }));
    await db.set(`tables_${tenantId}`, initialTables, tenantId);
    return initialTables;
  }
  return tables;
};

export const saveTables = async (tables) => {
  const tenantId = getActiveTenantId();
  await db.set(`tables_${tenantId}`, tables, tenantId);
};

export const getTenantEmployees = async (tenantId) => {
  const users = await getUsers();
  return users.filter(u => u.tenantId === tenantId && u.role === 'employee');
};

export const getMenuBackup = async (tenantId) => {
  const tid = tenantId || getActiveTenantId();
  return await db.get(`menu_backup_${tid}`, null, tid);
};

export const saveMenuBackup = async (data, tenantId) => {
  const tid = tenantId || getActiveTenantId();
  await db.set(`menu_backup_${tid}`, data, tid);
};

export const exportFullBackup = async () => {
    const data = { 
      users: await getUsers(), 
      plans: await getGlobalPlans(), 
      requests: await getAccessRequests(), 
      paymentRequests: await getPaymentRequests(), 
      categories: await getGlobalEstablishmentCategories() 
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `p4zz_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

export const exportTenantBackup = async (tenantId) => {
    const data = { 
      products: await getProducts(), 
      sales: await getSales(), 
      expenses: await getExpenses(), 
      categories: await getCategories(), 
      tables: await getTables(), 
      deliveries: await getDeliveries(), 
      settings: await getAppSettings(tenantId) 
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `p4zz_${tenantId}_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

export const importFullBackup = (content) => {
  try {
    const data = JSON.parse(content);
    if (data.users) localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify(data.users));
    if (data.plans) localStorage.setItem(STORAGE_PREFIX + 'global_plans', JSON.stringify(data.plans));
    notifyDataChanged();
    return true;
  } catch (e) { return false; }
};