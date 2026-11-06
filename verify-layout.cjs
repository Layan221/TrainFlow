const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const context = await browser.newContext();
    const supervisor = await context.newPage();
    await supervisor.goto('http://127.0.0.1:4173/index.html');
    await supervisor.evaluate(() => {
      localStorage.setItem('tf_users',JSON.stringify([
        {id:'s',role:'supervisor',name:'نورة أحمد',email:'s@example.com',available:false},
        {id:'t',role:'trainee',name:'سارة محمد',email:'t@example.com',supervisorId:'s'}
      ]));
      localStorage.setItem('tf_tasks',JSON.stringify([
        {id:'1',title:'إعداد التقرير الأسبوعي',status:'progress'},
        {id:'2',title:'مراجعة الإجراءات وتوثيق الملاحظات',status:'pending'},
        {id:'3',title:'تسليم ملخص الأنشطة',status:'completed'}
      ].map(t=>({...t,traineeId:'t',supervisorId:'s',dueDate:'2026-10-15'}))));
      localStorage.setItem('tf_session','s');
    });
    await supervisor.goto('http://127.0.0.1:4173/supervisor-dashboard.html');
    const trainee = await context.newPage();
    await trainee.goto('http://127.0.0.1:4173/index.html');
    await trainee.evaluate(() => localStorage.setItem('tf_session','t'));
    await trainee.goto('http://127.0.0.1:4173/trainee-tasks.html');
    assert.equal(await trainee.locator('#officeStatus').isVisible(),false);
    await supervisor.locator('#presence').click();
    await trainee.waitForFunction(() => !document.getElementById('officeStatus').hidden);
    assert.equal((await trainee.locator('#officeStatus').textContent()).trim(),'في المكتب');
    assert.equal(await trainee.locator('.office-dot').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(34, 197, 94)');
    await supervisor.locator('#presence').click();
    await trainee.waitForFunction(() => document.getElementById('officeStatus').hidden);
    assert.equal(await trainee.getByText('غير متاح',{exact:true}).count(),0);
    await supervisor.locator('#presence').click();
    await trainee.waitForFunction(() => !document.getElementById('officeStatus').hidden);
    assert.equal(await trainee.locator('.task-row').count(),3);
    assert.equal(await trainee.getByText('التفاصيل',{exact:true}).count(),0);
    fs.mkdirSync('verification',{recursive:true});
    for (const width of [320,375,430,820,1440]) {
      await trainee.setViewportSize({width,height:960});
      assert(await trainee.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
      if ([375,1440].includes(width)) await trainee.screenshot({path:`verification/tasks-clean-${width}.png`,fullPage:true,animations:'disabled'});
    }
    await trainee.goto('http://127.0.0.1:4173/trainee-dashboard.html');
    await trainee.screenshot({path:'verification/trainee-clean.png',fullPage:true,animations:'disabled'});
    await supervisor.screenshot({path:'verification/supervisor-clean.png',fullPage:true,animations:'disabled'});
    console.log('PASS: office indicator toggles live, hides when absent, task links are unique, layout fits 320–1440px.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});

