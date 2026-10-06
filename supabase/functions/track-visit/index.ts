
const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
const origins=new Set(['https://helplinefunding.com','https://www.helplinefunding.com','https://hlbfunding.com','https://www.hlbfunding.com','https://helpline-funding-staging.reign-ai-sys-8696.chatgpt.site','https://helplinebusinessfunding.onrender.com']);
const adminHeaders={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'';
 const allowed=origins.has(origin),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!allowed)return reply({error:'Origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Use POST.'},405);
 try{
  const raw=await req.text();if(raw.length>1500)return reply({error:'Request too large.'},413);
  const b=JSON.parse(raw);
  if(!b||!['visit','heartbeat','leave'].includes(b.action)||typeof b.id!=='string'||!uuid.test(b.id)||typeof b.visitor_id!=='string'||!uuid.test(b.visitor_id))return reply({error:'Invalid visit.'},400);
  let r:Response;
  if(b.action==='visit'){
   if(typeof b.path!=='string'||b.path.length>300||!/^\/[a-z0-9/_-]*$/i.test(b.path)||/^\/(network-manager|partners)(\/|$)/i.test(b.path))return reply({error:'Invalid public page.'},400);
   r=await fetch(`${url}/rest/v1/funding_page_visits?on_conflict=id`,{method:'POST',headers:{...adminHeaders,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({id:b.id,visitor_id:b.visitor_id,path:b.path,is_staging:b.path.startsWith('/staging')||origin.includes('chatgpt.site')})});
  }else{
   r=await fetch(`${url}/rest/v1/funding_page_visits?id=eq.${b.id}&visitor_id=eq.${b.visitor_id}`,{method:'PATCH',headers:adminHeaders,body:JSON.stringify({last_seen_at:new Date().toISOString(),active:b.action!=='leave'})});
  }
  return r.ok?reply({tracked:true}):reply({error:'Tracking unavailable.'},503);
 }catch{return reply({error:'Invalid visit.'},400);}
});
