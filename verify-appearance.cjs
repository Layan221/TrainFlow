const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const context = await browser.newContext({colorScheme:'light'});
    const page = await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const visit = file => page.goto(`http://127.0.0.1:4173/${file}`);
    await visit('index.html');
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('.appearance-popover>summary').click();
    await page.locator('[data-theme-choice][value=light]').first().check();
    await page.emulateMedia({colorScheme:'light'}); await page.emulateMedia({colorScheme:'dark'});
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.appearance-popover').getAttribute('open'),null);
    assert(await page.locator('.appearance-popover>summary').evaluate(el=>el===document.activeElement));
    await page.evaluate(() => {
      localStorage.setItem('tf_users',JSON.stringify([
        {id:'s',role:'supervisor',name:'المشرف المسؤول',email:'s@example.com',available:true},
        {id:'t',role:'trainee',name:'المتدرب',email:'t@example.com',supervisorId:'s'}
      ]));
      localStorage.setItem('tf_tasks',JSON.stringify([{id:'task',title:'إعداد التقرير الأسبوعي',description:'مراجعة الأعمال وتوثيق النتائج',status:'progress',priority:'high',traineeId:'t',supervisorId:'s',dueDate:'2026-10-20'}]));
      localStorage.setItem('tf_reports',JSON.stringify([{id:'rep',traineeId:'t',supervisorId:'s',date:'2026-09-28',work:'توثيق الأعمال المنجزة'}]));
    });
    fs.mkdirSync('verification/appearance',{recursive:true});
    const groups = [
      [null,['index.html','login.html','register.html','forgot-password.html']],
      ['s',['supervisor-dashboard.html','add-trainee.html','trainee-details.html?id=t','supervisor-tasks.html','reports.html','profile.html']],
      ['t',['trainee-dashboard.html','trainee-tasks.html','task-details.html?id=task','daily-report.html']]
    ];
    for(const mode of ['light','dark']) {
      for(const large of [false,true]) {
        await page.evaluate(({mode,large})=>{
          localStorage.setItem('trainflow_theme',mode);
          localStorage.setItem('trainflow_accessibility',JSON.stringify({distinguishColors:large,textSize:large?'large':'normal'}));
        },{mode,large});
        for(const width of [1440,375]) {
          await page.setViewportSize({width,height:1000});
          for(const [user,files] of groups) {
            await page.evaluate(id=> id ? localStorage.setItem('tf_session',id) : localStorage.removeItem('tf_session'),user);
            for(const file of files) {
              await visit(file);
              assert.equal(await page.locator('html').getAttribute('data-theme'),mode);
              assert.equal(await page.locator('.fatal').count(),0,`Fatal ${file}`);
              assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow ${file} ${mode} ${large} ${width}`);
              if(mode==='dark') {
                const whites=await page.locator('.card,.login-card,.register-card,.preview,.preview-card,.preview-card .trainee-row,.input,.select,.textarea,.input-box input').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().height && getComputedStyle(el).backgroundColor==='rgb(255, 255, 255)').map(el=>el.className));
                assert.deepEqual(whites,[],`White surfaces ${file}`);
              }
              if(mode==='dark' && large && ['index.html','login.html','supervisor-dashboard.html','task-details.html?id=task'].includes(file)) {
                await page.screenshot({path:`verification/appearance/${file.split('.')[0]}-${width}.png`,fullPage:true,animations:'disabled'});
              }
            }
          }
        }
      }
    }
    // Mobile controls remain inside the drawer; changes preserve focus and drafts.
    await page.setViewportSize({width:375,height:844});
    await visit('daily-report.html'); await page.locator('#work').fill('مسودة لا تفقد عند تغيير المظهر');
    await page.locator('#openMenu').click();
    await page.locator('.sidebar [data-theme-choice][value=light]').check();
    await page.locator('.sidebar [data-text-size]').selectOption('large');
    await page.locator('.sidebar [data-color-distinction]').check();
    await page.screenshot({path:'verification/appearance/mobile-settings.png',animations:'disabled'});
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    assert.equal(await page.locator('#content').evaluate(el=>el.inert),true);
    await page.locator('#logout').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.className),'brand');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'openMenu');
    assert.equal(await page.locator('#work').inputValue(),'مسودة لا تفقد عند تغيير المظهر');
    await page.reload(); assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    assert(await page.locator('html').evaluate(el=>el.classList.contains('text-large')));
    await visit('task-details.html?id=task');
    assert.equal(await page.locator('#taskBadge').evaluate(el=>getComputedStyle(el,'::before').content),'"◷"');
    // Required fields get an associated error and remain keyboard-operable.
    await visit('daily-report.html'); await page.locator('#reportForm button[type=submit]').click();
    assert.equal(await page.locator('#work').getAttribute('aria-invalid'),'true');
    assert(await page.locator('#work-error').isVisible());
    await page.locator('#work').fill('تم الإنجاز');
    assert.equal(await page.locator('#work-error').count(),0);
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('.appearance-popover>summary').click();
    await page.locator('.appearance-popover [data-theme-choice][value=dark]').check();
    await page.screenshot({path:'verification/appearance/desktop-settings.png',animations:'disabled'});
    // Representative body, secondary and settings text must meet AA's 4.5:1 target.
    const contrastFailures = await page.evaluate(() => {
      const rgb = value => value.match(/[\d.]+/g)?.map(Number);
      const luminance = color => color.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
      return [...document.querySelectorAll('.page-description,.muted,.form-group label,.appearance-settings label,.appearance-settings legend')].filter(el=>el.getBoundingClientRect().height).flatMap(el=>{
        let node=el,bg;
        while(node) { const color=rgb(getComputedStyle(node).backgroundColor); if(color && (color.length===3 || color[3]===1)){bg=color;break;} node=node.parentElement; }
        if(!bg)return [];
        const fg=rgb(getComputedStyle(el).color),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        return ratio<4.5 ? [{text:el.textContent.trim().slice(0,45),ratio}] : [];
      });
    });
    assert.deepEqual(contrastFailures,[]);
    assert.deepEqual(errors,[]);
    console.log('PASS: 14 pages × light/dark × normal/large distinction × desktop/mobile; system changes, persistence, keyboard drawer, draft retention and field errors.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
