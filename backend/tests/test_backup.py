import os
import pytest
from app.backup import backup_service
from app.config import settings


def test_backup_list_and_download(client, auth_headers):
    # Test list backups endpoint
    res_list = client.get("/api/backup/list", headers=auth_headers)
    assert res_list.status_code == 200
    assert isinstance(res_list.json(), list)

    # Test download endpoint
    res_dl = client.get("/api/backup/download", headers=auth_headers)
    assert res_dl.status_code == 200
    assert "application/x-sqlite3" in res_dl.headers.get("content-type", "")

    # Clean up test backups directory
    if os.path.exists(settings.BACKUP_DIR):
        for f in os.listdir(settings.BACKUP_DIR):
            if f.endswith(".sqlite"):
                os.remove(os.path.join(settings.BACKUP_DIR, f))
