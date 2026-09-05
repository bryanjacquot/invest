import pytest
from app.auth import verify_password, get_password_hash, create_access_token


def test_password_hashing():
    raw = "MySecretPassword123"
    hashed = get_password_hash(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_register_success(client):
    res = client.post("/api/auth/register", json={
        "username": "newuser",
        "password": "Password123!"
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["username"] == "newuser"
    assert data["token_type"] == "bearer"


def test_register_duplicate_username(client, test_user):
    res = client.post("/api/auth/register", json={
        "username": test_user.username,
        "password": "Password123!"
    })
    assert res.status_code == 400
    assert "already taken" in res.json()["detail"]


def test_login_success(client, test_user):
    res = client.post("/api/auth/login", json={
        "username": "testinvestor",
        "password": "ValidPass123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["username"] == "testinvestor"


def test_login_invalid_password(client, test_user):
    res = client.post("/api/auth/login", json={
        "username": "testinvestor",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401
    assert "Incorrect username or password" in res.json()["detail"]


def test_login_nonexistent_user(client):
    res = client.post("/api/auth/login", json={
        "username": "nobody",
        "password": "Password123!"
    })
    assert res.status_code == 401


def test_get_current_user_profile(client, auth_headers, test_user):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == test_user.username
    assert data["id"] == test_user.id


def test_get_current_user_unauthorized(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401

    res_bad = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert res_bad.status_code == 401
