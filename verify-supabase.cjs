const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');

async function adapterChecks() {
  const database = {profiles:[{id:'s',role:'supervisor',name:'Supervisor'},{id:'t',role:'trainee',supervisorId:'s',name:'Trainee'}],tasks:[],reports:[]};
  const calls = [];
  let listener, fail = false;
  const result = data => ({data,error:fail ? {message:'Network failure'} : null});
  const client = {
    auth:{
      onAuthStateChange(fn) { listener = fn; },
      async getSession() { return result({session:{user:{id:'s'}}}); },
      async signInWithPassword(details) { calls.push(['login',details]); return result({user:{id:'s'}}); },
      async signOut() { calls.push(['logout']); return result(null); },
      async resetPasswordForEmail(email,options) { calls.push(['reset',email,options]); return result(null); },
      async updateUser(details) { calls.push(['password',details]); return result(null); }
    },
    functions:{async invoke(name,options) { calls.push(['function',name,options.body]); return result({ok:true}); }},
    from(table) { return {
      async select() { return result(structuredClone(database[table])); },
      async insert(row) { calls.push(['insert',table,row]); if (!fail) database[table].push(row); return result(null); },
      update(row) { return {async eq(key,id) {calls.push(['update',table,row]); if (!fail) Object.assign(database[table].find(item=>item[key]===id),row); return result(null); }}; }
    }; }
  };
  const context = vm.createContext({window:{},crypto:globalThis.crypto,structuredClone,URL,location:{href:'https://trainflow.test/forgot-password.html'}});
  vm.runInContext(fs.readFileSync('supabase/browser-core.js','utf8'),context);
  context.TF = context.window.TF;
  context.window.TRAINFLOW_CONFIG = {url:'https://project.supabase.co',publishableKey:'public'};
  context.window.supabase = {createClient:()=>client};
  vm.runInContext(fs.readFileSync('supabase-data.js','utf8'),context);
  const TF = context.TF;
  await TF.init();
  assert.equal(TF.session().id,'s');
  const users = TF.users(); users[1].password='newpassword';
  await TF.write('tf_users',users);
  assert.equal(calls.at(-1)[2].action,'change-password');
  assert.equal(calls.at(-1)[2].traineeId,'t');
  assert.equal(TF.users()[1].password,undefined);
  await TF.write('tf_reports',[{id:'r',traineeId:'t',supervisorId:'s',date:'2026-10-01',work:'Report',password:'must-not-be-written'}]);
  assert.equal(database.reports[0].password,undefined);
  const reports = TF.reports(); reports[0].work='Updated';
  await TF.write('tf_reports',reports);
  assert.equal(database.reports[0].work,'Updated');
  assert.equal(Object.keys(calls.at(-1)[2]).join(','),'work');
  await TF.sendReset('test@example.com');
  assert.equal(calls.at(-1)[2].redirectTo,'https://trainflow.test/reset-password.html');
  await assert.rejects(TF.finishReset('newpassword'));
  listener('PASSWORD_RECOVERY',{user:{id:'s'}});
  fail = true;
  await assert.rejects(TF.sendReset('test@example.com'));
  await assert.rejects(TF.finishReset('newpassword'));
  fail = false;
  await TF.finishReset('newpassword');
  assert.equal(calls.at(-1)[0],'logout');
  await assert.rejects(TF.finishReset('anotherpassword'));
  await assert.rejects(TF.signIn('test@example.com','password','trainee'));
  assert.equal(TF.session(),null);
  const empty = vm.createContext({window:{TRAINFLOW_CONFIG:{requireCloud:true}},TF:{}});
  vm.runInContext(fs.readFileSync('supabase-data.js','utf8'),empty);
  await assert.rejects(empty.TF.init());
}

async function edgeChecks() {
  const profiles = [{id:'s',role:'supervisor'},{id:'other',role:'supervisor'},{id:'t',role:'trainee',supervisorId:'s'}];
  const mutations = [];
  const admin = {
    auth:{
      async getUser(token) { return {data:{user:profiles.find(row=>row.id===token)},error:null}; },
      admin:{
        async updateUserById(id,details) { mutations.push(['password',id,details]); return {error:null}; },
        async deleteUser(id) { mutations.push(['delete',id]); return {error:null}; },
        async createUser(details) { mutations.push(['create',details]); return {data:{user:{id:'new'}},error:null}; }
      }
    },
    from() {
      const filters = [];
      return {
        select() { return this; },
        eq(key,value) { filters.push(row=>row[key]===value); return this; },
        async single() { return {data:profiles.find(row=>filters.every(fn=>fn(row))),error:null}; },
        async maybeSingle() { return this.single(); },
        async insert(row) { profiles.push(row); return {error:null}; }
      };
    }
  };
  let handle;
  const environment = {SITE_ORIGIN:'https://trainflow.test',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret',SUPERVISOR_REGISTRATION_CODE:'private-code'};
  const context = vm.createContext({Request,Response,createClient:()=>admin,Deno:{env:{get:name=>environment[name]},serve:fn=>{handle=fn;}}});
  const source = fs.readFileSync('supabase/functions/manage-accounts/index.ts','utf8').replace(/^import .*;\r?\n/,'');
  vm.runInContext(stripTypeScriptTypes(source),context);
  const request = (token,body,origin='https://trainflow.test') => handle(new Request('https://project.supabase.co/functions/v1/manage-accounts',{method:'POST',headers:{origin,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}));
  const change = {action:'change-password',traineeId:'t',password:'newpassword'};
  assert.equal((await request('bad',change)).status,401);
  assert.equal((await request('t',change)).status,403);
  assert.equal((await request('other',change)).status,403);
  assert.equal((await request('s',change,'https://other.test')).status,403);
  assert.equal(mutations.length,0);
  assert.equal((await request('s',{...change,password:'123'})).status,400);
  assert.equal((await request('s',change)).status,200);
  assert.equal(mutations[0][1],'t');
  assert.equal((await request('s',{action:'delete-trainee',traineeId:'other'})).status,403);
  assert.equal((await request('s',{action:'create-trainee',name:'New',email:'new@example.com',password:'newpassword'})).status,200);
  assert.equal(profiles.at(-1).supervisorId,'s');
  assert.equal((await request('s',{action:'register-supervisor',organizationCode:'wrong',name:'New',email:'new@example.com',password:'newpassword'})).status,400);
}

(async () => {
  await adapterChecks();
  await edgeChecks();
  console.log('PASS: cloud adapter, recovery success/failure, password isolation, fail-closed config, and server-side role/ownership authorization (mocked service).');
})().catch(error=>{console.error(error);process.exitCode=1;});
