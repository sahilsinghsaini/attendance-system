from app.models.audit import AuditLog
def audit(db,actor,action,entity_type,entity_id,old=None,new=None,request=None):
    log=AuditLog(actor_user_id=actor.id if actor else None,action=action,entity_type=entity_type,entity_id=str(entity_id),old_value=old,new_value=new,
                 ip_address=request.client.host if request else None,user_agent=request.headers.get("user-agent") if request else None)
    db.add(log)
