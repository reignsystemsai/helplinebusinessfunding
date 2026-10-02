const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
const origins=new Set(['https://helplinefunding.com','https://www.helplinefunding.com','https://hlbfunding.com','https://www.hlbfunding.com','https://helpline-funding-staging.reign-ai-sys-8696.chatgpt.site']);
const adminHeaders={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
const statuses=['New Lead','Contacted','Reviewing','Offer Received','Funded','Closed'];
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return reply({error:'Origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Use POST.'},405);
 try{
  const raw=await req.text();if(raw.length>18000)return reply({error:'Request too large.'},413);
  const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request.'},400);
  // Resolve only the public slug, never partner contact information.
  if(body.action==='resolve_partner'){
   if(typeof body.slug!=='string'||!/^[-a-z0-9]{1,160}$/.test(body.slug))return reply({error:'Invalid partner link.'},400);
   const r=await fetch(`${url}/rest/v1/funding_partners?select=id,slug&slug=eq.${encodeURIComponent(body.slug)}&active=eq.true&limit=1`,{headers:adminHeaders});
   if(!r.ok)return reply({error:'Partner lookup unavailable.'},503);
   const rows=await r.json();return rows.length?reply({partner:rows[0]}):reply({error:'Partner link is unavailable.'},404);
  }
  const token=req.headers.get('Authorization')||'';
  const auth=await fetch(`${url}/auth/v1/user`,{headers:{apikey:secret,Authorization:token}});
  if(!auth.ok)return reply({error:'Please sign in.'},401);
  const user=await auth.json();if(!user.email||!user.email_confirmed_at)return reply({error:'Verify your email before signing in.'},403);
  const access=await fetch(`${url}/rest/v1/funding_manager_owners?select=email&email=eq.${encodeURIComponent(user.email.toLowerCase())}&limit=1`,{headers:adminHeaders});
  if(!access.ok||!(await access.json()).length)return reply({error:'This account has not been granted Network Manager access.'},403);
  if(body.action==='dashboard'){
   const page=Math.max(0,Math.min(100000,Number.isInteger(body.page)?body.page:0)),tests=body.include_tests===true;
   const filters=new URLSearchParams({select:'id,created_at,updated_at,status,funding_amount,purpose,monthly_revenue,time_in_business,business_bank_account,existing_financing,business_name,first_name,last_name,full_name,email,phone,state,contact_consent,consent_version,campaign,source_path,is_staging,partner_id,notes',order:'created_at.desc',limit:'100',offset:String(page*100)});
   if(!tests)filters.set('is_staging','eq.false');
   if(body.status&&statuses.includes(body.status))filters.set('status','eq.'+body.status);
   if(body.partner_id&&/^\d+$/.test(String(body.partner_id)))filters.set('partner_id','eq.'+body.partner_id);
   if(typeof body.search==='string'&&body.search.trim()){
    const term=body.search.trim().slice(0,80).replace(/[^\p{L}\p{N}@ .+_-]/gu,'');
    if(term)filters.set('or',`(business_name.ilike.*${term}*,full_name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*)`);
   }
   const results=await Promise.all([
    fetch(`${url}/rest/v1/funding_leads?${filters}`,{headers:{...adminHeaders,Prefer:'count=exact'}}),
    fetch(`${url}/rest/v1/funding_partner_summary?select=*&order=id.desc`,{headers:adminHeaders}),
    fetch(`${url}/rest/v1/rpc/funding_manager_summary`,{method:'POST',headers:adminHeaders,body:JSON.stringify({include_tests:tests})})
   ]);
   if(results.some(r=>!r.ok))return reply({error:'Unable to load your network. Please try again.'},503);
   return reply({leads:await results[0].json(),total:Number(results[0].headers.get('content-range')?.split('/')[1]||0),partners:await results[1].json(),summary:await results[2].json(),owner:user.email});
  }
  if(body.action==='save_lead'){
   if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id)||!statuses.includes(body.status)||typeof body.notes!=='string'||body.notes.length>10000)return reply({error:'Check the status and notes.'},400);
   const r=await fetch(`${url}/rest/v1/funding_leads?id=eq.${body.id}`,{method:'PATCH',headers:{...adminHeaders,Prefer:'return=representation'},body:JSON.stringify({status:body.status,notes:body.notes,updated_at:new Date().toISOString()})});
   if(!r.ok)return reply({error:'Could not save this lead.'},503);
   const rows=await r.json();return rows.length?reply({saved:true}):reply({error:'Lead not found.'},404);
  }
  if(body.action==='create_partner'){
   if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>120)return reply({error:'Enter the partner name.'},400);
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   const phone=typeof body.phone==='string'?body.phone.trim():'';
   if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'Enter a valid partner email.'},400);
   if(phone.length>40)return reply({error:'Check the phone number.'},400);
   const r=await fetch(`${url}/rest/v1/funding_partners`,{method:'POST',headers:{...adminHeaders,Prefer:'return=representation'},body:JSON.stringify({name:body.name.trim(),email:email||null,phone:phone||null})});
   if(!r.ok)return reply({error:'Could not create the partner.'},503);
   return reply({partner:(await r.json())[0]});
  }
  if(body.action==='set_partner_active'){
   if(!/^\d+$/.test(String(body.id))||typeof body.active!=='boolean')return reply({error:'Invalid partner.'},400);
   const r=await fetch(`${url}/rest/v1/funding_partners?id=eq.${body.id}`,{method:'PATCH',headers:{...adminHeaders,Prefer:'return=representation'},body:JSON.stringify({active:body.active})});
   if(!r.ok)return reply({error:'Could not update partner.'},503);
   const rows=await r.json();return rows.length?reply({saved:true}):reply({error:'Partner not found.'},404);
  }
  return reply({error:'Unknown action.'},400);
 }catch{return reply({error:'Unable to complete this request.'},500);}
});
