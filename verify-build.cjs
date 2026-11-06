const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'trainflow-build-'));
for (const name of fs.readdirSync(__dirname).filter(name=>/\.(html|css|js)$/.test(name))) fs.copyFileSync(path.join(__dirname,name),path.join(root,name));
for (const name of ['scripts/build.cjs','supabase/browser-core.js','vendor/supabase.js']) {
  fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});
  fs.copyFileSync(path.join(__dirname,name),path.join(root,name));
}
const run = () => spawnSync(process.execPath,[path.join(root,'scripts/build.cjs')],{encoding:'utf8'});
fs.writeFileSync(path.join(root,'supabase-config.js'),'window.TRAINFLOW_CONFIG={url:"",publishableKey:""}');
assert.notEqual(run().status,0,'Empty config must fail');
fs.writeFileSync(path.join(root,'supabase-config.js'),'window.TRAINFLOW_CONFIG={url:"https://example.supabase.co",publishableKey:"sb_secret_bad"}');
assert.notEqual(run().status,0,'Secret key must fail');
fs.writeFileSync(path.join(root,'supabase-config.js'),'window.TRAINFLOW_CONFIG={url:"https://example.supabase.co",publishableKey:"sb_publishable_test"}');
assert.equal(run().status,0);
const dist = path.join(root,'dist');
assert(!fs.readFileSync(path.join(dist,'app-data.js'),'utf8').includes('localStorage'));
assert(fs.readFileSync(path.join(dist,'supabase-config.js'),'utf8').includes('"requireCloud":true'));
assert(!fs.existsSync(path.join(dist,'original-pages-backup.zip')));
assert(!fs.existsSync(path.join(dist,'supabase')));
for (const name of fs.readdirSync(dist).filter(name=>name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dist,name),'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    if (/^(https?:|mailto:|tel:)/.test(match[1])) continue;
    assert(fs.existsSync(path.join(dist,match[1])),`Missing ${match[1]} referenced by ${name}`);
  }
}
console.log('PASS: production build rejects empty/secret config; includes all linked assets and excludes local credentials, backend sources and backups.');
