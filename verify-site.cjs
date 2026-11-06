const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.html'));
 for(const file of files){
  const html=fs.readFileSync(path.join(__dirname,file),'utf8');
  for(const [,url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
   if(/^(https?:|mailto:|tel:)/.test(url))continue;
   assert(fs.existsSync(path.join(__dirname,url.split(/[?#]/)[0])),`${file}: missing ${url}`);
  }
 }
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext();const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/index.html');
  await page.evaluate(()=>{
   localStorage.setItem('tf_users',JSON.stringify([{id:'s',name:'المشرف',role:'supervisor',email:'s@example.com'},{id:'t',name:'المتدرب',role:'trainee',email:'t@example.com',supervisorId:'s'}]));
   localStorage.setItem('tf_tasks',JSON.stringify([{id:'task',title:'مهمة المراجعة',description:'تفاصيل المهمة',traineeId:'t',supervisorId:'s',status:'pending'}]));
  });
  let checks=0;
  const groups=[
   [null,['index.html','login.html','register.html','forgot-password.html','reset-password.html']],
   ['s',['supervisor-dashboard.html','supervisor-tasks.html','add-trainee.html','trainee-details.html?id=t','task-details.html?id=task','reports.html','profile.html']],
   ['t',['trainee-dashboard.html','trainee-tasks.html','task-details.html?id=task','daily-report.html','reports.html','profile.html']]
  ];
  fs.mkdirSync('verification/audit',{recursive:true});
  for(const theme of ['light','dark'])for(const width of [320,820,1440])for(const large of [false,true]){
   await page.setViewportSize({width,height:950});
   await page.evaluate(({theme,large})=>{localStorage.setItem('trainflow_theme',theme);localStorage.setItem('trainflow_accessibility',JSON.stringify({textSize:large?'large':'normal',distinguishColors:large}));},{theme,large});
   for(const [user,pages] of groups){
    await page.evaluate(user=>user?localStorage.setItem('tf_session',user):localStorage.removeItem('tf_session'),user);
    for(const file of pages){
     const response=await page.goto('http://127.0.0.1:4173/'+file);
     assert.equal(response.status(),200,file);
     if(file!=='index.html')await page.waitForFunction(()=>window.trainflowReady===true || document.querySelector('.fatal')); 
     assert.equal(await page.locator('.fatal').count(),0,file);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow: ${file} ${theme} ${width} large=${large}`);
     assert.equal(await page.locator('.features,.home-button,.back-link').count(),0,file);
     const details=file.startsWith('task-details');
     assert.equal(await page.locator('.page-back').count(),details?1:0,file);
     if(details)assert.equal(await page.locator('.page-back').getAttribute('href'),user==='s'?'supervisor-tasks.html':'trainee-tasks.html');
     if(file==='profile.html')assert.equal(await page.locator('#bio').count(),0);
     if(file==='forgot-password.html'&&!large&&[320,1440].includes(width))await page.screenshot({path:`verification/audit/recovery-${theme}-${width}.png`,fullPage:true});
     checks++;
    }
   }
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${files.length} HTML files and local references; ${checks} role/page/theme/viewport/text-size combinations; return links and removed fields; no page JavaScript errors.`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
