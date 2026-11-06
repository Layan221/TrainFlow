import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

Deno.serve(async (request: Request) => {
  const origin = Deno.env.get('SITE_ORIGIN') || '';
  const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Vary': 'Origin' };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get('origin') !== origin) return reply(403,{error:'Origin not allowed'});
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return reply(405,{error:'Method not allowed'});
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const input = await request.json();
    const validPassword = typeof input.password === 'string' && input.password.length >= 6 && input.password.length <= 128;
    const validIdentity = typeof input.name === 'string' && input.name.trim().length > 0 && input.name.length <= 200 && typeof input.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) && input.email.length <= 254;
    if (input.action === 'register-supervisor') {
      const code = Deno.env.get('SUPERVISOR_REGISTRATION_CODE');
      if (!code || input.organizationCode !== code || !validIdentity || !validPassword) return reply(400,{error:'Invalid registration details'});
      const {data:existing} = await admin.from('profiles').select('id').eq('email',input.email.trim().toLowerCase()).maybeSingle();
      if (existing) return reply(400,{error:'Registration unavailable'});
      const publicClient = createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data,error} = await publicClient.auth.signUp({email:input.email.trim().toLowerCase(),password:input.password,options:{emailRedirectTo:origin+'/login.html'}});
      if (error || !data.user || !data.user.identities?.length) return reply(400,{error:'Registration unavailable'});
      const saved = await admin.from('profiles').insert({id:data.user.id,name:input.name.trim(),email:input.email.trim().toLowerCase(),role:'supervisor'});
      if (saved.error) return reply(400,{error:'Registration unavailable'});
      return reply(200,{ok:true});
    }
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!token) return reply(401,{error:'Unauthorized'});
    const {data:auth,error:authError} = await admin.auth.getUser(token);
    if (authError || !auth.user) return reply(401,{error:'Unauthorized'});
    const {data:supervisor} = await admin.from('profiles').select('id,role').eq('id',auth.user.id).single();
    if (supervisor?.role !== 'supervisor') return reply(403,{error:'Forbidden'});
    if (input.action === 'create-trainee') {
      if (!validIdentity || !validPassword) return reply(400,{error:'Invalid account details'});
      const {data,error} = await admin.auth.admin.createUser({email:input.email.trim().toLowerCase(),password:input.password,email_confirm:true});
      if (error || !data.user) return reply(400,{error:'Account unavailable'});
      const saved = await admin.from('profiles').insert({id:data.user.id,name:input.name.trim(),email:input.email.trim().toLowerCase(),role:'trainee',supervisorId:supervisor.id,trainingField:String(input.trainingField || '').slice(0,500)});
      if (saved.error) { await admin.auth.admin.deleteUser(data.user.id); return reply(400,{error:'Account unavailable'}); }
      return reply(200,{ok:true});
    }
    if (!['change-password','delete-trainee'].includes(input.action) || typeof input.traineeId !== 'string') return reply(400,{error:'Invalid action'});
    const {data:trainee} = await admin.from('profiles').select('id').eq('id',input.traineeId).eq('role','trainee').eq('supervisorId',supervisor.id).single();
    if (!trainee) return reply(403,{error:'Forbidden'});
    if (input.action === 'change-password') {
      if (!validPassword) return reply(400,{error:'Invalid password'});
      const {error} = await admin.auth.admin.updateUserById(trainee.id,{password:input.password});
      if (error) return reply(400,{error:'Update unavailable'});
    } else {
      const {error} = await admin.auth.admin.deleteUser(trainee.id);
      if (error) return reply(400,{error:'Delete unavailable'});
    }
    return reply(200,{ok:true});
  } catch {
    return reply(500,{error:'Request could not be completed'});
  }
});
