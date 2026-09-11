import {useEffect,useState} from 'react';
import {api} from '../services/api';

const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

// scope='admin' -> super admin sees/sets hours for every employee (/admin/work-hours)
// scope='manager' -> manager sees/sets hours only for their own team (/manager/work-hours)
export default function WorkHours({scope}:{scope:'admin'|'manager'}){
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth()+1);
  const [rows,setRows]=useState<any[]>([]);
  const [hours,setHours]=useState<Record<string,string>>({});
  const [msg,setMsg]=useState('');
  const base=scope==='admin'?'/admin/work-hours':'/manager/work-hours';

  function load(){
    api(`${base}?year=${year}&month=${month}`).then(setRows).catch(()=>setMsg('Failed to load work-hour targets.'));
  }
  useEffect(load,[year,month]);

  async function save(employeeId:string){
    const val=parseFloat(hours[employeeId]);
    if(!val||val<=0){setMsg('Enter a valid number of hours.');return} 
    try{
      await api(base,{method:'POST',body:JSON.stringify({employee_id:employeeId,year,month,required_hours:val})});
      setMsg('Required hours saved.');load();
    }catch{setMsg('Failed to save required hours.')}
  }

  return <section className="card hero">
    <h3>Monthly required office hours</h3>
    <p>Set how many hours each employee must complete during the selected month. Employees can see their progress against this target; it updates live from their punch-in/out records.</p>
    <div className="stack" style={{flexDirection:'row',gap:12,alignItems:'flex-end'}}>
      <label>Year<input type="number" value={year} onChange={e=>setYear(parseInt(e.target.value)||now.getFullYear())} style={{width:100}}/></label>
      <label>Month
        <select value={month} onChange={e=>setMonth(parseInt(e.target.value))}>
          {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
        </select>
      </label>
    </div>
    {msg&&<p>{msg}</p>}
    <table style={{width:'100%',borderCollapse:'collapse',marginTop:12}}>
      <thead><tr style={{textAlign:'left'}}>
        <th>Employee</th><th>Required hrs</th><th>Fulfilled hrs</th><th>Status</th><th>Set hours</th>
      </tr></thead>
      <tbody>{rows.map(r=><tr key={r.employee_id} style={{borderTop:'1px solid #e5e8ee'}}>
        <td>{r.employee_name}</td>
        <td>{r.required_hours??'— not set —'}</td>
        <td>{r.fulfilled_hours}</td>
        <td>{r.required_hours==null?'—':(r.met_target?'On track ✅':`Short by ${r.remaining_hours}h`)}</td>
        <td style={{display:'flex',gap:6}}>
          <input type="number" min={1} max={744} placeholder={r.required_hours??'hours'} style={{width:80}}
            value={hours[r.employee_id]??''} onChange={e=>setHours({...hours,[r.employee_id]:e.target.value})}/>
          <button onClick={()=>save(r.employee_id)}>Save</button>
        </td>
      </tr>)}</tbody>
    </table>
  </section>;
}
