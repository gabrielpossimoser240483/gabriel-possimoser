const crypto=require('crypto'),{execFileSync}=require('child_process');
const ID=process.env.TUYA_ACCESS_ID, SEC=process.env.TUYA_ACCESS_SECRET, HOST='https://openapi.tuyaus.com';
function call(method,path,body,token=''){
  if(path.includes('?')){const [b0,q]=path.split('?');path=b0+'?'+q.split('&').sort().join('&');}
  const t=Date.now().toString(), b=body?JSON.stringify(body):'';
  const sts=[method,crypto.createHash('sha256').update(b).digest('hex'),'',path].join('\n');
  const sign=crypto.createHmac('sha256',SEC).update(ID+token+t+sts).digest('hex').toUpperCase();
  const args=['-sS','-m','30','-X',method,HOST+path,'-H','client_id: '+ID,'-H','sign: '+sign,'-H','t: '+t,'-H','sign_method: HMAC-SHA256','-H','Content-Type: application/json'];
  if(token) args.push('-H','access_token: '+token);
  if(b) args.push('--data',b);
  return JSON.parse(execFileSync('curl',args).toString());
}
const tk=call('GET','/v1.0/token?grant_type=1');
if(!tk.success){console.log(JSON.stringify(tk));process.exit(1);}
const [method,path,body]=process.argv.slice(2);
console.log(JSON.stringify(call(method,path,body?JSON.parse(body):null,tk.result.access_token),null,1));
