from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import date, time
class RegisterIn(BaseModel):
    full_name:str=Field(min_length=2,max_length=200); email:EmailStr; password:str=Field(min_length=12); department:str=Field(min_length=1,max_length=150)
class LoginIn(BaseModel): email:EmailStr; password:str
class TokenOut(BaseModel): access_token:str; refresh_token:str; token_type:str="bearer"
class UserOut(BaseModel):
    id:UUID; email:EmailStr; role:str; status:str; email_verified:bool
    model_config={"from_attributes":True}
class WFHCreate(BaseModel): start_date:date; end_date:date; reason:str=Field(min_length=1,max_length=2000)
class ReviewIn(BaseModel): comment:str|None=None
class ManagerCreate(BaseModel): full_name:str; email:EmailStr; password:str=Field(min_length=12)
class EmployeeCreate(BaseModel): full_name:str; email:EmailStr; password:str=Field(min_length=12); department:str
class EmployeeUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    department: str = Field(min_length=1, max_length=150)
    pan: str | None = Field(default=None, max_length=10)
    sin: str | None = Field(default=None, max_length=9)
class ManagerAssign(BaseModel): manager_id:UUID
class OfficeCreate(BaseModel):
    name:str; address:str; latitude:float; longitude:float; geofence_radius_meters:float=150; maximum_gps_accuracy_meters:float=100; timezone:str="Asia/Kolkata"
class GPSIn(BaseModel): latitude:float; longitude:float; accuracy_meters:float|None=None
class PunchIn(BaseModel): mode:str; office_id:UUID|None=None; gps:GPSIn|None=None
class AdjustmentIn(BaseModel): new_value:dict; reason:str=Field(min_length=3)
class WorkHoursSet(BaseModel):
    employee_id:UUID; year:int=Field(ge=2000,le=2100); month:int=Field(ge=1,le=12); required_hours:float=Field(gt=0,le=744)
class WorkHoursOut(BaseModel):
    id:UUID; employee_id:UUID; year:int; month:int; required_hours:float
    model_config={"from_attributes":True}
class ScheduleCreate(BaseModel):
    name:str=Field(min_length=1,max_length=150)
    start_time:time
    end_time:time
    timezone:str="Asia/Kolkata"
    grace_minutes:int=Field(default=0,ge=0,le=180)
class ScheduleAssign(BaseModel): schedule_id:UUID
class ScheduleOut(BaseModel):
    id:UUID; name:str; start_time:time; end_time:time; timezone:str; grace_minutes:int
    model_config={"from_attributes":True}
