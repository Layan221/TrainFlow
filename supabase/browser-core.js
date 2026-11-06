window.TF = {
  cloud: true,
  async init() { throw new Error('إعدادات الاتصال غير مكتملة. يرجى التواصل مع مسؤول النظام.'); },
  home(user) { return user.role === 'supervisor' ? 'supervisor-dashboard.html' : 'trainee-dashboard.html'; },
  esc(value = '') { return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); },
  today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; },
  date(value) { if (!value) return 'غير محدد'; const date = new Date(value.slice(0,10)+'T12:00:00'); return isNaN(date) ? 'غير محدد' : date.toLocaleDateString('ar-SA',{calendar:'gregory'}); },
  myTrainees(user) { return this.users().filter(item => item.role === 'trainee' && item.supervisorId === user.id); },
  myTasks(user) { return this.tasks().filter(item => user.role === 'trainee' ? item.traineeId === user.id : item.supervisorId === user.id && this.myTrainees(user).some(trainee => trainee.id === item.traineeId)); }
};
