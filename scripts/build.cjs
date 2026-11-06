const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const scope = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'supabase-config.js'),'utf8'),scope);
const config = scope.window.TRAINFLOW_CONFIG;
if (!config?.url?.startsWith('https://') || !config.publishableKey) throw new Error('أضف رابط Supabase والمفتاح العام في supabase-config.js قبل إنشاء نسخة النشر.');
if (config.publishableKey.startsWith('sb_secret_')) throw new Error('يُسمح بالمفتاح العام فقط.');
if (config.publishableKey.split('.').length === 3) {
  const payload = JSON.parse(Buffer.from(config.publishableKey.split('.')[1],'base64url').toString());
  if (payload.role !== 'anon') throw new Error('يُسمح بمفتاح anon العام فقط.');
}
const output = path.join(root,'dist');
fs.mkdirSync(output,{recursive:true});
const files = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const assets = ['app.css','app-data.js','app.js','supabase-data.js','theme.css','theme.js','auth-fixes.css','index.css','login.css','register.css','forgot-password.css','vendor/supabase.js'];
for (const name of [...files,...assets]) {
  const destination = path.join(output,name);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(path.join(root,name),destination);
}
fs.writeFileSync(path.join(output,'supabase-config.js'),'window.TRAINFLOW_CONFIG = Object.freeze('+JSON.stringify({...config,requireCloud:true})+');\n');
fs.copyFileSync(path.join(root,'supabase/browser-core.js'),path.join(output,'app-data.js'));
console.log('نسخة النشر جاهزة في dist.');
