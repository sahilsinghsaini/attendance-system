import {useEffect,useState} from 'react';
import Card from '../components/Card';
import WorkHours from '../components/WorkHours';
import {api} from '../services/api';

const TABS=['Overview','Users','Employees','Managers','Offices','Schedules','Work Hours','Audit Logs'] as const;
type Tab=typeof TABS[number];

export default function Admin(){
  const [tab,setTab]=useState<Tab>('Overview');

  return <>
    <header className="admin-header">
      <div>
        <p className="eyebrow">TOBATAX • SUPER ADMIN</p>
        <h2>Organization control</h2>
        <p className="admin-subtitle">
          Manage users, employees, managers, offices, schedules and organization activity.
        </p>
      </div>
    </header>

    <nav className="admin-tabs">
      {TABS.map(t => (
        <button
          key={t}
          className={tab === t ? 'admin-tab active' : 'admin-tab'}
          onClick={() => setTab(t)}
        >
          {t}
        </button>
      ))}
    </nav>

    {tab==='Overview'&&<Overview/>}
    {tab==='Users'&&<Users/>}
    {tab==='Employees'&&<Employees/>}
    {tab==='Managers'&&<Managers/>}
    {tab==='Offices'&&<Offices/>}
    {tab==='Schedules'&&<Schedules/>}
    {tab==='Work Hours'&&<WorkHours scope="admin"/>}
    {tab==='Audit Logs'&&<AuditLogs/>}
  </>;
}

function Overview(){
  const [s,setS]=useState<any>();

  useEffect(()=>{
    api('/admin/dashboard').then(setS).catch(()=>{})
  },[]);

  return <div className="grid">
    <Card title="Employees" value={s?.employees??'—'}/>
    <Card title="Managers" value={s?.managers??'—'}/>
    <Card title="Active offices" value={s?.offices??'—'}/>
    <Card title="Open exceptions" value={s?.exceptions??'—'}/>
  </div>;
}

function Users(){
  const [users,setUsers]=useState<any[]>([]);
  const [error,setError]=useState('');

  function load(){
    api('/admin/users')
      .then(setUsers)
      .catch(()=>setError('Failed to load users'));
  }

  useEffect(load,[]);

  return <section className="card hero">
    <h3>All users</h3>

    {error&&<p role="alert">{error}</p>}

    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead>
        <tr style={{textAlign:'left'}}>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Verified</th>
        </tr>
      </thead>

      <tbody>
        {users.map(u=>
          <tr
            key={u.id}
            style={{borderTop:'1px solid #e5e8ee'}}
          >
            <td>{u.email}</td>
            <td>{u.role}</td>
            <td>{u.status}</td>
            <td>{u.email_verified?'Yes':'No'}</td>
          </tr>
        )}
      </tbody>
    </table>
  </section>;
}

function Employees(){
  const [employees,setEmployees]=useState<any[]>([]);
  const [managers,setManagers]=useState<any[]>([]);
  const [selected,setSelected]=useState<Record<string,string>>({});
  const [selectedOffice,setSelectedOffice]=useState<Record<string,string>>({});
  const [offices,setOffices]=useState<any[]>([]);
  const [employeeOffices,setEmployeeOffices]=useState<any[]>([]);
  const [schedules,setSchedules]=useState<any[]>([]);
  const [selectedSchedule,setSelectedSchedule]=useState<Record<string,string>>({});
  const [form,setForm]=useState({
  full_name:'',
  email:'',
  password:'',
  department:'',
  office_id:''
});
  const [msg,setMsg]=useState('');
  const [editing,setEditing]=useState<any|null>(null);

  const singleManager=managers.length===1?managers[0]:null;

  function load(){
    api('/admin/employees')
      .then(setEmployees)
      .catch(()=>{});

    api('/admin/users')
      .then(us=>
        setManagers(
          us.filter(
            (u:any)=>u.role==='MANAGER'&&u.status==='ACTIVE'
          )
        )
      )
      .catch(()=>{});

   api('/admin/offices')
  .then(data=>{
    console.log('ADMIN OFFICES:',data);
    setOffices(data);
  })
  .catch(err=>{
    console.error('ADMIN OFFICES ERROR:',err);
    setOffices([]);
  });

    api('/admin/employee-offices')
      .then(setEmployeeOffices)
      .catch(()=>{});

    api('/admin/schedules')
      .then(setSchedules)
      .catch(()=>{});
  }

  useEffect(load,[]);

  // Only one active manager exists:
  // every unassigned employee is auto-assigned to them.
  useEffect(()=>{
    if(!singleManager)return;

    const unassigned=employees.filter(
      e=>!e.primary_manager_id&&e.status!=='INACTIVE'
    );

    if(unassigned.length===0)return;

    Promise.all(
      unassigned.map(e=>
        api(
          `/admin/employees/${e.id}/manager`,
          {
            method:'POST',
            body:JSON.stringify({
              manager_id:singleManager.id
            })
          }
        )
      )
    )
      .then(()=>{
        setMsg(
          `Auto-assigned ${unassigned.length} employee(s) to the only active manager (${singleManager.email}).`
        );
        load();
      })
      .catch(()=>{});
  },[employees.length,managers.length]);

  async function createEmployee(e:React.FormEvent){
    e.preventDefault();
    setMsg('');

    try{
      await api('/admin/employees',{
        method:'POST',
        body:JSON.stringify(form)
      });

     setForm({
  full_name:'',
  email:'',
  password:'',
  department:'',
  office_id:''
});
      setMsg('Employee created and active.');
      load();
    }
    catch{
      setMsg(
        'Failed to create employee (password needs 12+ characters, email must be unique).'
      );
    }
  }

  async function saveEmployee(){
    if(!editing)return;

    try{
      await api(`/admin/employees/${editing.id}`,{
        method:'PUT',
        body:JSON.stringify({
          full_name:editing.full_name,
          email:editing.email,
          department:editing.department
        })
      });

      setMsg('Employee updated.');
      setEditing(null);
      load();
    }
    catch{
      setMsg('Failed to update employee.');
    }
  }

  async function deleteEmployee(employee:any){
    if(!window.confirm(
      `Deactivate ${employee.full_name}? Their attendance history will be preserved, but they will no longer be able to sign in.`
    )) return;

    try{
      await api(`/admin/employees/${employee.id}`,{
        method:'DELETE'
      });

      setMsg('Employee deactivated.');
      load();
    }
    catch{
      setMsg('Failed to deactivate employee.');
    }
  }

  async function assign(employeeId:string){
    const managerId=
      singleManager
        ?singleManager.id
        :selected[employeeId];

    if(!managerId){
      setMsg('Choose a manager before clicking Assign.');
      return;
    }

    try{
      await api(
        `/admin/employees/${employeeId}/manager`,
        {
          method:'POST',
          body:JSON.stringify({
            manager_id:managerId
          })
        }
      );

      setMsg('Manager assigned.');
      load();
    }
    catch{
      setMsg('Failed to assign manager.');
    }
  }

  async function assignOffice(employeeId:string){
    const officeId=selectedOffice[employeeId];

    if(!officeId){
      setMsg('Choose an office before assigning.');
      return;
    }

    try{
      await api(
        `/admin/employees/${employeeId}/offices/${officeId}`,
        {
          method:'POST'
        }
      );

      setMsg('Office assigned.');
      load();
    }
    catch{
      setMsg('Failed to assign office.');
    }
  }

  async function assignSchedule(employeeId:string){
    const scheduleId=selectedSchedule[employeeId];

    if(!scheduleId){
      setMsg('Choose a schedule before assigning.');
      return;
    }

    try{
      await api(
        `/admin/employees/${employeeId}/schedule`,
        {
          method:'POST',
          body:JSON.stringify({
            schedule_id:scheduleId
          })
        }
      );

      setMsg('Schedule assigned.');
      load();
    }
    catch{
      setMsg('Failed to assign schedule.');
    }
  }

  function employeeOfficeName(employeeId:string){
    const links=employeeOffices.filter(
      (x:any)=>
        x.employee_id===employeeId
    );

    if(links.length===0)return 'Not assigned';

    const names=links
      .map((x:any)=>{
        const office=offices.find(
          (o:any)=>o.id===x.office_id
        );
        return office?.name;
      })
      .filter(Boolean);

    return names.length
      ?names.join(', ')
      :'Assigned';
  }

  function scheduleName(scheduleId:string){
    const schedule=schedules.find(
      (s:any)=>s.id===scheduleId
    );

    return schedule?.name||'Not assigned';
  }

  return <>
    {editing && (
      <section className="card hero">
        <h3>Edit Employee</h3>

        <div className="stack">
          <label>
            Full name
            <input
              value={editing.full_name}
              onChange={e=>
                setEditing({
                  ...editing,
                  full_name:e.target.value
                })
              }
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={editing.email||''}
              onChange={e=>
                setEditing({
                  ...editing,
                  email:e.target.value
                })
              }
            />
          </label>

          <label>
            Department
            <input
              value={editing.department}
              onChange={e=>
                setEditing({
                  ...editing,
                  department:e.target.value
                })
              }
            />
          </label>
          <label>
  Office
  <select
    value={form.office_id}
    onChange={e=>
      setForm({
        ...form,
        office_id:e.target.value
      })
    }
    required
  >
    <option value="">
      — select office —
    </option>

    {offices.map(o=>(
      <option key={o.id} value={o.id}>
        {o.name}
      </option>
    ))}
  </select>
</label>
                    <label>
  {editing.government_id_type || 'Government ID'}
  <input
    value={
      editing.government_id_type === 'PAN'
        ? editing.pan || ''
        : editing.government_id_type === 'SIN'
        ? editing.sin || ''
        : ''
    }
    onChange={e =>
      setEditing({
        ...editing,
        ...(editing.government_id_type === 'PAN'
          ? {pan:e.target.value}
          : editing.government_id_type === 'SIN'
          ? {sin:e.target.value}
          : {}
        )
      })
    }
    placeholder={
      editing.government_id_type === 'PAN'
        ? 'ABCDE1234F'
        : editing.government_id_type === 'SIN'
        ? '123456789'
        : 'No office assigned'
    }
  />
</label>

          <div>
            <button onClick={saveEmployee}>
              Save Changes
            </button>

            <button
              type="button"
              onClick={()=>setEditing(null)}
              style={{marginLeft:8}}
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    )}

    <section className="card hero">
      <h3>Create employee directly (auto-active, skips approval)</h3>

      <form onSubmit={createEmployee} className="stack">
        <label>
          Full name
          <input
            value={form.full_name}
            onChange={e=>
              setForm({
                ...form,
                full_name:e.target.value
              })
            }
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={e=>
              setForm({
                ...form,
                email:e.target.value
              })
            }
            required
          />
        </label>

        <label>
          Password (12+ chars)
          <input
            type="password"
            value={form.password}
            onChange={e=>
              setForm({
                ...form,
                password:e.target.value
              })
            }
            required
          />
        </label>

        <label>
          Department
          <input
            value={form.department}
            onChange={e=>
              setForm({
                ...form,
                department:e.target.value
              })
            }
            required
          />
        </label>

        <button type="submit">
          Create employee
        </button>
      </form>

      {msg&&<p>{msg}</p>}
    </section>

    <section className="card hero">
      <h3>Employees &amp; assignments</h3>

      <p>
        Employees who self-registered are <b>PENDING_APPROVAL</b>
        until a manager is assigned here and then approves them
        under the Manager console.
      </p>

      {singleManager&&(
        <p>
          <b>
            Only one active manager exists ({singleManager.email})
          </b>
          {' '}— every active employee is kept assigned to them automatically.
        </p>
      )}

      <div style={{overflowX:'auto'}}>
        <table
          style={{
            width:'100%',
            borderCollapse:'collapse',
            minWidth:900
          }}
        >
          <thead>
            <tr style={{textAlign:'left'}}>
              <th style={{padding:'10px'}}>Employee</th>
              <th style={{padding:'10px'}}>Department</th>
              <th style={{padding:'10px'}}>Status</th>
              <th style={{padding:'10px'}}>Manager</th>
              <th style={{padding:'10px'}}>Office</th>
              <th style={{padding:'10px'}}>Schedule</th>
              <th style={{padding:'10px'}}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {employees.map(e=>{
              const current=
                e.primary_manager_id||
                selected[e.id]||
                (singleManager
                  ?singleManager.id
                  :''
                );

              return (
                <tr
                  key={e.id}
                  style={{
                    borderTop:'1px solid #e5e8ee'
                  }}
                >
                  <td style={{padding:'10px'}}>
                    <div>
                      <b>{e.full_name}</b>
                    </div>

                    <small>
                      {e.email||'No email'}
                    </small>
                  </td>

                  <td style={{padding:'10px'}}>
                    {e.department}
                  </td>

                  <td style={{padding:'10px'}}>
                    <b>{e.status}</b>
                  </td>

                  <td style={{padding:'10px'}}>
                    {singleManager ? (
                      <span>
                        {singleManager.email}
                      </span>
                    ) : (
                      <select
                        value={current}
                        onChange={ev=>
                          setSelected({
                            ...selected,
                            [e.id]:ev.target.value
                          })
                        }
                      >
                        {managers.length===0 ? (
                          <option value="">
                            — no active managers —
                          </option>
                        ) : (
                          <>
                            {!e.primary_manager_id&&(
                              <option value="">
                                — select manager —
                              </option>
                            )}

                            {managers.map(m=>(
                              <option
                                key={m.id}
                                value={m.id}
                              >
                                {m.email}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    )}
                  </td>

                  <td style={{padding:'10px'}}>
                    <div style={{marginBottom:6}}>
                      <b>
                        {employeeOfficeName(e.id)}
                      </b>
                    </div>

                    <select
                      value={selectedOffice[e.id]||''}
                      onChange={ev=>
                        setSelectedOffice({
                          ...selectedOffice,
                          [e.id]:ev.target.value
                        })
                      }
                    >
                      <option value="">
                        — select office —
                      </option>

                      {offices.map(o=>(
                        <option
                          key={o.id}
                          value={o.id}
                        >
                          {o.name}
                        </option>
                      ))}
                    </select>

                    <div style={{marginTop:6}}>
                      <button
                        type="button"
                        onClick={()=>
                          assignOffice(e.id)
                        }
                      >
                        Assign Office
                      </button>
                    </div>
                  </td>

                  <td style={{padding:'10px'}}>
                    <div style={{marginBottom:6}}>
                      <b>
                        {scheduleName(e.schedule_id)}
                      </b>
                    </div>

                    <select
                      value={selectedSchedule[e.id]||''}
                      onChange={ev=>
                        setSelectedSchedule({
                          ...selectedSchedule,
                          [e.id]:ev.target.value
                        })
                      }
                    >
                      <option value="">
                        — select schedule —
                      </option>

                      {schedules.map(s=>(
                        <option
                          key={s.id}
                          value={s.id}
                        >
                          {s.name} ({s.start_time}–{s.end_time})
                        </option>
                      ))}
                    </select>

                    <div style={{marginTop:6}}>
                      <button
                        type="button"
                        onClick={()=>
                          assignSchedule(e.id)
                        }
                      >
                        {e.schedule_id
                          ?'Re-assign'
                          :'Assign Schedule'}
                      </button>
                    </div>
                  </td>

                  <td style={{padding:'10px'}}>
                    <div style={{
                      display:'flex',
                      flexDirection:'column',
                      gap:6
                    }}>
                      {!e.primary_manager_id&&!singleManager&&(
                        <button
                          type="button"
                          onClick={()=>
                            assign(e.id)
                          }
                        >
                          Assign Manager
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={()=>
                          setEditing(e)
                        }
                      >
                        Edit
                      </button>

                      {e.status!=='INACTIVE'&&(
                        <button
                          type="button"
                          onClick={()=>
                            deleteEmployee(e)
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}

function Managers(){
const [form,setForm]=useState({
  full_name:'',
  email:'',
  password:'',
  department:'',
  office_id:''
});

  const [msg,setMsg]=useState('');
  const [managers,setManagers]=useState<any[]>([]);
  const [offices,setOffices]=useState<any[]>([]);
  const [selectedOffice,setSelectedOffice]=useState<Record<string,string>>({});

  function load(){
    api('/admin/users')
      .then(us=>
        setManagers(
          us.filter(
            (u:any)=>
              u.role==='MANAGER'&&
              u.status==='ACTIVE'
          )
        )
      )
      .catch(()=>{});

    api('/admin/offices')
      .then(setOffices)
      .catch(()=>{});
  }

  useEffect(load,[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setMsg('');

    try{
      await api('/admin/managers',{
        method:'POST',
        body:JSON.stringify(form)
      });

    setForm({
  full_name:'',
  email:'',
  password:'',
  department:'',
  office_id:''
});

      setMsg('Manager created and active.');
      load();
    }
    catch{
      setMsg(
        'Failed to create manager (password needs 12+ characters, email must be unique).'
      );
    }
  }

  return <>
    <section className="card hero">
      <h3>Create manager</h3>

      <p>
        Managers cannot self-register — only a Super Admin can create
        manager accounts. They are active immediately.
      </p>

      <form onSubmit={submit} className="stack">
        <label>
          Full name
          <input
            value={form.full_name}
            onChange={e=>
              setForm({
                ...form,
                full_name:e.target.value
              })
            }
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={e=>
              setForm({
                ...form,
                email:e.target.value
              })
            }
            required
          />
        </label>

        <label>
          Password (12+ chars)
          <input
            type="password"
            value={form.password}
            onChange={e=>
              setForm({
                ...form,
                password:e.target.value
              })
            }
            required
          />
        </label>

        <button type="submit">
          Create manager
        </button>
      </form>

      {msg&&<p>{msg}</p>}
    </section>

    <section className="card hero">
      <h3>Managers</h3>

      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr style={{textAlign:'left'}}>
            <th>Name / Email</th>
            <th>Status</th>
            <th>Office</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {managers.length===0 ? (
            <tr>
              <td colSpan={4}>
                No active managers found.
              </td>
            </tr>
          ) : (
            managers.map(m=>(
              <tr
                key={m.id}
                style={{
                  borderTop:'1px solid #e5e8ee'
                }}
              >
                <td>{m.email}</td>

                <td>{m.status}</td>

                <td>
                  <select
                    value={selectedOffice[m.id]||''}
                    onChange={e=>
                      setSelectedOffice({
                        ...selectedOffice,
                        [m.id]:e.target.value
                      })
                    }
                  >
                    <option value="">
                      — select office —
                    </option>

                    {offices.map(o=>(
                      <option
                        key={o.id}
                        value={o.id}
                      >
                        {o.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <button
                    type="button"
                    onClick={async()=>{
                      const officeId=
                        selectedOffice[m.id];

                      if(!officeId){
                        setMsg(
                          'Choose an office before assigning.'
                        );
                        return;
                      }

                      try{
                        await api(
                          `/admin/managers/${m.id}/offices/${officeId}`,
                          {method:'POST'}
                        );

                        setMsg(
                          'Office assigned to manager.'
                        );

                        load();
                      }
                      catch{
                        setMsg(
                          'Failed to assign office to manager.'
                        );
                      }
                    }}
                  >
                    Assign Office
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  </>;
}

function Offices(){
  const [offices,setOffices]=useState<any[]>([]);
  const [editing,setEditing]=useState<any|null>(null);

  const [form,setForm]=useState({
    name:'',
    address:'',
    latitude:'',
    longitude:'',
    geofence_radius_meters:'150',
    maximum_gps_accuracy_meters:'100',
    timezone:'Asia/Kolkata'
  });

  const [msg,setMsg]=useState('');

  function load(){
    api('/admin/offices')
      .then(setOffices)
      .catch(()=>{});
  }

  useEffect(load,[]);

  function startEdit(o:any){
    setEditing(o);
    setForm({
      name:o.name ?? '',
      address:o.address ?? '',
      latitude:String(o.latitude ?? ''),
      longitude:String(o.longitude ?? ''),
      geofence_radius_meters:String(o.geofence_radius_meters ?? '150'),
      maximum_gps_accuracy_meters:String(
        o.maximum_gps_accuracy_meters ?? '100'
      ),
      timezone:o.timezone ?? 'Asia/Kolkata'
    });
    setMsg('');
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setMsg('');

    try{
      const payload={
        ...form,
        latitude:parseFloat(form.latitude),
        longitude:parseFloat(form.longitude),
        geofence_radius_meters:
          parseFloat(form.geofence_radius_meters),
        maximum_gps_accuracy_meters:
          parseFloat(form.maximum_gps_accuracy_meters)
      };

      if(editing){
        await api('/admin/offices/'+editing.id,{
          method:'PUT',
          body:JSON.stringify(payload)
        });

        setMsg('Office updated.');
        setEditing(null);
      }else{
        await api('/admin/offices',{
          method:'POST',
          body:JSON.stringify(payload)
        });

        setMsg('Office created.');
      }

      load();
    }
    catch{
      setMsg(
        editing
          ? 'Failed to update office.'
          : 'Failed to create office.'
      );
    }
  }

  return <>
    <section className="card hero">
      <h3>{editing?'Edit office':'Create office'}</h3>

      <form onSubmit={submit} className="stack">
        <label>
          Name
          <input
            value={form.name}
            onChange={e=>
              setForm({...form,name:e.target.value})
            }
            required
          />
        </label>

        <label>
          Address
          <input
            value={form.address}
            onChange={e=>
              setForm({...form,address:e.target.value})
            }
            required
          />
        </label>

        <label>
          Latitude
          <input
            value={form.latitude}
            onChange={e=>
              setForm({...form,latitude:e.target.value})
            }
            required
          />
        </label>

        <label>
          Longitude
          <input
            value={form.longitude}
            onChange={e=>
              setForm({...form,longitude:e.target.value})
            }
            required
          />
        </label>

        <label>
          Geofence radius (m)
          <input
            value={form.geofence_radius_meters}
            onChange={e=>
              setForm({
                ...form,
                geofence_radius_meters:e.target.value
              })
            }
          />
        </label>

        <label>
          Max GPS accuracy (m)
          <input
            value={form.maximum_gps_accuracy_meters}
            onChange={e=>
              setForm({
                ...form,
                maximum_gps_accuracy_meters:e.target.value
              })
            }
          />
        </label>

        <label>
          Timezone
          <input
            value={form.timezone}
            onChange={e=>
              setForm({...form,timezone:e.target.value})
            }
          />
        </label>

        <div style={{display:'flex',gap:'10px'}}>
          <button type="submit">
            {editing?'Save changes':'Create office'}
          </button>

          {editing&&(
            <button
              type="button"
              onClick={()=>{
                setEditing(null);
                setMsg('');
                setForm({
                  name:'',
                  address:'',
                  latitude:'',
                  longitude:'',
                  geofence_radius_meters:'150',
                  maximum_gps_accuracy_meters:'100',
                  timezone:'Asia/Kolkata'
                });
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {msg&&<p>{msg}</p>}
    </section>

    <section className="card hero">
      <h3>Offices</h3>

      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr style={{textAlign:'left'}}>
            <th>Name</th>
            <th>Address</th>
            <th>Radius (m)</th>
            <th>Active</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {offices.map(o=>
            <tr
              key={o.id}
              style={{
                borderTop:'1px solid #e5e8ee'
              }}
            >
              <td>{o.name}</td>
              <td>{o.address}</td>
              <td>{o.geofence_radius_meters}</td>
              <td>{o.is_active?'Yes':'No'}</td>
              <td>
                <button onClick={()=>startEdit(o)}>
                  Edit
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  </>;
}

function Schedules(){
  const [schedules,setSchedules]=useState<any[]>([]);

  const [form,setForm]=useState({
    name:'',
    start_time:'09:00',
    end_time:'18:00',
    grace_minutes:'0',
    timezone:'Asia/Kolkata'
  });

  const [msg,setMsg]=useState('');

  function load(){
    api('/admin/schedules')
      .then(setSchedules)
      .catch(()=>{});
  }

  useEffect(load,[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setMsg('');

    try{
      await api('/admin/schedules',{
        method:'POST',
        body:JSON.stringify({
          name:form.name,
          start_time:form.start_time+':00',
          end_time:form.end_time+':00',
          timezone:form.timezone,
          grace_minutes:
            parseInt(form.grace_minutes)||0
        })
      });

      setForm({
        name:'',
        start_time:'09:00',
        end_time:'18:00',
        grace_minutes:'0',
        timezone:'Asia/Kolkata'
      });

      setMsg('Schedule created.');
      load();
    }
    catch{
      setMsg(
        'Failed to create schedule (name must be unique).'
      );
    }
  }

  return <>
    <section className="card hero">
      <h3>Create work schedule</h3>

      <form onSubmit={submit} className="stack">
        <label>
          Name
          <input
            value={form.name}
            onChange={e=>
              setForm({
                ...form,
                name:e.target.value
              })
            }
            required
          />
        </label>

        <label>
          Start time
          <input
            type="time"
            value={form.start_time}
            onChange={e=>
              setForm({
                ...form,
                start_time:e.target.value
              })
            }
            required
          />
        </label>

        <label>
          End time
          <input
            type="time"
            value={form.end_time}
            onChange={e=>
              setForm({
                ...form,
                end_time:e.target.value
              })
            }
            required
          />
        </label>

        <label>
          Grace minutes
          <input
            type="number"
            min={0}
            max={180}
            value={form.grace_minutes}
            onChange={e=>
              setForm({
                ...form,
                grace_minutes:e.target.value
              })
            }
          />
        </label>

        <label>
          Timezone
          <input
            value={form.timezone}
            onChange={e=>
              setForm({
                ...form,
                timezone:e.target.value
              })
            }
          />
        </label>

        <button type="submit">
          Create schedule
        </button>
      </form>

      {msg&&<p>{msg}</p>}
    </section>

    <section className="card hero">
      <h3>Schedules</h3>

      <p>
        Assign these to employees from the Employees tab.
      </p>

      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr style={{textAlign:'left'}}>
            <th>Name</th>
            <th>Start</th>
            <th>End</th>
            <th>Grace (min)</th>
            <th>Timezone</th>
          </tr>
        </thead>

        <tbody>
          {schedules.map(s=>
            <tr
              key={s.id}
              style={{
                borderTop:'1px solid #e5e8ee'
              }}
            >
              <td>{s.name}</td>
              <td>{s.start_time}</td>
              <td>{s.end_time}</td>
              <td>{s.grace_minutes}</td>
              <td>{s.timezone}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  </>;
}

function AuditLogs(){
  const [logs,setLogs]=useState<any[]>([]);

  useEffect(()=>{
    api('/admin/audit-logs')
      .then(setLogs)
      .catch(()=>{});
  },[]);

  return <section className="card hero">
    <h3>Audit log (latest 500)</h3>

    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead>
        <tr style={{textAlign:'left'}}>
          <th>Action</th>
          <th>Entity</th>
          <th>When</th>
        </tr>
      </thead>

      <tbody>
        {logs.map(l=>
          <tr
            key={l.id}
            style={{
              borderTop:'1px solid #e5e8ee'
            }}
          >
            <td>{l.action}</td>
            <td>{l.entity_type} {l.entity_id}</td>
            <td>{l.created_at}</td>
          </tr>
        )}
      </tbody>
    </table>
  </section>;
}