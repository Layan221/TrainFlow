(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const e = TF.esc;
  const page = location.pathname.split('/').pop() || 'index.html';
  const params = new URLSearchParams(location.search);
  const message = (text, ok = false, target = 'msg') => { const el = $(target); if (!el) return; clearTimeout(el.dismissTimer); el.textContent = text; el.className = `message ${ok ? 'success' : 'error'}`; if (ok) el.dismissTimer = setTimeout(() => { if (el.textContent === text) { el.textContent = ''; el.className = 'message'; } }, 4500); };
  const submitted = (formId, text) => {
    const form = $(formId);
    form.reset();
    const oldMessage = form.querySelector('.message');
    if (oldMessage) { clearTimeout(oldMessage.dismissTimer); oldMessage.textContent = ''; oldMessage.className = 'message'; }
    let toast = $('submissionNotice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'submissionNotice';
      toast.setAttribute('role','status');
      toast.setAttribute('aria-live','polite');
      document.body.append(toast);
    }
    clearTimeout(toast.dismissTimer);
    toast.className = 'submission-notice';
    toast.textContent = `✓ ${text}`;
    toast.hidden = false;
    toast.dismissTimer = setTimeout(() => { toast.hidden = true; toast.textContent = ''; }, 4500);
  };
  const guard = fn => async (...args) => { try { return await fn(...args); } catch (err) { const target = $('msg') || $('formMessage') || $('loginMessage') || $('message') || $('appMessage'); if (target) { target.textContent = err.name === 'QuotaExceededError' ? 'مساحة التخزين ممتلئة. لم يتم حفظ التغيير.' : err.message; target.className = 'message error'; } else throw err; } };
  const form = (id, fn) => { $(id).addEventListener('submit', guard(async event => { event.preventDefault(); const button = event.submitter; if (button) button.disabled = true; try { await fn(); } finally { if (button) button.disabled = false; } })); };
  const value = id => $(id).value.trim();
  const field = (id, label, type = 'text', initial = '', required = false) => `<div class="form-group"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type}" value="${e(initial)}" ${required ? 'required' : ''}></div>`;
  const area = (id, label, initial = '', required = false) => `<div class="form-group"><label for="${id}">${label}</label><textarea class="textarea" id="${id}" ${required ? 'required' : ''}>${e(initial)}</textarea></div>`;
  const msg = '<div id="msg" class="message" role="status" aria-live="polite"></div>';
  const empty = text => `<div class="empty"><h3>${text}</h3></div>`;
  const labels = {pending:'مسندة',progress:'قيد التنفيذ',completed:'مكتملة'};
  const priorities = {low:'↓ منخفضة',medium:'– متوسطة',high:'↑ عالية'};
  const status = t => labels[t.status] ? t.status : 'pending';
  function passwordToggle(button, input) {
    if (!$(button)) return;
    $(button).onclick = () => { const show = $(input).type === 'password'; $(input).type = show ? 'text' : 'password'; $(button).setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'); $(button).setAttribute('aria-pressed', String(show)); };
    $(button).setAttribute('aria-label', 'إظهار كلمة المرور');
  }
  function setupMobileNavigation() {
    const sidebar = document.querySelector('.sidebar');
    const content = $('content');
    const mobile = matchMedia('(max-width: 768px)');
    sidebar.id = 'mobileSidebar';
    sidebar.setAttribute('aria-label', 'القائمة الرئيسية');
    const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const menuIcon = icon('<path d="M4 6h16M4 12h16M4 18h16"/>');
    const closeIcon = icon('<path d="m6 6 12 12M6 18 18 6"/>');
    const icons = {
      home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
      add: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M19 8v6m-3-3h6"/>',
      tasks: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 9 1 1 2-2m-3 7 1 1 2-2m3-5h3m-3 6h3"/>',
      reports: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8m-8 4h5"/>',
      profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
    };
    sidebar.querySelectorAll('.side-nav a').forEach(link => {
      const href = link.getAttribute('href');
      const key = href.includes('dashboard') ? 'home' : href.includes('add-trainee') ? 'add' : href.includes('tasks') ? 'tasks' : href.includes('profile') ? 'profile' : 'reports';
      link.insertAdjacentHTML('afterbegin', icon(icons[key]));
    });
    const brand = sidebar.querySelector('.brand');
    const header = document.createElement('div');
    header.className = 'sidebar-header';
    brand.before(header);
    header.append(brand);
    header.insertAdjacentHTML('beforeend', `<button type="button" class="sidebar-close icon-button" id="closeMenu" aria-label="إغلاق القائمة">${closeIcon}</button>`);
    sidebar.insertAdjacentHTML('beforebegin', `<header class="mobile-topbar"><button type="button" class="menu-toggle icon-button" id="openMenu" aria-label="فتح القائمة الرئيسية" aria-controls="mobileSidebar" aria-expanded="false">${menuIcon}</button><a class="mobile-brand" href="${brand.getAttribute('href')}"><span class="brand-icon">TF</span><strong>TrainFlow</strong></a></header><div class="sidebar-backdrop" id="menuBackdrop" aria-hidden="true"></div>`);
    const topbar = document.querySelector('.mobile-topbar');
    const skipLink = document.querySelector('.skip-link');
    let open = false;
    function setOpen(next, restoreFocus = true) {
      open = next && mobile.matches;
      document.body.classList.toggle('menu-open',open);
      $('openMenu').setAttribute('aria-expanded',String(open));
      sidebar.inert = mobile.matches && !open;
      if (sidebar.inert) sidebar.setAttribute('aria-hidden','true');
      else sidebar.removeAttribute('aria-hidden');
      if (open) { sidebar.setAttribute('role','dialog'); sidebar.setAttribute('aria-modal','true'); }
      else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); }
      content.inert = open; topbar.inert = open; skipLink.inert = open;
      if (open) $('closeMenu').focus();
      else if (restoreFocus && mobile.matches) $('openMenu').focus();
    }
    $('openMenu').onclick = () => setOpen(true);
    $('closeMenu').onclick = () => setOpen(false);
    $('menuBackdrop').onclick = () => setOpen(false);
    sidebar.addEventListener('click',event => { if (event.target.closest('a')) setOpen(false,false); });
    document.addEventListener('keydown',event => {
      if (!open) return;
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key === 'Tab') {
        const controls = [...sidebar.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])')];
        const first = controls[0], last = controls[controls.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    mobile.addEventListener('change',() => {
      const focusedInside = sidebar.contains(document.activeElement);
      setOpen(false,false);
      if (focusedInside) (mobile.matches ? $('openMenu') : sidebar.querySelector('.side-nav a')).focus();
    });
    setOpen(false,false);
  }
  function auth() {
    passwordToggle('showPassword','password');
    passwordToggle('showConfirmPassword','confirmPassword');
    if (page === 'login.html') {
      let role = 'supervisor';
      function select(next) {
        role = next;
        ['supervisor','trainee'].forEach(r => { $(r+'Type').classList.toggle('active',r === role); $(r+'Type').setAttribute('aria-pressed',String(r === role)); });
        $('registerArea').hidden = role === 'trainee';
        document.querySelector('.forgot-area').hidden = role === 'trainee';
        $('traineeHelp').hidden = role !== 'trainee';
      }
      $('supervisorType').onclick = () => select('supervisor'); $('traineeType').onclick = () => select('trainee'); select(role);
      form('loginForm', async () => {
        const email = value('email').toLowerCase();
        if (TF.cloud) { await TF.signIn(email,$('password').value,role); return; }
        const user = TF.users().find(u => u.role === role && String(u.email).toLowerCase() === email);
        const credential = $('password').value;
        const expected = user && (user.password || (role === 'trainee' && (user.code || user.traineeCode || user.loginCode)));
        if (!expected || !credential || String(expected) !== credential) return message('البريد الإلكتروني أو بيانات الدخول غير صحيحة.',false,'loginMessage');
        TF.login(user);
      });
    } else {
      form('registerForm', async () => {
        const name = value('fullName'), email = value('email').toLowerCase(), role = 'supervisor', password = $('password').value;
        const users = TF.users();
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return message('أدخل الاسم والبريد الإلكتروني بشكل صحيح.',false,'formMessage');
        if (users.some(u => String(u.email).toLowerCase() === email)) return message('هذا البريد مسجّل بالفعل.',false,'formMessage');
        if (password.length < 6 || password !== $('confirmPassword').value) return message('استخدم 6 خانات على الأقل وتأكد من تطابق كلمتي المرور.',false,'formMessage');
        const code = value('organizationCode');
        if (TF.cloud) {
          const result = await TF.registerSupervisor({name,email,password,organizationCode:code});
          const notice = result.welcomeEmailSent === false ? ' تعذّر إرسال رسالة الترحيب.' : '';
          return message('تم إنشاء الحساب. يمكنك تسجيل الدخول الآن.' + notice,true,'formMessage');
        }
        if (code !== '5566') return message('كود اعتماد المشرف غير صحيح.',false,'formMessage');
        const user = {id:TF.id(role),name,email,role,password,createdAt:new Date().toISOString()};
        users.push(user); await TF.write('tf_users',users); TF.login(user);
      });
    }
  }
  async function start() {
    await TF.init?.();
    TF.migrate();
    TF.migrateCredentials();
    if (page === 'forgot-password.html') {
      form('forgotForm', async () => {
        await TF.sendReset(value('email').toLowerCase());
        message('إذا كان البريد مسجّلًا، ستصلك رسالة تحتوي على رابط لتعيين كلمة مرور جديدة.',true,'message');
      });
      return;
    }
    if (page === 'reset-password.html') {
      form('resetForm', async () => {
        const password = $('newPassword').value;
        if (password.length < 6 || password !== $('confirmPassword').value) return message('تأكد من تطابق كلمتي المرور واستخدم 6 خانات على الأقل.',false,'message');
        await TF.finishReset(password);
        $('resetForm').reset();
        message('تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.',true,'message');
      });
      return;
    }
    if (['login.html','register.html'].includes(page)) return auth();
    const u = TF.session();
    if (!u) { location.replace('login.html'); return; }
    const supervisorPages = ['supervisor-dashboard.html','supervisor-tasks.html','trainee-details.html','add-trainee.html'];
    const traineePages = ['trainee-dashboard.html','trainee-tasks.html','daily-report.html'];
    if ((supervisorPages.includes(page) && u.role !== 'supervisor') || (traineePages.includes(page) && u.role !== 'trainee')) { location.replace(TF.home(u)); return; }
    const nav = u.role === 'supervisor' ? [['supervisor-dashboard.html','الرئيسية'],['add-trainee.html','إضافة متدرب'],['supervisor-tasks.html','المهام'],['reports.html','التقارير'],['profile.html','الملف الشخصي']] : [['trainee-dashboard.html','الرئيسية'],['trainee-tasks.html','مهامي'],['daily-report.html','كتابة تقرير'],['reports.html','تقاريري'],['profile.html','الملف الشخصي']];
    $('app').innerHTML = `<a class="skip-link" href="#content">تجاوز إلى المحتوى</a><aside class="sidebar"><a class="brand" href="${TF.home(u)}"><div class="brand-icon">TF</div><div><h1>TrainFlow</h1><small>${u.role === 'supervisor' ? 'لوحة المشرف' : 'لوحة المتدرب'}</small></div></a><nav class="side-nav" aria-label="القائمة الرئيسية">${nav.map(([url,label]) => `<a href="${url}" ${url === page ? 'class="active" aria-current="page"' : ''}><span>${label}</span></a>`).join('')}</nav><div class="side-bottom"><button class="ghost-btn" id="logout">تسجيل الخروج</button></div></aside><main class="dashboard" id="content"><header class="dash-head"><div><h1 id="heading"></h1></div><span class="pill" data-initial="${e(u.name?.trim().charAt(0) || "م")}">${e(u.name)}</span></header><div id="appMessage" class="message" role="status" aria-live="polite"></div><div id="body"></div></main>`;
    $('logout').onclick = guard(() => TF.logout());
    setupMobileNavigation();
    const body = $('body');
    body.dataset.page = page.replace('.html','');
    const descriptions = {
      'supervisor-dashboard.html':'نظرة على سير التدريب والمتدربين التابعين لك.',
      'trainee-dashboard.html':'ملخص تقدمك خلال فترة التدريب.',
      'supervisor-tasks.html':'إسناد المهام ومتابعة تقدم المتدربين.',
      'trainee-tasks.html':'مهامك المسندة وسجل إنجازك في مكان واحد.',
      'reports.html':u.role === 'supervisor' ? 'متابعة التقارير اليومية للمتدربين.' : 'تقاريرك اليومية السابقة ومتابعة ما أنجزته.',
      'daily-report.html':'وثّق إنجازاتك وما تعلمته خلال اليوم.',
      'profile.html':'إدارة بياناتك الشخصية وإعدادات حسابك.',
      'add-trainee.html':'إنشاء حساب متدرب وربطه بإشرافك.',
      'trainee-details.html':'بيانات المتدرب ومتابعة سجله التدريبي.',
      'task-details.html':'تفاصيل التكليف والملاحظات المرتبطة به.'
    };
    const title = text => {
      $('heading').textContent = text; document.title = `TrainFlow | ${text}`;
      const subtitle = document.createElement('p'); subtitle.className = 'page-description';
      subtitle.textContent = descriptions[page] || ''; $('heading').after(subtitle);
    };
    const account = document.querySelector('.dash-head .pill');
    account.className = 'pill account-name';
    if (u.role === 'supervisor') {
      document.querySelector('.side-bottom').insertAdjacentHTML('afterbegin','<div class="office-control"><span class="office-control-title">حالة المكتب</span><label class="office-control-row" for="presence"><span>في المكتب</span><input id="presence" type="checkbox" aria-label="في المكتب"></label></div>');
      const presence = $('presence');
      presence.onchange = async () => {
        if (presence.disabled) return;
        const available = presence.checked;
        presence.disabled = true;
        const feedback = $('appMessage');
        feedback.className = 'message';
        feedback.textContent = 'جارٍ حفظ حالة المكتب…';
        try {
          if (TF.cloud) {
            await TF.setOfficePresence(u.id, available);
          } else {
            const users = TF.users();
            const current = users.find(user => user.id === u.id);
            if (!current) throw new Error();
            current.available = available;
            await TF.write('tf_users', users);
          }
          message('تم حفظ حالة المكتب.', true, 'appMessage');
        } catch {
          message('تعذّر حفظ حالة المكتب. حاولي مرة ثانية.', false, 'appMessage');
        } finally {
          presence.disabled = false;
          renderOffice();
        }
      };
    } else {
      document.querySelector('.dash-head').insertAdjacentHTML('afterend','<div class="supervisor-line" id="supervisorLine"><span class="muted">المشرف</span><strong id="linkedSupervisor"></strong><span class="office-status" id="officeStatus" hidden><span class="office-dot" aria-hidden="true"></span>في المكتب</span></div>');
    }
    function renderOffice() {
      if (u.role === 'supervisor') {
        const current = TF.users().find(x => x.id === u.id);
        if (!$('presence').disabled) $('presence').checked = !!current?.available;
      } else {
        const supervisor = TF.users().find(x => x.id === u.supervisorId);
        $('linkedSupervisor').textContent = supervisor?.name || 'غير محدد';
        $('officeStatus').hidden = !supervisor?.available;
      }
    }
    renderOffice();
    window.addEventListener('storage',event => { if (event.key === 'tf_users' || event.key === null) renderOffice(); });
    window.addEventListener('focus',renderOffice);
    const tasks = () => TF.myTasks(u);
    const reportList = rows => `<div class="report-scroll" tabindex="0" role="region" aria-label="قائمة التقارير">${rows.length ? rows.map(r => {
      const trainee = TF.users().find(x => x.id === r.traineeId);
      return `<button type="button" class="report-item" data-report-id="${e(r.id)}" aria-haspopup="dialog"><span class="report-author"><span class="avatar" aria-hidden="true">${e(trainee?.name?.charAt(0) || 'م')}</span><span><strong>${e(trainee?.name || 'المتدرب')}</strong><span class="report-item-preview">${e(r.work || 'التقرير اليومي')}</span></span></span><time class="report-date" datetime="${e(r.date)}">${TF.date(r.date)}</time><span class="report-open-label">عرض التقرير ←</span></button>`;
    }).join('') : '<div class="reports-empty"><h3>لا توجد تقارير مطابقة</h3><p>ستظهر التقارير هنا عند إرسالها.</p></div>'}</div>`;
    const reportDialog = document.createElement('dialog');
    reportDialog.className = 'report-dialog';
    reportDialog.setAttribute('aria-labelledby','reportDialogTitle');
    document.body.append(reportDialog);
    reportDialog.addEventListener('click',event => { if (event.target === reportDialog) reportDialog.close(); });
    body.addEventListener('click',event => {
      const button = event.target.closest('[data-report-id]');
      if (!button) return;
      const r = TF.reports().find(item => item.id === button.dataset.reportId);
      if (!r || !(u.role === 'trainee' ? r.traineeId === u.id : TF.myTrainees(u).some(t => t.id === r.traineeId))) return;
      const trainee = TF.users().find(x => x.id === r.traineeId);
      const sections = [['work','الأعمال المنجزة'],['learned','ما تعلمته'],['challenges','التحديات'],['plan','خطة اليوم التالي']].filter(([key]) => r[key]);
      reportDialog.innerHTML = `<div class="report-dialog-panel"><header class="report-dialog-heading"><div><h2 id="reportDialogTitle">التقرير اليومي</h2><p>${e(trainee?.name || 'المتدرب')} · ${TF.date(r.date)}</p></div><button class="ghost-btn" type="button" autofocus aria-label="إغلاق التقرير">إغلاق ×</button></header><div class="report-dialog-content">${sections.map(([key,label]) => `<section><h3>${label}</h3><p class="pre">${e(r[key])}</p></section>`).join('')}${u.role === 'trainee' ? `<a class="btn" href="daily-report.html?date=${encodeURIComponent(r.date)}">تعديل التقرير</a><button type="button" class="ghost-btn task-delete-btn" id="deleteReport">حذف التقرير</button>` : ''}</div></div>`;
      reportDialog.querySelector('button').onclick = () => reportDialog.close();
      const deleteReport = reportDialog.querySelector('#deleteReport');
      if (deleteReport) deleteReport.onclick = async () => {
        if (!confirm('هل تريد حذف هذا التقرير نهائيًا؟')) return;
        deleteReport.disabled = true;
        try {
          if (TF.cloud) await TF.deleteReport(r.id);
          else await TF.write('tf_reports',TF.reports().filter(item => item.id !== r.id));
          body.querySelectorAll('[data-report-id]').forEach(item => { if (item.dataset.reportId === r.id) item.remove(); });
          const count = $('reportCount');
          if (count) count.textContent = `عدد التقارير: ${body.querySelectorAll('[data-report-id]').length}`;
          const scroll = body.querySelector('.report-scroll');
          if (scroll && !scroll.querySelector('[data-report-id]')) scroll.innerHTML = '<div class="reports-empty"><h3>لا توجد تقارير مطابقة</h3></div>';
          reportDialog.close();
          message('تم حذف التقرير بنجاح.',true,'appMessage');
        } catch (error) {
          let notice = reportDialog.querySelector('.report-delete-error');
          if (!notice) { notice = document.createElement('p'); notice.className = 'message error report-delete-error'; notice.setAttribute('role','alert'); deleteReport.after(notice); }
          notice.textContent = error.message;
        } finally { deleteReport.disabled = false; }
      };

      reportDialog.showModal();
    });
    const taskList = rows => rows.length ? rows.map(t => `<a class="task-row" href="task-details.html?id=${encodeURIComponent(t.id)}"><div class="list-main"><h3>${e(t.title)}</h3><p>${u.role === 'supervisor' ? `${e(TF.users().find(x => x.id === t.traineeId)?.name || '')} · ` : ''}${t.dueDate ? `التسليم: ${TF.date(t.dueDate)}` : 'دون موعد محدد'}</p></div><span class="badge ${status(t)}">${labels[status(t)]}</span><span class="row-arrow" aria-hidden="true">←</span></a>`).join('') : empty('لا توجد مهام مطابقة');
    function taskForm(trainees, selected = '') {
      return `<section class="card"><h2>إضافة مهمة</h2><form id="taskForm"><div class="form-group"><label for="trainee">المتدرب</label><select class="select" id="trainee" required><option value="">اختر المتدرب</option>${trainees.map(t => `<option value="${e(t.id)}" ${t.id === selected ? 'selected' : ''}>${e(t.name)}</option>`).join('')}</select></div>${field('taskTitle','عنوان المهمة','text','',true)}${area('description','وصف المهمة','',true)}<div class="two-col">${field('dueDate','موعد التسليم','date','',true)}<div class="form-group"><label for="priority">الأولوية</label><select class="select" id="priority"><option value="medium">– متوسطة</option><option value="high">↑ عالية</option><option value="low">↓ منخفضة</option></select></div></div>${area('supervisorNotes','ملاحظات المشرف')}${msg}<button class="btn" type="submit">إضافة المهمة</button></form></section>`;
    }
    function bindTaskForm(after) {
      form('taskForm', async () => {
        const trainee = TF.myTrainees(u).find(t => t.id === value('trainee'));
        if (!trainee || !value('taskTitle') || !value('description') || !value('dueDate')) return message('اختر متدربًا واكتب عنوان المهمة ووصفها وموعد تسليمها.');
        const all = TF.tasks(); all.push({id:TF.id('task'),supervisorId:u.id,traineeId:trainee.id,title:value('taskTitle'),description:value('description'),dueDate:value('dueDate'),priority:value('priority'),supervisorNotes:value('supervisorNotes'),status:'pending',createdAt:new Date().toISOString()});
        await TF.write('tf_tasks',all); submitted('taskForm','تمت إضافة المهمة وإرسالها للمتدرب.'); after();
      });
    }
    if (page.endsWith('-dashboard.html')) {
      title('الرئيسية');
      const mine = tasks(), complete = mine.filter(t => status(t) === 'completed').length;
      const trainees = TF.myTrainees(u), ids = new Set(trainees.map(t => t.id));
      const reports = TF.reports().filter(r => u.role === 'trainee' ? r.traineeId === u.id : ids.has(r.traineeId));
      body.innerHTML = `<div class="stats-grid">${[['إجمالي المهام',mine.length],['المهام المكتملة',complete],['قيد التنفيذ',mine.filter(t => status(t)==='progress').length],['التقارير',reports.length]].map(([label,count]) => `<div class="card stat"><div><span>${label}</span><strong>${count}</strong></div><span class="stat-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/></svg></span></div>`).join('')}</div><section class="progress-summary"><div class="toolbar"><span class="muted">نسبة الإنجاز</span><span>${mine.length ? Math.round(complete/mine.length*100) : 0}%</span></div><progress aria-label="نسبة إنجاز المهام" max="${mine.length || 1}" value="${complete}"></progress></section>`;
      if (u.role === 'supervisor') {
        body.innerHTML += `<section class="card trainees-panel" id="trainees-section"><div class="toolbar section-heading"><h2>المتدربون <span class="count-badge">${trainees.length}</span></h2><a class="btn" href="add-trainee.html"><span aria-hidden="true">＋</span>إضافة متدرب</a></div><div class="table-tools"><label class="sr-only" for="traineeSearch">البحث عن متدرب</label><input class="input" id="traineeSearch" type="search" placeholder="البحث بالاسم أو البريد الإلكتروني"></div><div class="trainee-table-head" aria-hidden="true"><span>المتدرب</span><span>البريد الإلكتروني</span><span>المهام النشطة</span><span></span></div><div id="traineeList"></div></section>`;
        const renderTrainees = () => {
          const query = value('traineeSearch').toLowerCase();
          const filtered = trainees.filter(t => `${t.name} ${t.email}`.toLowerCase().includes(query));
          $('traineeList').innerHTML = filtered.length ? filtered.map(t => `<article class="trainee-row"><div class="trainee-identity"><span class="avatar" aria-hidden="true">${e(t.name?.trim().charAt(0) || 'م')}</span><div><h3>${e(t.name)}</h3><small>${e(t.trainingField || 'متدرب')}</small></div></div><p class="trainee-email">${e(t.email)}</p><span class="trainee-workload">${mine.filter(task => task.traineeId === t.id && status(task) !== 'completed').length}<span class="mobile-caption"> مهام نشطة</span></span><a class="row-link" href="trainee-details.html?id=${encodeURIComponent(t.id)}" aria-label="ملف المتدرب ${e(t.name)}">عرض الملف <span aria-hidden="true">←</span></a></article>`).join('') : empty(query ? 'لا يوجد متدرب مطابق للبحث' : 'لم تتم إضافة متدربين بعد');
        };
        $('traineeSearch').oninput = renderTrainees; renderTrainees();
      }
    } else if (page === 'add-trainee.html') {
      title('إضافة متدرب'); body.innerHTML = `<section class="card"><p class="notice">سيتمكن المتدرب من الدخول بالبريد وكلمة المرور التي تخصصها له هنا.</p><form id="addForm">${field('name','الاسم الكامل','text','',true)}${field('email','البريد الإلكتروني','email','',true)}${field('code','كلمة مرور المتدرب (6 خانات على الأقل)','password','',true)}${field('field','مجال التدريب')}${msg}<button class="btn" type="submit">إضافة المتدرب</button></form></section>`;
      form('addForm', async () => {
        const users = TF.users(), email = value('email').toLowerCase();
        if (!value('name') || $('code').value.length < 6) return message('أدخل الاسم وكلمة مرور من 6 خانات على الأقل.');
        if (users.some(t => String(t.email).toLowerCase() === email)) return message('البريد مسجّل بالفعل.');
        users.push({id:TF.id('trainee'),role:'trainee',supervisorId:u.id,name:value('name'),email,password:$('code').value,trainingField:value('field'),createdAt:new Date().toISOString()});
        await TF.write('tf_users',users); submitted('addForm','تمت إضافة المتدرب وربطه بحسابك.');
      });
    } else if (['supervisor-tasks.html','trainee-tasks.html'].includes(page)) {
      title(u.role === 'supervisor' ? 'إدارة المهام' : 'مهامي');
      body.innerHTML = `<section class="card"><div class="toolbar"><label for="search">بحث<input class="input" id="search" type="search" placeholder="عنوان المهمة أو وصفها"></label><label for="status">الحالة<select class="select" id="status"><option value="all">جميع الحالات</option>${Object.entries(labels).map(([key,label]) => `<option value="${key}">${({pending:"⚑ ",progress:"◷ ",completed:"✓ "})[key] || ""}${label}</option>`).join('')}</select></label></div><div id="list" class="list"></div></section>`;
      const render = () => { const q = value('search').toLowerCase(); $('list').innerHTML = taskList(tasks().filter(t => (value('status') === 'all' || status(t) === value('status')) && `${t.title} ${t.description}`.toLowerCase().includes(q)).reverse()); };
      $('search').oninput = render; $('status').onchange = render; render();
      if (u.role === 'supervisor') {
        body.insertAdjacentHTML('beforeend', `<details class="task-composer" ${params.get('trainee') ? 'open' : ''}><summary>＋ إضافة مهمة</summary>${taskForm(TF.myTrainees(u),params.get('trainee'))}</details>`);
        bindTaskForm(render);
      }
    } else if (page === 'task-details.html') {
      const taskId = params.get('id') || localStorage.getItem('trainflow_selected_task');
      let t = tasks().find(x => x.id === taskId);
      title('تفاصيل المهمة');
      if (!t) { body.innerHTML = empty('المهمة غير موجودة أو غير متاحة لحسابك'); return; }
      body.innerHTML = `<section class="card task-overview"><div class="toolbar"><h2>${e(t.title)}</h2><span class="badge ${status(t)}" id="taskBadge">${labels[status(t)]}</span></div><dl class="task-metadata"><div><dt>المتدرب</dt><dd>${e(TF.users().find(x => x.id === t.traineeId)?.name || 'غير محدد')}</dd></div><div><dt>موعد التسليم</dt><dd>${TF.date(t.dueDate)}</dd></div><div><dt>الأولوية</dt><dd>${priorities[t.priority] || '– متوسطة'}</dd></div></dl><div class="task-description"><h3>وصف المهمة</h3><p class="pre">${e(t.description)}</p></div>${t.supervisorNotes ? `<section class="task-note"><h3>ملاحظات المشرف</h3><p class="pre">${e(t.supervisorNotes)}</p></section>` : ''}</section>`;
      if (u.role === 'trainee') {
        body.innerHTML += `<section class="card task-update"><h2>تحديث المهمة</h2><form id="updateForm"><div class="form-group"><label for="taskStatus">حالة المهمة</label><select class="select" id="taskStatus">${Object.entries(labels).map(([key,label]) => `<option value="${key}" ${key === status(t) ? 'selected' : ''}>${({pending:"⚑ ",progress:"◷ ",completed:"✓ "})[key] || ""}${label}</option>`).join('')}</select></div>${area('traineeNotes','ملاحظاتي',t.traineeNotes)}${msg}<button class="btn" type="submit">حفظ التحديث</button></form></section>`;
        form('updateForm', async () => {
          const all = TF.tasks(), item = all.find(x => x.id === t.id && x.traineeId === u.id);
          if (!item) return message('المهمة لم تعد متاحة.');
          item.status = value('taskStatus'); item.traineeNotes = value('traineeNotes'); item.completedAt = item.status === 'completed' ? (item.completedAt || new Date().toISOString()) : null;
          await TF.write('tf_tasks',all); $('taskBadge').textContent = labels[item.status]; $('taskBadge').className = `badge ${item.status}`; message('تم تحديث المهمة.',true);
        });
      } else {
        body.innerHTML += `<section class="card"><h2>ملاحظات المتدرب</h2><p class="pre">${e(t.traineeNotes || 'لم يضف المتدرب ملاحظات بعد')}</p></section><section class="card"><div class="toolbar"><p class="muted">يمكنك حذف المهمة إذا لم تعد مطلوبة.</p><button class="ghost-btn task-delete-btn" id="deleteTask" type="button">حذف المهمة</button></div></section>`;
        $('deleteTask').onclick = guard(async () => {
          if (!confirm('هل تريد حذف هذه المهمة نهائيًا؟')) return;
          const button = $('deleteTask'); button.disabled = true;
          try {
            if (TF.cloud) await TF.deleteTask(t.id);
            else await TF.write('tf_tasks',TF.tasks().filter(item => item.id !== t.id));
            body.innerHTML = `<section class="card"><h2>✓ تم حذف المهمة</h2><p class="muted">حُذفت المهمة من قائمتك وقائمة المتدرب.</p><a class="btn" href="supervisor-tasks.html">الرجوع للمهام</a></section>`;
          } finally { if (button.isConnected) button.disabled = false; }
        });
      }
    } else if (page === 'daily-report.html') {
      title('التقرير اليومي'); body.innerHTML = `<section class="card report-editor"><div class="toolbar"><h2>كتابة التقرير</h2><a class="row-link" href="reports.html">سجل التقارير ←</a></div><p class="muted">وثّق أعمالك ثم أرسل التقرير مباشرة للمشرف. يمكنك تعديل تقرير سابق باختيار تاريخه.</p><form id="reportForm">${field('date','تاريخ التقرير','date',TF.today(),true)}${area('work','الأعمال المنجزة','',true)}<div class="report-optional">${area('learned','ما تعلمته (اختياري)')}${area('challenges','التحديات (اختياري)')}${area('plan','خطة اليوم التالي (اختياري)')}</div>${msg}<button class="btn" type="submit">إرسال التقرير</button></form></section>`;
      $('date').value = params.get('date') || TF.today();
      $('date').max = TF.today();
      const load = () => { const r = TF.reports().find(x => x.traineeId === u.id && x.date === value('date')); ['work','learned','challenges','plan'].forEach(k => $(k).value = r?.[k] || ''); $('msg').textContent = ''; }; $('date').onchange = load; load();
      form('reportForm', async () => {
        if (!value('work') || !value('date') || value('date') > TF.today()) return message('أدخل إنجاز اليوم وتاريخًا صحيحًا لا يتجاوز اليوم.');
        const all = TF.reports(), index = all.findIndex(x => x.traineeId === u.id && x.date === value('date'));
        const report = {id:index >= 0 ? all[index].id : TF.id('report'),traineeId:u.id,supervisorId:u.supervisorId,date:value('date'),updatedAt:new Date().toISOString()};
        ['work','learned','challenges','plan'].forEach(k => report[k] = value(k));
        if (index >= 0) all[index] = report; else all.push(report);
        await TF.write('tf_reports',all); submitted('reportForm','تم إرسال التقرير للمشرف بنجاح.');
      });
    } else if (page === 'reports.html') {
      title(u.role === 'supervisor' ? 'تقارير المتدربين' : 'تقاريري'); const trainees = u.role === 'supervisor' ? TF.myTrainees(u) : [u], ids = new Set(trainees.map(t => t.id));
      body.innerHTML = `<section class="card report-filters" aria-label="تصفية التقارير"><div class="toolbar"><label for="trainee">المتدرب<select class="select" id="trainee"><option value="all">جميع المتدربين</option>${trainees.map(t => `<option value="${e(t.id)}">${e(t.name)}</option>`).join('')}</select></label><label for="date">تاريخ التقرير<input class="input" type="date" id="date"></label><button class="ghost-btn" id="clear">مسح الفلاتر</button></div></section><div class="report-results-heading"><h2>سجل التقارير</h2><p id="reportCount" role="status" aria-live="polite"></p></div><div class="reports-feed" id="list"></div>`;
      if (u.role === 'trainee') { $('trainee').closest('label').hidden = true; }
      if (ids.has(params.get('trainee'))) $('trainee').value = params.get('trainee');
      const render = () => {
        const filtered = TF.reports().filter(r => ids.has(r.traineeId) && (value('trainee') === 'all' || r.traineeId === value('trainee')) && (!value('date') || r.date === value('date'))).sort((a,b) => b.date.localeCompare(a.date));
        $('list').innerHTML = reportList(filtered);
        $('reportCount').textContent = `عدد التقارير: ${filtered.length}`;
        $('clear').disabled = value('trainee') === 'all' && !value('date');
      };
      $('trainee').onchange = render; $('date').onchange = render; $('clear').onclick = () => { $('trainee').value = 'all'; $('date').value = ''; render(); }; render();
    } else if (page === 'profile.html') {
      title('الملف الشخصي'); body.innerHTML = `<section class="card"><form id="profileForm">${field('name','الاسم الكامل','text',u.name,true)}${field('email','البريد الإلكتروني','email',u.email)}${u.role === 'trainee' ? field('field','مجال التدريب','text',u.trainingField) : ''}${msg}<button class="btn" type="submit">حفظ التعديلات</button></form></section>`;
      $('email').disabled = true;
      form('profileForm', async () => { if (!value('name')) return message('الاسم لا يمكن أن يكون فارغًا.'); const users = TF.users(), item = users.find(x => x.id === u.id); item.name = value('name'); if (u.role === 'trainee') item.trainingField = value('field'); await TF.write('tf_users',users); document.querySelector('.dash-head .pill').textContent = item.name; document.querySelector('.dash-head .pill').dataset.initial = item.name.charAt(0); message('تم حفظ التعديلات.',true); });
    } else if (page === 'trainee-details.html') {
      const t = TF.myTrainees(u).find(x => x.id === params.get('id'));
      title('ملف المتدرب'); if (!t) { body.innerHTML = empty('المتدرب غير موجود أو غير مرتبط بحسابك'); return; }
      body.innerHTML = `<section class="card"><div class="toolbar"><div><h2>${e(t.name)}</h2><p class="muted">${e(t.email)}</p><p>${e(t.trainingField || '')}</p></div><a class="btn" href="supervisor-tasks.html?trainee=${encodeURIComponent(t.id)}">إضافة مهمة</a></div><form id="codeForm">${field('code','كلمة المرور الجديدة','password','',true)}${msg}<button class="ghost-btn" type="submit">تغيير كلمة المرور</button></form></section><section class="card"><h2>المهام</h2><div class="list">${taskList(tasks().filter(x => x.traineeId === t.id))}</div></section><section class="card"><h2>التقارير اليومية</h2><div class="list">${reportList(TF.reports().filter(r => r.traineeId === t.id).sort((a,b) => b.date.localeCompare(a.date)))}</div></section>`;
      form('codeForm', async () => { if ($('code').value.length < 6) return message('كلمة المرور يجب أن تكون 6 خانات على الأقل.'); const users = TF.users(), item = users.find(x => x.id === t.id && x.supervisorId === u.id); if (!item) return message('المتدرب لم يعد مرتبطًا بحسابك.'); item.password = $('code').value; delete item.code; delete item.traineeCode; delete item.loginCode; await TF.write('tf_users',users); $('code').value = ''; message('تم تحديث كلمة المرور.',true); });
      body.insertAdjacentHTML('beforeend','<section class="card"><h2>إدارة حساب المتدرب</h2><p class="muted">حذف الحساب يمنع المتدرب من تسجيل الدخول ويزيل حسابه وسجلاته المرتبطة.</p><button class="btn danger" id="deleteTrainee">حذف حساب المتدرب</button></section>');
      $('deleteTrainee').onclick = guard(async () => {
        if (!confirm(`هل تريد حذف حساب ${t.name}؟ لن يتمكن من تسجيل الدخول بعد الحذف.`)) return;
        await TF.write('tf_users',TF.users().filter(x => !(x.id === t.id && x.supervisorId === u.id)));
        if (!TF.cloud) {
          await TF.write('tf_tasks',TF.tasks().filter(x => x.traineeId !== t.id));
          await TF.write('tf_reports',TF.reports().filter(x => x.traineeId !== t.id));
        }
        location.href = TF.home(u);
      });
    }

  }
  start().then(() => { window.trainflowReady = true; document.dispatchEvent(new Event('trainflow:ready')); }).catch(err => { document.body.innerHTML = '<main class="fatal"><h1>تعذّر تحميل الصفحة</h1><p></p><a href="index.html">العودة للرئيسية</a></main>'; document.querySelector('.fatal p').textContent = err.message; });
})();
