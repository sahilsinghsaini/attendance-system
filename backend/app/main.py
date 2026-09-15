from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from app.api import auth,attendance,wfh,manager,admin,offices,schedule
limiter=Limiter(key_func=get_remote_address)
app=FastAPI(title=settings.app_name,version="1.0.0")
class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self,request,call_next):
        response=await call_next(request)
        response.headers['X-Content-Type-Options']='nosniff'; response.headers['X-Frame-Options']='DENY'; response.headers['Referrer-Policy']='no-referrer'; response.headers['Permissions-Policy']='geolocation=(self)'
        return response
app.add_middleware(SecurityHeaders)
app.state.limiter=limiter
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CORSMiddleware,allow_origins=[x.strip() for x in settings.cors_origins.split(",") if x.strip()],allow_credentials=True,allow_methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"],allow_headers=["Authorization","Content-Type","Idempotency-Key"])
from fastapi.responses import RedirectResponse, Response

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

@app.get("/health")
def health(): return {"status":"ok"}
app.include_router(auth.router);app.include_router(attendance.router);app.include_router(wfh.router);app.include_router(manager.router);app.include_router(admin.router);app.include_router(offices.router);app.include_router(schedule.router)
