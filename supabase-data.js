(() => {
  'use strict';
  const config = window.TRAINFLOW_CONFIG || {};
  const unavailable = () => { throw new Error('خدمة استعادة كلمة المرور غير مفعّلة حاليًا. يرجى التواصل مع مسؤول النظام.'); };
  TF.sendReset = unavailable;
  TF.finishReset = unavailable;
  if (!config.url && !config.publishableKey && !config.requireCloud) return;
  TF.init = async () => { throw new Error('إعدادات الاتصال غير مكتملة. يرجى التواصل مع مسؤول النظام.'); };
  if (!config.url || !config.publishableKey) return;
  // Keep the session and Supabase auth broadcasts scoped to this tab.
  const storage = window.sessionStorage;
  const project = new URL(config.url).host;
  const tabIdKey = `trainflow-auth-tab:${project}`;
  let tabId = storage.getItem(tabIdKey);
  if (!tabId) {
    tabId = crypto.randomUUID();
    storage.setItem(tabIdKey, tabId);
  }
  const client = window.supabase.createClient(config.url,config.publishableKey,{
    auth:{storage,storageKey:`${tabIdKey}:${tabId}`}
  });
  const tables = {tf_users:'profiles',tf_tasks:'tasks',tf_reports:'reports'};
  const columns = {
    profiles:['id','name','email','role','supervisorId','trainingField','bio','available','createdAt'],
    tasks:['id','traineeId','supervisorId','title','description','dueDate','priority','status','supervisorNotes','traineeNotes','createdAt','completedAt'],
    reports:['id','traineeId','supervisorId','date','work','learned','challenges','plan','updatedAt']
  };
  let cache = {tf_users:[],tf_tasks:[],tf_reports:[]}, currentId = null, recovery = false;
  const cacheKey = `trainflow-data:${project}:${tabId}`;
  const saveCache = () => {
    try { storage.setItem(cacheKey, JSON.stringify({userId:currentId, savedAt:Date.now(), data:cache})); } catch {}
  };
  const restoreCache = () => {
    try {
      const saved = JSON.parse(storage.getItem(cacheKey));
      if (saved?.userId !== currentId || Date.now() - saved.savedAt > 20000) return false;
      if (!Object.keys(tables).every(key => Array.isArray(saved.data?.[key]))) return false;
      if (!saved.data.tf_users.some(user => user.id === currentId)) return false;
      cache = saved.data;
      return true;
    } catch { return false; }
  };
  const check = result => { if (result.error) throw new Error('تعذّر إتمام العملية. تحقق من الاتصال والبيانات وحاول مجددًا.'); return result.data; };
  const refresh = async () => {
    const entries = await Promise.all(Object.entries(tables).map(async ([key,table]) => [key,check(await client.from(table).select('*'))]));
    cache = Object.fromEntries(entries);
    saveCache();
  };
  const action = async body => check(await client.functions.invoke('manage-accounts',{body}));
  client.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') recovery = true;
  });
  TF.cloud = true;
  TF.id = () => crypto.randomUUID();
  TF.migrate = TF.migrateCredentials = () => {};
  TF.users = () => structuredClone(cache.tf_users);
  TF.tasks = () => structuredClone(cache.tf_tasks);
  TF.reports = () => structuredClone(cache.tf_reports);
  TF.session = () => TF.users().find(user => user.id === currentId) || null;
  TF.init = async () => {
    const {session} = check(await client.auth.getSession());
    currentId = session?.user?.id || null;
    if (currentId && !restoreCache()) await refresh();
  };
  TF.signIn = async (email,password,role) => {
    const result = await client.auth.signInWithPassword({email,password});
    if (result.error?.code === 'email_not_confirmed') {
      throw new Error('أكد بريدك من رسالة تأكيد الحساب ثم حاول تسجيل الدخول.');
    }
    if (result.error?.code === 'invalid_credentials') {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة. إذا لم تنشئ حسابًا بعد، سجّل أولًا.');
    }
    const {user} = check(result);
    currentId = user.id;
    await refresh();
    const profile = TF.session();
    if (!profile || profile.role !== role) {
      await client.auth.signOut({scope:'local'}); currentId = null;
      throw new Error('الحساب غير متاح لنوع الدخول المحدد.');
    }
    location.href = TF.home(profile);
  };
  TF.logout = async () => { check(await client.auth.signOut({scope:'local'})); currentId = null; storage.removeItem(cacheKey); location.href = 'login.html'; };
  TF.registerSupervisor = details => action({action:'register-supervisor',...details});
  TF.sendReset = async email => {
    check(await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('reset-password.html',location.href).href}));
  };
  TF.finishReset = async password => {
    if (!recovery) throw new Error('افتح رابط الاستعادة المرسل إلى بريدك. إذا انتهت صلاحيته، اطلب رابطًا جديدًا.');
    check(await client.auth.updateUser({password}));
    check(await client.auth.signOut({scope:'local'})); recovery = false;
  };
  TF.setOfficePresence = async (id, available) => {
    const profile = cache.tf_users.find(user => user.id === id && user.role === 'supervisor');
    if (!profile || id !== currentId) throw new Error('لا يمكن تحديث حالة المكتب لهذا الحساب.');
    check(await client.from('profiles').update({available}).eq('id', id));
    const updated = cache.tf_users.find(user => user.id === id);
    if (updated) updated.available = available;
    saveCache();
  };
  TF.write = async (key,rows) => {
    const table = tables[key];
    if (!table) throw new Error('عملية غير مدعومة.');
    const old = cache[key];
    for (const row of rows) {
      const previous = old.find(item => item.id === row.id);
      if (JSON.stringify(previous) === JSON.stringify(row)) continue;
      if (key === 'tf_users') {
        if (!previous) { await action({action:'create-trainee',name:row.name,email:row.email,password:row.password,trainingField:row.trainingField}); continue; }
        if (row.password) { await action({action:'change-password',traineeId:row.id,password:row.password}); continue; }
        const changes = {};
        for (const name of ['name','bio','trainingField','available']) if (row[name] !== previous[name]) changes[name] = row[name];
        if (Object.keys(changes).length) check(await client.from(table).update(changes).eq('id',row.id));
      } else {
        const data = Object.fromEntries(columns[table].filter(name => row[name] !== undefined).map(name => [name,row[name]]));
        if (previous) {
          const changes = Object.fromEntries(Object.entries(data).filter(([name,value]) => JSON.stringify(previous[name]) !== JSON.stringify(value)));
          if (Object.keys(changes).length) check(await client.from(table).update(changes).eq('id',row.id));
        } else check(await client.from(table).insert(data));
      }
    }
    for (const row of old.filter(item => !rows.some(next => next.id === item.id))) {
      if (key !== 'tf_users') throw new Error('حذف السجلات غير متاح.');
      await action({action:'delete-trainee',traineeId:row.id});
    }
    await refresh();
  };
})();
