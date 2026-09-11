from app.db.base import Base
from app.db.session import engine
import app.models
Base.metadata.create_all(bind=engine)
print('Tables created.')
