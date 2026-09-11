from fastapi import Depends,HTTPException,status
from fastapi.security import HTTPBearer,HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid
from app.db.session import get_db
from app.models.user import User,UserStatus
from app.core.security import decode_token
bearer=HTTPBearer()
def get_current_user(c:HTTPAuthorizationCredentials=Depends(bearer),db:Session=Depends(get_db)):
    try: uid=uuid.UUID(decode_token(c.credentials)["sub"])
    except Exception: raise HTTPException(status_code=401,detail="Invalid authentication")
    u=db.get(User,uid)
    if not u or u.status!=UserStatus.ACTIVE: raise HTTPException(status_code=401,detail="Inactive account")
    return u
