/* Shared preferences; synchronous head loading prevents a light first paint. */
(() => {
  'use strict';
  const root = document.documentElement;
  const device = matchMedia('(prefers-color-scheme: dark)');
  const defaults = {distinguishColors:false,textSize:'normal'};
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key,value) { try { localStorage.setItem(key,value); return true; } catch { return false; } }
  };
  function read() {
    const theme = storage.get('trainflow_theme');
    let accessibility;
    try { accessibility = JSON.parse(storage.get('trainflow_accessibility')); } catch {}
    return {theme:['light','dark','system'].includes(theme) ? theme : 'system', accessibility:{
      distinguishColors:accessibility?.distinguishColors === true,
      textSize:accessibility?.textSize === 'large' ? 'large' : defaults.textSize
    }};
  }
  let preferences = read();
  function apply() {
    root.dataset.theme = preferences.theme === 'system' ? (device.matches ? 'dark' : 'light') : preferences.theme;
    root.dataset.themePreference = preferences.theme;
    root.classList.toggle('distinguish-colors',preferences.accessibility.distinguishColors);
    root.classList.toggle('text-large',preferences.accessibility.textSize === 'large');
    root.style.colorScheme = root.dataset.theme;
    document.querySelectorAll('[data-theme-choice]').forEach(input => input.checked = input.value === preferences.theme);
    document.querySelectorAll('[data-color-distinction]').forEach(input => input.checked = preferences.accessibility.distinguishColors);
    document.querySelectorAll('[data-text-size]').forEach(input => input.value = preferences.accessibility.textSize);
  }
  apply();
  device.addEventListener('change',() => { if(preferences.theme === 'system') apply(); });
  window.addEventListener('storage',event => {
    if (event.key === null || ['trainflow_theme','trainflow_accessibility'].includes(event.key)) { preferences = read(); apply(); }
  });
  function controls(scope) {
    return `<div class="appearance-settings"><h2>المظهر وإمكانية الوصول</h2><fieldset><legend>المظهر</legend><div class="appearance-options">${[['light','☀','فاتح'],['dark','☾','داكن'],['system','◐','حسب إعداد الجهاز']].map(([value,icon,label]) => `<label><input type="radio" name="theme-${scope}" value="${value}" data-theme-choice><span aria-hidden="true">${icon}</span><span>${label}</span></label>`).join('')}</div></fieldset><div class="accessibility-options"><label class="appearance-row"><span>نمط تمييز الألوان</span><input type="checkbox" data-color-distinction></label><label class="appearance-row"><span>حجم النص</span><select data-text-size><option value="normal">عادي</option><option value="large">كبير</option></select></label></div><p class="preference-feedback" role="status" aria-live="polite"></p></div>`;
  }
  function mount() {
    const header = document.querySelector('.dash-head,.top-header,.header-content,.form-container');
    if (!header) return;
    const page = location.pathname.split('/').pop() || 'index.html';
    if (page === 'task-details.html') {
      const user = window.TF?.session?.();
      const back = document.createElement('a');
      back.className = 'page-back';
      back.href = user?.role === 'supervisor' ? 'supervisor-tasks.html' : 'trainee-tasks.html';
      back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg><span>الرجوع للمهام</span>';
      const row = document.createElement('div');
      row.className = 'page-back-row';
      row.append(back);
      header.before(row);
    }
    const host = document.createElement('details');
    host.className = 'appearance-popover';
    host.innerHTML = `<summary aria-label="المظهر وإمكانية الوصول" title="المظهر وإمكانية الوصول"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/></svg></summary><div class="appearance-panel">${controls('header')}</div>`;
    header.append(host);
    const sidebar = document.querySelector('.sidebar .side-bottom');
    if (sidebar) {
      root.classList.add('has-sidebar');
      const section = document.createElement('section'); section.className = 'sidebar-appearance';
      section.innerHTML = controls('sidebar');
      sidebar.insertBefore(section,document.getElementById('logout'));
    } else root.classList.add('public-page');
    document.addEventListener('change',event => {
      const el = event.target;
      if (!el.closest('.appearance-settings')) return;
      let saved = true;
      if(el.matches('[data-theme-choice]')) { preferences.theme = el.value; saved = storage.set('trainflow_theme',el.value); }
      if(el.matches('[data-color-distinction],[data-text-size]')) {
        if(el.matches('[data-color-distinction]')) preferences.accessibility.distinguishColors = el.checked;
        else preferences.accessibility.textSize = el.value;
        saved = storage.set('trainflow_accessibility',JSON.stringify(preferences.accessibility));
      }
      apply();
      el.closest('.appearance-settings').querySelector('.preference-feedback').textContent = saved ? '' : 'تم تطبيق الإعداد مؤقتًا. تعذّر حفظه في المتصفح.';
    });
    document.addEventListener('pointerdown',event => { if(host.open && !host.contains(event.target)) host.open = false; });
    host.addEventListener('keydown',event => {
      if(event.key === 'Escape' && host.open) { event.preventDefault(); event.stopPropagation(); host.open = false; host.querySelector('summary').focus(); }
    });
    host.addEventListener('focusout',() => setTimeout(() => { if(!host.contains(document.activeElement)) host.open = false; },0));
    matchMedia('(max-width:768px)').addEventListener('change',() => host.open = false);
    apply();
    // Decorative icons should not be announced as unlabeled content.
    document.querySelectorAll('i[class*="fa-"]').forEach(icon => icon.setAttribute('aria-hidden','true'));
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('invalid',event => {
        const input = event.target;
        if (!input.id) return;
        let hint = document.getElementById(input.id+'-error');
        if(!hint) { hint = document.createElement('p'); hint.id = input.id+'-error'; hint.className = 'field-error'; hint.setAttribute('role','alert'); (input.closest('.input-box') || input).after(hint); }
        const label = input.labels?.[0]?.textContent.trim() || 'هذا الحقل';
        hint.textContent = input.validity.valueMissing ? `${label} مطلوب.` : 'يرجى التحقق من القيمة المدخلة.';
        input.setAttribute('aria-invalid','true');
        const ids = new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)); ids.add(hint.id);
        input.setAttribute('aria-describedby',[...ids].join(' '));
      },true);
      form.addEventListener('input',event => {
        const input = event.target, hint = document.getElementById(input.id+'-error');
        if(hint && input.validity.valid) { hint.remove(); input.removeAttribute('aria-invalid'); input.setAttribute('aria-describedby',(input.getAttribute('aria-describedby') || '').split(' ').filter(id => id !== input.id+'-error').join(' ')); }
      });
    });
  }
  document.addEventListener('DOMContentLoaded',() => { if (!document.getElementById('app') || window.trainflowReady) mount(); else document.addEventListener('trainflow:ready',mount,{once:true}); },{once:true});
})();
