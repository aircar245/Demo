
'use client';
import { useEffect,useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { api, isPlaceholderApi, tokenStore, refreshAccessToken } from '@/lib/api/client';
import type { Achievement } from '@/types/user';
export function AchievementNotifications() {
 const userId=useAuthStore(s=>s.user?.userId);
 const path=usePathname();
 const qc=useQueryClient();
 const [notice,setNotice]=useState<(Achievement & {owner:number})|null>(null);
 useEffect(()=>{
  if(userId && !isPlaceholderApi) void api.post('/achievement/event',{type:'client.page.view',payload:{path}}).catch(()=>{});
 },[userId,path]);
 useEffect(()=>{
  if(!userId || isPlaceholderApi)return;
  const controller=new AbortController();
  const seen=new Set<string>();
  let timer:ReturnType<typeof setTimeout>|undefined;
  let retryTimer:ReturnType<typeof setTimeout>|undefined;
  async function connect() {
   let attempt=0;
   while(!controller.signal.aborted) {
    try {
     const open=()=>fetch(api.defaults.baseURL+'/achievement/sse/event',{headers:{Authorization:'Bearer '+tokenStore.getAccess()},signal:controller.signal});
     let response=await open();
     if(response.status===401){await refreshAccessToken();response=await open();}
     if(!response.ok||!response.body)throw Error('Stream unavailable');
     attempt=0;
     void qc.invalidateQueries({queryKey:['achievements']});
     const reader=response.body.getReader(), decoder=new TextDecoder();
     let buffer='';
     for(;;) {
      const {value,done}=await reader.read();if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      buffer=buffer.replace(/\r\n/g,'\n');
      let end:number;
      while((end=buffer.indexOf('\n\n'))>=0) {
       const block=buffer.slice(0,end);buffer=buffer.slice(end+2);
       const lines=block.split('\n');
       const event=lines.find(x=>x.startsWith('event:'))?.slice(6).trim();
       const id=lines.find(x=>x.startsWith('id:'))?.slice(3).trim();
       if(event!=='achievement'||!id||seen.has(id))continue;
       const data=lines.filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
       const achievement=JSON.parse(data) as Achievement;
       if(controller.signal.aborted)break;
       seen.add(id);if(seen.size>500)seen.delete(seen.values().next().value!);
       setNotice({...achievement,owner:userId!});clearTimeout(timer);timer=setTimeout(()=>setNotice(null),7000);
       void qc.invalidateQueries({queryKey:['achievements']});
      }
     }
    } catch { if(controller.signal.aborted||!tokenStore.getAccess())break; }
    await new Promise<void>(resolve=>{retryTimer=setTimeout(resolve,Math.min(30000,1000*2**attempt++));controller.signal.addEventListener('abort',()=>{clearTimeout(retryTimer);resolve();},{once:true});});
   }
  }
  void connect();
  return()=>{controller.abort();clearTimeout(timer);clearTimeout(retryTimer);};
 },[userId,qc]);
 if(!userId||!notice||notice.owner!==userId)return null;
 return <aside role="status" aria-live="polite" className="fixed right-4 bottom-4 z-[100] max-w-sm border p-4 ow-mono shadow-lg" style={{background:'var(--ow-panel-bg-main)',borderColor:notice.color,color:'var(--ow-text)'}}>
 <div className="text-xs mb-2">ACHIEVEMENT UNLOCKED <button aria-label="关闭通知" className="float-right ml-4" onClick={()=>setNotice(null)}>×</button></div>
 <div style={{color:notice.color}}>{notice.icon} {notice.label}</div><p className="text-xs mt-2">{notice.description}</p>
 </aside>;
}
