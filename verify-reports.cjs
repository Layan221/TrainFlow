const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/index.html');
  await page.evaluate(()=>{
   localStorage.setItem('tf_users',JSON.stringify([{id:'s',role:'supervisor',name:'نورة أحمد'},{id:'a',role:'trainee',name:'سارة محمد',supervisorId:'s'},{id:'b',role:'trainee',name:'أحمد خالد',supervisorId:'s'}]));
   localStorage.setItem('tf_session','s');
   localStorage.setItem('tf_reports',JSON.stringify([
    {id:'r1',traineeId:'a',supervisorId:'s',date:'2026-10-01',work:'راجعت الإجراءات اليومية ووثّقت نتائج الاجتماع.\nأعددت ملخصًا بالأعمال المنجزة للمراجعة.',learned:'تنظيم الأولويات وتوزيع الوقت بين المهام.',challenges:'تأخر وصول بعض المعلومات اللازمة لإكمال التقرير.',plan:'استكمال البيانات ومراجعة النسخة النهائية مع المشرف.'},
    {id:'r2',traineeId:'b',supervisorId:'s',date:'2026-09-30',work:'استكملت الأعمال المطلوبة.'},
    {id:'r3',traineeId:'outside',supervisorId:'other',date:'2026-10-01',work:'تقرير غير مرتبط'}
   ]));
  });
  fs.mkdirSync('verification',{recursive:true});
  for(const mode of ['light','dark']) for(const width of [1440,375]) {
   await page.evaluate(mode=>{localStorage.setItem('trainflow_theme',mode);localStorage.setItem('trainflow_accessibility',JSON.stringify({distinguishColors:true,textSize:'large'}))},mode);
   await page.setViewportSize({width,height:1000});
   await page.goto('http://127.0.0.1:4173/reports.html');
   assert.equal(await page.locator('.report-entry').count(),2);
   assert.equal(await page.getByText('تقرير غير مرتبط').count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`verification/reports-${mode}-${width}.png`,fullPage:true,animations:'disabled'});
   await page.locator('#trainee').selectOption('a');
   assert.equal(await page.locator('.report-entry').count(),1);
   await page.locator('#date').fill('2026-09-30');
   assert.equal(await page.locator('.report-entry').count(),0);
   assert.equal(await page.locator('#reportCount').textContent(),'عدد التقارير: 0');
   await page.locator('#clear').click();
   assert.equal(await page.locator('.report-entry').count(),2);
  }
  await page.evaluate(() => localStorage.setItem('tf_session','a'));
  await page.goto('http://127.0.0.1:4173/reports.html');
  assert.equal(await page.locator('.report-entry').count(),1);
  assert.equal(await page.locator('#trainee').isVisible(),false);
  await page.getByRole('link',{name:'تعديل التقرير'}).click();
  assert.equal(await page.locator('#date').inputValue(),'2026-10-01');
  assert((await page.locator('#work').inputValue()).includes('راجعت'));
  await page.locator('#work').fill('تم تحديث التقرير السابق من سجلي');
  await page.locator('#reportForm button[type=submit]').click();
  await page.getByText('تم إرسال التقرير للمشرف.').waitFor();
  assert.equal(await page.evaluate(() => TF.reports().length),3);
  for (const mode of ['light','dark']) for (const width of [320,375,1440]) {
   await page.evaluate(mode => localStorage.setItem('trainflow_theme',mode),mode);
   await page.setViewportSize({width,height:1000});
   await page.reload();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const fields = await page.locator('#reportForm .form-group').evaluateAll(nodes => nodes.map(n => {const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}));
   fields.slice(1).forEach((field,index) => assert(field.top >= fields[index].bottom,'Report fields must not overlap'));
   await page.evaluate(() => { document.activeElement.blur(); window.scrollTo({top:0,behavior:'instant'}); });
   await page.screenshot({path:`verification/report-editor-${mode}-${width}.png`,fullPage:true});
  }
  await page.evaluate(() => localStorage.setItem('tf_session','s'));
  await page.goto('http://127.0.0.1:4173/reports.html');
  await page.getByText('تم تحديث التقرير السابق من سجلي').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: report layout, trainee/date filters, clearing, result count, account isolation and light/dark large-text mobile.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
