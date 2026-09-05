import os
import shutil
import sqlite3
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import UploadFile, HTTPException, status
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine, Base


class BackupService:
    @staticmethod
    def get_db_file_path() -> Optional[str]:
        """Extract the absolute path to the active SQLite database file."""
        if settings.DATABASE_URL.startswith("sqlite"):
            raw_path = settings.DATABASE_URL.replace("sqlite:////", "/").replace("sqlite:///", "")
            return os.path.abspath(raw_path)
        return None

    @classmethod
    def create_local_backup(cls) -> str:
        """Create a consistent SQLite snapshot copy into the backups folder."""
        db_path = cls.get_db_file_path()
        if not db_path or not os.path.exists(db_path):
            raise HTTPException(status_code=400, detail="Active database file not found")

        os.makedirs(settings.BACKUP_DIR, exist_ok=True)
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"invest_backup_{timestamp_str}.sqlite"
        backup_path = os.path.join(settings.BACKUP_DIR, backup_filename)

        # Use SQLite Online Backup API for safe WAL mode backup
        src_conn = sqlite3.connect(db_path)
        dest_conn = sqlite3.connect(backup_path)
        try:
            with dest_conn:
                src_conn.backup(dest_conn)
        finally:
            dest_conn.close()
            src_conn.close()

        return backup_path

    @classmethod
    def list_backups(cls) -> List[Dict[str, Any]]:
        """List all available backup snapshots."""
        os.makedirs(settings.BACKUP_DIR, exist_ok=True)
        backups = []
        for f in sorted(os.listdir(settings.BACKUP_DIR), reverse=True):
            if f.endswith(".sqlite") or f.endswith(".db"):
                full_path = os.path.join(settings.BACKUP_DIR, f)
                stat = os.stat(full_path)
                backups.append({
                    "filename": f,
                    "size_bytes": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        return backups

    @classmethod
    def restore_backup(cls, file: UploadFile) -> Dict[str, Any]:
        """Verify uploaded SQLite file integrity and replace the active database file."""
        if not file.filename.endswith((".sqlite", ".db")):
            raise HTTPException(status_code=400, detail="Uploaded file must be a .sqlite or .db file")

        temp_restore_path = os.path.join(settings.BACKUP_DIR, "temp_restore.sqlite")
        os.makedirs(settings.BACKUP_DIR, exist_ok=True)

        with open(temp_restore_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Verify SQLite integrity
        try:
            conn = sqlite3.connect(temp_restore_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            result = cursor.fetchone()
            conn.close()
            if not result or result[0] != "ok":
                os.remove(temp_restore_path)
                raise HTTPException(status_code=400, detail="Database integrity check failed")
        except Exception as e:
            if os.path.exists(temp_restore_path):
                os.remove(temp_restore_path)
            raise HTTPException(status_code=400, detail=f"Invalid database file: {e}")

        # Hot swap active database
        db_path = cls.get_db_file_path()
        if db_path:
            # Create a safety copy of current db before overwriting
            safety_copy = f"{db_path}.pre_restore_backup"
            if os.path.exists(db_path):
                shutil.copy2(db_path, safety_copy)
            shutil.move(temp_restore_path, db_path)

        return {
            "success": True,
            "message": "Database successfully restored. Please refresh the page.",
            "timestamp": datetime.utcnow().isoformat()
        }


backup_service = BackupService()
