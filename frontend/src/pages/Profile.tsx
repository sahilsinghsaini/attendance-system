import {useEffect,useState} from 'react';
import {api} from '../services/api';

export default function Profile(){
  const [profile,setProfile]=useState<any>(null);
  const [schedule,setSchedule]=useState<any>(null);
  const [loaded,setLoaded]=useState(false);
  const [scheduleLoaded,setScheduleLoaded]=useState(false);

  useEffect(()=>{
    api('/attendance/profile')
      .then(p=>{
        setProfile(p);
        setLoaded(true);
      })
      .catch(()=>setLoaded(true));

    api('/schedule/mine')
      .then(s=>{
        setSchedule(s);
        setScheduleLoaded(true);
      })
      .catch(()=>setScheduleLoaded(true));
  },[]);

  return <>
    <h2>Profile</h2>

    <section className="card hero">
      <h3>Personal Information</h3>

      {!loaded&&<p>Loading…</p>}

      {loaded&&profile&&
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <tbody>
            <tr>
              <td><b>Legal Name</b></td>
              <td>{profile.legal_name||'—'}</td>
            </tr>

            <tr>
              <td><b>Preferred First Name</b></td>
              <td>{profile.preferred_first_name||'—'}</td>
            </tr>

            <tr>
              <td><b>Phone Number</b></td>
              <td>{profile.phone_number||'—'}</td>
            </tr>

            <tr>
              <td><b>Home Address</b></td>
              <td>{profile.home_address||'—'}</td>
            </tr>

            <tr>
              <td><b>Birth Date</b></td>
              <td>{profile.birth_date||'—'}</td>
            </tr>

            <tr>
              <td><b>Gender</b></td>
              <td>{profile.gender||'—'}</td>
            </tr>
          </tbody>
        </table>
      }

      {loaded&&!profile&&
        <p>Profile information is not available yet.</p>
      }
    </section>

    <section className="card hero" style={{marginTop:20}}>
      <h3>Employment Details</h3>

      {!loaded&&<p>Loading…</p>}

      {loaded&&profile&&
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <tbody>
            <tr>
              <td><b>Status</b></td>
              <td>{profile.status||'—'}</td>
            </tr>

            <tr>
              <td><b>Hire Date</b></td>
              <td>{profile.hire_date||'—'}</td>
            </tr>

            <tr>
              <td><b>Pay Schedule</b></td>
              <td>{profile.pay_schedule||'—'}</td>
            </tr>

            <tr>
              <td><b>Department</b></td>
              <td>{profile.department||'—'}</td>
            </tr>

            <tr>
              <td><b>Job Title</b></td>
              <td>{profile.job_title||'—'}</td>
            </tr>

            <tr>
              <td><b>Employee ID</b></td>
              <td>{profile.employee_code||'—'}</td>
            </tr>
          </tbody>
        </table>
      }
    </section>

    <section className="card hero" style={{marginTop:20}}>
      <h3>My work schedule</h3>

      {!scheduleLoaded&&<p>Loading…</p>}

      {scheduleLoaded&&!schedule&&
        <p>
          No schedule has been assigned to you yet.
          Contact your Super Admin.
        </p>
      }

      {scheduleLoaded&&schedule&&
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <tbody>
            <tr style={{borderTop:'1px solid #e5e8ee'}}>
              <td><b>Name</b></td>
              <td>{schedule.name}</td>
            </tr>

            <tr style={{borderTop:'1px solid #e5e8ee'}}>
              <td><b>Start time</b></td>
              <td>{schedule.start_time}</td>
            </tr>

            <tr style={{borderTop:'1px solid #e5e8ee'}}>
              <td><b>End time</b></td>
              <td>{schedule.end_time}</td>
            </tr>

            <tr style={{borderTop:'1px solid #e5e8ee'}}>
              <td><b>Grace period</b></td>
              <td>{schedule.grace_minutes} minutes</td>
            </tr>

            <tr style={{borderTop:'1px solid #e5e8ee'}}>
              <td><b>Timezone</b></td>
              <td>{schedule.timezone}</td>
            </tr>
          </tbody>
        </table>
      }
    </section>
  </>;
}

