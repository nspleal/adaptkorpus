'use client';
// Adapter exclusivo da cópia de QA. Não é importado pelo aplicativo/candidato publicável.
const A='11111111-1111-4111-8111-111111111111';
const subject=()=>typeof document==='undefined'?A:/(?:^|;\s*)evk_fixture_subject=([a-f0-9-]+)/.exec(document.cookie)?.[1] ?? A;
const session=()=>({user:{id:subject(),email:'conta-sintetica@example.invalid'},access_token:'fixture-placeholder'});
const cliente={
  auth:{
    getSession:async()=>({data:{session:session()},error:null}),
    getUser:async()=>({data:{user:session().user},error:null}),
    onAuthStateChange:(callback:(evento:string,sessao:ReturnType<typeof session>|null)=>void)=>{
      let anterior=subject();const timer=setInterval(()=>{const atual=subject();if(atual!==anterior){anterior=atual;callback('SIGNED_IN',session());}},250);
      return{data:{subscription:{unsubscribe:()=>clearInterval(timer)}}};
    },
    signOut:async()=>({error:null}),
  },
  realtime:{setAuth:async()=>undefined},
  channel:(_topic:string,_options:unknown)=>{
    let callback:(v:{payload:unknown})=>void=()=>undefined,timer:ReturnType<typeof setInterval>|undefined,since=0;
    const canal={on:(_tipo:string,_filtro:unknown,fn:typeof callback)=>{callback=fn;return canal;},subscribe:()=>{
      timer=setInterval(()=>{void fetch(`/__qa/realtime?since=${since}`).then(r=>r.json()).then((rows:{seq:number;payload:unknown}[])=>{for(const row of rows){since=row.seq;callback({payload:row.payload});}}).catch(()=>undefined);},500);
      return canal;
    },stop:()=>{if(timer)clearInterval(timer);}};return canal;
  },
  removeChannel:async(c:{stop:()=>void})=>c.stop(),
};
export function createClient(){return cliente;}
