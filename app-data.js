(() => {
  'use strict';
  const read = (key, fallback = []) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch { throw new Error('تعذّر قراءة البيانات المحفوظة. احتفظ بنسخة من بيانات المتصفح قبل إصلاحها.'); }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const array = key => { const value = read(key); return Array.isArray(value) ? value : []; };
  const id = prefix => `${prefix}_${crypto.randomUUID()}`;
  const merge = (items, incoming) => {
    incoming.filter(Boolean).forEach(item => {
      if (item.id != null && !items.some(x => String(x.id) === String(item.id))) items.push({...item, id: String(item.id)});
    });
    return items;
  };
  function migrate() {
    if (localStorage.getItem('tf_migration_v1')) return;
    const users = array('tf_users');
    const supervisor = read('trainflowSupervisor', null);
    merge(users, [supervisor, ...array('trainflowSupervisors'), ...array('trainflow_supervisors')].filter(Boolean).map(u => ({...u, role:'supervisor'})));
    merge(users, [...array('trainflowTrainees'), ...array('trainflow_trainees')].map(u => ({...u, role:'trainee'})));
    users.forEach(u => {
      u.id = String(u.id);
      if (u.supervisorId != null) u.supervisorId = String(u.supervisorId);
      if (u.role === 'supervisor') u.supervisorLinkCode ||= id('LINK').slice(-8).toUpperCase();
    });
    const tasks = merge(array('tf_tasks'), [...array('trainflow_tasks'), ...array('trainflowTasks')]);
    tasks.forEach(t => {
      t.traineeId = String(t.traineeId);
      t.supervisorId = String(t.supervisorId || users.find(u => u.id === t.traineeId)?.supervisorId || '');
      if (['done','complete'].includes(t.status)) t.status = 'completed';
      if (['in-progress','in_progress'].includes(t.status)) t.status = 'progress';
    });
    write('tf_users', users);
    write('tf_tasks', tasks);
    write('tf_reports', merge(array('tf_reports'), [...array('trainflow_reports'), ...array('trainflowReports')]));
    localStorage.setItem('tf_migration_v1', '1');
  }
  window.TF = {
    read, write, id, migrate,
    migrateCredentials() {
      if (localStorage.getItem('tf_credentials_v2')) return;
      const users = array('tf_users');
      users.filter(u => u.role === 'trainee').forEach(u => {
        u.password = u.code || u.traineeCode || u.loginCode || u.password;
        delete u.code; delete u.traineeCode; delete u.loginCode;
      });
      write('tf_users',users);
      localStorage.setItem('tf_credentials_v2','1');
    },
    users: () => array('tf_users'), tasks: () => array('tf_tasks'), reports: () => array('tf_reports'),
    session() { return this.users().find(u => u.id === localStorage.getItem('tf_session')) || null; },
    home(u) { return u.role === 'supervisor' ? 'supervisor-dashboard.html' : 'trainee-dashboard.html'; },
    login(u) { localStorage.setItem('tf_session', u.id); location.href = this.home(u); },
    logout() {
      ['tf_session','trainflowCurrentUser','trainflow_current_user','supervisorLoggedIn','traineeLoggedIn'].forEach(k => localStorage.removeItem(k));
      location.href = 'login.html';
    },
    esc(value = '') { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    date(value) { if (!value) return 'غير محدد'; const d = new Date(value.slice(0,10)+'T12:00:00'); return isNaN(d) ? 'غير محدد' : d.toLocaleDateString('ar-SA', {calendar:'gregory'}); },
    myTrainees(u) { return this.users().filter(t => t.role === 'trainee' && t.supervisorId === u.id); },
    myTasks(u) { return this.tasks().filter(t => u.role === 'trainee' ? t.traineeId === u.id : t.supervisorId === u.id && this.myTrainees(u).some(x => x.id === t.traineeId)); }
  };
})();
