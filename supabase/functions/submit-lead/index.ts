const allowedOrigins = new Set(['https://helplinefunding.com','https://www.helplinefunding.com','https://hlbfunding.com','https://www.hlbfunding.com']);
const url = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const apiHeaders = {'apikey':secret,'Authorization':`Bearer ${secret}`,'Content-Type':'application/json'};
const lists: Record<string,string[]> = {
 funding_amount:['Under $10,000','$10,000–$25,000','$25,000–$50,000','$50,000–$100,000','$100,000–$250,000','$250,000+'],
 monthly_revenue:['Under $5,000','$5,000–$10,000','$10,000–$25,000','$25,000–$50,000','$50,000–$100,000','$100,000+'],
 time_in_business:['Not operating yet','Under 6 months','6–12 months','1–2 years','2+ years'],
 purpose:['Working capital','Inventory','Equipment','Expansion','Other'],
 business_bank_account:['Yes','No'],existing_financing:['Yes','No']
};
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin') || '';
 const originAllowed=allowedOrigins.has(origin) || /^https:\/\/helplinebusinessfunding(?:-[a-z0-9]+)?\.onrender\.com$/.test(origin);
 const headers={'Content-Type':'application/json','Vary':'Origin',...(originAllowed?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin && !originAllowed)return reply({error:'This website is not allowed to submit here.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Use POST to submit a request.'},405);
 if(Number(req.headers.get('content-length') || 0)>12000)return reply({error:'Request too large.'},413);
 try{
  const raw=await req.text();if(raw.length>12000)return reply({error:'Request too large.'},413);
  const body=JSON.parse(raw);
  if(typeof body!=='object'||!body||Array.isArray(body))return reply({error:'Invalid request.'},400);
  if(body.website)return reply({error:'Unable to submit this request.'},400);
  for(const [key,values] of Object.entries(lists))if(!values.includes(body[key]))return reply({error:'Please complete all business questions.'},400);
  for(const key of ['business_name','full_name','email','phone','state'])if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>200)return reply({error:'Please check your contact details.'},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||body.phone.replace(/\D/g,'').length<10||body.phone.length>30)return reply({error:'Please check your email and phone number.'},400);
  if(body.contact_consent!==true)return reply({error:'Please agree to follow-up about your request.'},400);
  if(typeof body.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id))return reply({error:'Invalid request reference.'},400);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${secret}:${ip}`));
  const ipHash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const rate=await fetch(`${url}/rest/v1/funding_leads?select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(new Date(Date.now()-3600000).toISOString())}&limit=11`,{headers:apiHeaders});
  if(!rate.ok)return reply({error:'We couldn’t save your request. Please try again shortly.'},503);
  if((await rate.json()).length>=10)return reply({error:'Too many requests. Please try again later.'},429);
  const campaign:Record<string,string>={};if(body.campaign&&typeof body.campaign==='object')for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(typeof body.campaign[key]==='string')campaign[key]=body.campaign[key].slice(0,200);
  const record={request_id:body.request_id,status:'New Lead',funding_amount:body.funding_amount,purpose:body.purpose,monthly_revenue:body.monthly_revenue,time_in_business:body.time_in_business,business_bank_account:body.business_bank_account==='Yes',existing_financing:body.existing_financing==='Yes',business_name:body.business_name.trim(),full_name:body.full_name.trim(),email:body.email.trim().toLowerCase(),phone:body.phone.trim(),state:body.state.trim(),contact_consent:true,consent_version:'inquiry-v1',campaign,source_path:typeof body.source_path==='string'?body.source_path.slice(0,300):'/',is_staging:body.is_staging!==false,ip_hash:ipHash};
  const result=await fetch(`${url}/rest/v1/funding_leads?on_conflict=request_id`,{method:'POST',headers:{...apiHeaders,'Prefer':'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(record)});
  if(!result.ok)return reply({error:'We couldn’t save your request. Please try again shortly.'},503);
  return reply({received:true});
 }catch{return reply({error:'Please check your request and try again.'},400);}
});
