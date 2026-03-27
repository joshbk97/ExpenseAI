import pytest


@pytest.mark.asyncio
async def test_register_login_and_me_flow(client):
    register_payload = {
        "email": "test@example.com",
        "password": "password123",
        "full_name": "Test User",
    }

    register_res = await client.post("/api/auth/register", json=register_payload)
    assert register_res.status_code == 201
    register_token = register_res.json()["access_token"]
    assert register_token

    login_res = await client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert login_res.status_code == 200
    login_token = login_res.json()["access_token"]
    assert login_token

    me_res = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {login_token}"},
    )
    assert me_res.status_code == 200
    me_body = me_res.json()
    assert me_body["email"] == "test@example.com"
    assert me_body["full_name"] == "Test User"


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email(client):
    payload = {
        "email": "dupe@example.com",
        "password": "password123",
        "full_name": "Original",
    }
    first = await client.post("/api/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/auth/register", json=payload)
    assert second.status_code == 400
    assert second.json()["detail"] == "Email already registered"


@pytest.mark.asyncio
async def test_login_rejects_bad_password(client):
    await client.post(
        "/api/auth/register",
        json={
            "email": "login@example.com",
            "password": "good-password",
            "full_name": "Login User",
        },
    )

    response = await client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "bad-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"
