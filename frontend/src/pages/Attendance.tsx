import {useEffect,useState} from 'react';
import {api} from '../services/api';

export default function Attendance(){
  const [s,setS]=useState<any>();
  const [offices,setOffices]=useState<any[]>([]);
  const [office,setOffice]=useState('');
  const [showPunchOutConfirm,setShowPunchOutConfirm]=useState(false);
  const [busy,setBusy]=useState(false);

  async function loadAttendance(){
    try{
      const data=await api('/attendance/today');
     setS(data || null);
    }catch{}
  }

  useEffect(()=>{
    loadAttendance();
    api('/offices/my-offices').then(setOffices).catch(()=>{});
  },[]);

 async function action(path:string){
  if(busy) return;

  setBusy(true);

  try{
    if(path==='punch-in'){
      const gps=await new Promise<any>((res,rej)=>
        navigator.geolocation.getCurrentPosition(
          p=>res({
            latitude:p.coords.latitude,
            longitude:p.coords.longitude,
            accuracy_meters:p.coords.accuracy
          }),
          rej
        )
      );

      const data=await api('/attendance/punch-in',{
        method:'POST',
        body:JSON.stringify({
          mode:'OFFICE',
          office_id:office,
          gps
        })
      });

      setS(data);
    }else{
      await api('/attendance/'+path,{method:'POST'});
      await loadAttendance();
    }
  }catch(e){
    alert('Action rejected by server.');
  }finally{
    setBusy(false);
  }
}

  return <>
    <h2>Attendance</h2>

    <section className="card">
      <p>
        State: <b>{s?.state||'NOT_STARTED'}</b>
      </p>

      {(!s||s.state==='NOT_STARTED')&&
        <>
          <label>
            Office
            <select
              value={office}
              onChange={e=>setOffice(e.target.value)}
            >
              <option value="">Select</option>

              {offices.map(o=>
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              )}
            </select>
          </label>

          <button
            onClick={()=>action('punch-in')}
            disabled={!office || busy}
          >
            {busy ? 'Punching in…' : 'Punch in'}
          </button>
        </>
      }

      {s?.state==='WORKING'&&
        <>
          <button onClick={()=>action('break/start')}>
            Start break
          </button>

         <button onClick={()=>setShowPunchOutConfirm(true)}>
           Punch out
         </button>
        </>
      }

      {s?.state==='ON_BREAK'&&
        <button onClick={()=>action('break/end')}>
          End break
        </button>
      }
    </section>

    {showPunchOutConfirm&&
      <div
        style={{
          position:'fixed',
          inset:0,
          background:'rgba(0,0,0,0.35)',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          zIndex:1000
        }}
      >
        <div
          className="card"
          style={{
            width:360,
            textAlign:'center',
            background:'#fff'
          }}
        >
          <h3>Confirm Punch Out</h3>

          <p>Are you sure you want to punch out?</p>

          <div
            style={{
              display:'flex',
              justifyContent:'center',
              gap:12,
              marginTop:20
            }}
          >
            <button
              onClick={()=>{
                setShowPunchOutConfirm(false);
              }}
              style={{
                background:'#dc2626',
                color:'#fff'
              }}
            >
              No
            </button>

            <button
              onClick={async()=>{
                setShowPunchOutConfirm(false);
                await action('punch-out');
              }}
              style={{
                background:'#2563eb',
                color:'#fff'
              }}
            >
              Yes
            </button>
          </div>
        </div>
      </div>
    }
  </>;
}