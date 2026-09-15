from fastapi import APIRouter,Depends,HTTPException,Request
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.db.session import get_db
from app.models.user import User,UserRole,UserStatus
from app.models.employee import Employee
from app.schemas.common import RegisterIn,LoginIn,TokenOut,UserOut
from app.core.security import hash_password,verify_password,create_access_token,create_refresh_token,decode_token
from app.api.deps import get_current_user
import uuid
router=APIRouter(prefix="/api/v1/auth",tags=["auth"])
limiter=Limiter(key_func=get_remote_address)
@router.get("/me",response_model=UserOut)
def me(u:User=Depends(get_current_user)): return u
@router.post("/register",response_model=UserOut,status_code=201)
def register(data:RegisterIn,db:Session=Depends(get_db)):
    clean_email = data.email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == clean_email)): raise HTTPException(409,"Email already registered")
    u=User(email=clean_email,password_hash=hash_password(data.password),role=UserRole.EMPLOYEE,status=UserStatus.PENDING_APPROVAL,email_verified=False)
    db.add(u); db.flush(); db.add(Employee(user_id=u.id,employee_code="P-"+uuid.uuid4().hex[:8].upper(),full_name=data.full_name,department=data.department,status="PENDING_APPROVAL")); db.commit(); db.refresh(u); return u
@router.post("/login",response_model=TokenOut)
@limiter.limit("10/minute")
def login(request:Request,data:LoginIn,db:Session=Depends(get_db)):
    clean_email = data.email.strip().lower()
    u=db.scalar(select(User).where(func.lower(User.email) == clean_email))
    if not u or not verify_password(data.password,u.password_hash): raise HTTPException(401,"Invalid credentials")
    if u.status!=UserStatus.ACTIVE: raise HTTPException(403,"Account is not active")
    return TokenOut(access_token=create_access_token(str(u.id)),refresh_token=create_refresh_token(str(u.id)))
@router.post("/refresh",response_model=TokenOut)
def refresh(refresh_token:str,db:Session=Depends(get_db)):
    try: uid=uuid.UUID(decode_token(refresh_token,"refresh")["sub"])
    except Exception: raise HTTPException(401,"Invalid refresh token")
    u=db.get(User,uid)
    if not u or u.status!=UserStatus.ACTIVE: raise HTTPException(401,"Inactive account")
    return TokenOut(access_token=create_access_token(str(u.id)),refresh_token=create_refresh_token(str(u.id)))
