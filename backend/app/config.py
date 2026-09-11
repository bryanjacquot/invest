import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Investment Tracker API"
    APP_ENV: str = os.getenv("APP_ENV", "production")
    PORT: int = int(os.getenv("PORT", "3011"))
    
    # SQLite / Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/invest.db")
    
    # JWT Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-default-investment-tracker-key-change-in-prod-2026")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 30  # 30 days
    
    # Encryption key for sensitive tokens (Fernet/AES-256)
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "bGFyZ2Utc2VjdXJlLWtleS0zMi1ieXRlcy1mb3ItZmVybmV0ISE=")
    
    # Plaid credentials (read from environment variables)
    PLAID_CLIENT_ID: str = ""
    PLAID_SECRET: str = ""
    PLAID_ENV: str = "sandbox"
    
    # Backup directory
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "./data/backups")

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
