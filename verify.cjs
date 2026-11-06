// End-to-end regression checks in an isolated browser context.
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const visit = file => page.goto(`http://127.0.0.1:4173/${file}`);
  const fill = async values => { for(const [id,text] of Object.entries(values)) await page.locator('#'+id).fill(text); };
  const submit = async id => page.locator(`#${id} button[type=submit]`).click();
  const register = async (email,name) => {
    await visit('register.html');
    await fill({fullName:name,email,organizationCode:'5566',password:'secret123',confirmPassword:'secret123'});
    await submit('registerForm'); await page.waitForURL('**/supervisor-dashboard.html');
  };
  const login = async (email,role='supervisor',credential='secret123') => {
    await visit('login.html'); await page.locator('#'+role+'Type').click();
    await fill({email,password:credential});
    await submit('loginForm'); await page.waitForURL(`**/${role}-dashboard.html`);
  };
  await register('supervisor@example.com','المشرف الأول');
  const supervisor = await page.evaluate(() => TF.session());
  await visit('add-trainee.html');
  await fill({name:'متدرب <img src=x onerror=alert(1)>',email:'trainee@example.com',code:'123456',field:'تطوير الويب'});
  await submit('addForm'); await page.getByText('تمت إضافة المتدرب وربطه بحسابك.').waitFor();
  const trainee = await page.evaluate(() => TF.users().find(u => u.role === 'trainee'));
  await visit(`supervisor-tasks.html?trainee=${trainee.id}`);
  await fill({taskTitle:'مهمة اختبار',description:'تنفيذ واجهة عربية',dueDate:'2026-10-15',supervisorNotes:'مراجعة العرض على الجوال'});
  await submit('taskForm'); await page.getByText('تمت إضافة المهمة بنجاح.').waitFor();
  const task = await page.evaluate(() => TF.tasks()[0]);
  await page.locator('#logout').click();
  await login('trainee@example.com','trainee','123456');
  assert.equal(await page.locator('#tasks-section').count(),0);
  await visit('trainee-tasks.html');
  await page.getByText('مهمة اختبار',{exact:true}).waitFor();
  await visit(`task-details.html?id=${task.id}`);
  await page.locator('#taskStatus').selectOption('completed'); await fill({traineeNotes:'تمت المهمة بنجاح'}); await submit('updateForm');
  await page.reload(); assert.equal(await page.locator('#taskStatus').inputValue(),'completed');
  await visit('daily-report.html'); await fill({work:'إنجاز الواجهة',learned:'التعامل مع RTL'}); await submit('reportForm');
  await fill({work:'إنجاز الواجهة واختبارها'}); await submit('reportForm');
  assert.equal(await page.evaluate(() => TF.reports().length),1);
  await visit('profile.html'); await fill({name:'المتدرب المعدّل'}); await submit('profileForm');
  await login('supervisor@example.com');
  await visit('reports.html'); await page.getByText('إنجاز الواجهة واختبارها',{exact:false}).waitFor();
  await visit(`trainee-details.html?id=${trainee.id}`); await fill({code:'654321'}); await submit('codeForm');
  await login('trainee@example.com','trainee','654321');
  await visit('supervisor-tasks.html'); await page.waitForURL('**/trainee-dashboard.html');
  await register('other@example.com','مشرف آخر');
  assert.equal(await page.evaluate(() => TF.users().filter(x=>x.role==='supervisor').length),2);
  await visit(`task-details.html?id=${task.id}`); await page.getByText('المهمة غير موجودة أو غير متاحة لحسابك').waitFor();
  await visit('reports.html'); await page.getByText('لا توجد تقارير مطابقة').waitFor();
  await visit('register.html'); assert.equal(await page.locator('#accountRole').count(),0);
  await login('supervisor@example.com');
  await visit('add-trainee.html');
  await fill({name:'متدرب ثان',email:'self@example.com',code:'secret456'});
  await submit('addForm');
  await login('self@example.com','trainee','secret456');
  assert.equal(await page.evaluate(() => TF.session().supervisorId),supervisor.id);
  await page.locator('#logout').click(); await visit('profile.html'); await page.waitForURL('**/login.html');
  await login('supervisor@example.com');
  await page.locator('#presence').click();
  assert.equal(await page.evaluate(() => TF.session().available),true);
  const selfId = await page.evaluate(() => TF.users().find(u => u.email === 'self@example.com').id);
  await visit(`trainee-details.html?id=${selfId}`);
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#deleteTrainee').click();
  assert(await page.evaluate(id => TF.users().some(u => u.id === id),selfId));
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#deleteTrainee').click();
  await page.waitForURL('**/supervisor-dashboard.html');
  assert.equal(await page.evaluate(id => TF.users().some(u => u.id === id),selfId),false);
  fs.mkdirSync(path.join(__dirname,'verification'),{recursive:true});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    for(const file of ['index.html','login.html','register.html','supervisor-dashboard.html','supervisor-tasks.html','reports.html',`trainee-details.html?id=${trainee.id}`]) {
      await visit(file);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),`Overflow: ${file} ${viewport.width}`);
    }
    await visit('supervisor-dashboard.html');
    await page.screenshot({path:path.join(__dirname,'verification',`dashboard-${viewport.width}.png`),fullPage:true});
  }
  // Mobile drawer is shared by both roles and every authenticated page.
  for (const [user, files] of [
    [supervisor,['supervisor-dashboard.html','supervisor-tasks.html','reports.html','add-trainee.html','profile.html',`trainee-details.html?id=${trainee.id}`,`task-details.html?id=${task.id}`]],
    [trainee,['trainee-dashboard.html','trainee-tasks.html','daily-report.html','profile.html',`task-details.html?id=${task.id}`]]
  ]) {
    await page.evaluate(id => localStorage.setItem('tf_session',id),user.id);
    for (const width of [320,375,430,768,820,1440]) {
      await page.setViewportSize({width,height:844});
      for (const file of files) {
        await visit(file);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),`Overflow: ${file} ${width}`);
        if (width > 768) {
          assert.equal(await page.locator('#openMenu').isVisible(),false);
          assert.equal(await page.locator('#mobileSidebar').isVisible(),true);
          assert.equal(await page.locator('#mobileSidebar').evaluate(el => el.inert),false);
          continue;
        }
        assert.equal(await page.locator('#openMenu').getAttribute('aria-expanded'),'false');
        assert.equal(await page.locator('#mobileSidebar').evaluate(el => el.inert),true);
        await page.locator('#openMenu').click();
        assert.equal(await page.locator('#openMenu').getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator('#mobileSidebar').getAttribute('aria-modal'),'true');
        assert.equal(await page.locator('#content').evaluate(el => el.inert),true);
        assert.equal(await page.evaluate(() => document.activeElement.id),'closeMenu');
        await page.locator('#logout').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.className),'brand');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id),'logout');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#openMenu').getAttribute('aria-expanded'),'false');
        assert.equal(await page.evaluate(() => document.activeElement.id),'openMenu');
        assert.equal(await page.locator('#content').evaluate(el => el.inert),false);
      }
    }
    await page.setViewportSize({width:375,height:844});
    await visit(user.role === 'supervisor' ? 'supervisor-dashboard.html' : 'trainee-dashboard.html');
    await page.locator('#openMenu').click();
    await page.screenshot({path:path.join(__dirname,'verification',`mobile-menu-${user.role}.png`),animations:'disabled'});
    await page.mouse.click(10,400);
    assert.equal(await page.locator('#openMenu').getAttribute('aria-expanded'),'false');
    await page.locator('#openMenu').click();
    await page.locator('#closeMenu').click();
    assert.equal(await page.locator('#openMenu').getAttribute('aria-expanded'),'false');
    await page.locator('#openMenu').click();
    await page.locator('.side-nav a[href="profile.html"]').click();
    await page.waitForURL('**/profile.html');
    assert.equal(await page.locator('#openMenu').getAttribute('aria-expanded'),'false');
    await page.locator('#openMenu').click();
    await page.setViewportSize({width:1440,height:1000});
    await page.waitForFunction(() => !document.getElementById('content').inert);
    assert.equal(await page.locator('#content').evaluate(el => el.inert),false);
    assert.equal(await page.locator('#mobileSidebar').getAttribute('aria-modal'),null);
    await page.setViewportSize({width:375,height:844});
    await page.waitForFunction(() => document.getElementById('mobileSidebar').inert);
    assert.equal(await page.locator('#mobileSidebar').evaluate(el => el.inert),true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await visit('login.html'); await page.locator('#traineeType').click();
  assert.equal(await page.locator('#registerArea').isVisible(),false);
  assert.equal(await page.locator('#password').getAttribute('type'),'password');
  await page.locator('#supervisorType').click();
  assert.equal(await page.locator('#registerArea').isVisible(),true);
  await visit('forgot-password.html');
  assert.equal(await page.locator('#recoveryCode').count(),0);
  await fill({email:'supervisor@example.com'}); await submit('forgotForm');
  await page.getByText('خدمة استعادة كلمة المرور غير مفعّلة حاليًا. يرجى التواصل مع مسؤول النظام.').waitFor();
  assert.equal(await page.evaluate(() => TF.users().find(u=>u.email==='supervisor@example.com').password),'secret123');
  for (const width of [320,375,430,1440]) {
    await page.setViewportSize({width,height:900}); await visit('forgot-password.html');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
  }
  await page.screenshot({path:path.join(__dirname,'verification','password-reset.png'),fullPage:true});
  // Import legacy records, preserving both source data and associations.
  const legacy = await context.newPage(); await legacy.goto('http://127.0.0.1:4173/index.html');
  await legacy.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('trainflowSupervisor',JSON.stringify({id:'old-s',name:'قديم',email:'old@example.com',password:'oldpass'}));
    localStorage.setItem('trainflowTrainees',JSON.stringify([{id:'old-t',name:'متدرب قديم',email:'old-t@example.com',code:'1234',supervisorId:'old-s'}]));
    localStorage.setItem('trainflow_tasks',JSON.stringify([{id:'old-task',traineeId:'old-t',supervisorId:'old-s',status:'in_progress',title:'مهمة قديمة'}]));
  });
  await legacy.goto('http://127.0.0.1:4173/login.html');
  assert.equal(await legacy.evaluate(() => TF.users().length),2);
  assert.equal(await legacy.evaluate(() => TF.tasks()[0].status),'progress');
  assert(await legacy.evaluate(() => !!localStorage.getItem('trainflowSupervisor')));
  assert.deepEqual(errors,[]);
  await browser.close();
  console.log('PASS: registration, account isolation, task lifecycle, reports, profile, code changes, migration and desktop/mobile overflow.');
})().catch(error => {console.error(error);process.exit(1);});
