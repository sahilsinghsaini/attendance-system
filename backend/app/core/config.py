from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Secure Multi-Office Attendance System"
    database_url: str = "postgresql+psycopg://attendance:attendance@db:5432/attendance"
    jwt_secret: str = "CHANGE_ME_IN_PRODUCTION"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:5173"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@example.com"
    break_allowance_minutes: int = 30
    require_full_break: bool = False
    max_gps_accuracy_meters: float = 100.0
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
