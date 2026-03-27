import pytest


@pytest.mark.asyncio
async def test_manual_receipt_create_list_and_get(client):
    # Register a new user and log in (auth endpoints are tested elsewhere too,
    # but this keeps this test self-contained).
    register_payload = {
        "email": "receipts@example.com",
        "password": "password123",
        "full_name": "Receipts User",
    }
    register_res = await client.post("/api/auth/register", json=register_payload)
    assert register_res.status_code == 201
    token = register_res.json()["access_token"]

    categories_res = await client.get(
        "/api/receipts/categories/list",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert categories_res.status_code == 200
    categories = categories_res.json()
    assert len(categories) > 0

    category_id = categories[0]["id"]

    create_payload = {
        "merchant": "Test Merchant",
        "receipt_date": None,
        "items": [
            {
                "name": "Milk",
                "quantity": 2,
                "unit_price": 3.5,
                "category_id": category_id,
            },
            {
                "name": "Bread",
                "quantity": 1,
                "unit_price": 4.0,
                "category_id": None,
            },
        ],
    }

    create_res = await client.post(
        "/api/receipts/manual",
        json=create_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    receipt = create_res.json()

    assert receipt["merchant"] == "Test Merchant"
    assert receipt["currency"] == "AUD"
    assert receipt["status"] == "completed"
    assert len(receipt["items"]) == 2
    assert float(receipt["total"]) == pytest.approx(2 * 3.5 + 1 * 4.0)

    list_res = await client.get(
        "/api/receipts",
        headers={"Authorization": f"Bearer {token}"},
        params={"page": 1, "page_size": 20},
    )
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["total"] >= 1
    assert any(r["id"] == receipt["id"] for r in body["receipts"])

    get_res = await client.get(
        f"/api/receipts/{receipt['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    got = get_res.json()
    assert got["id"] == receipt["id"]
    assert got["merchant"] == "Test Merchant"
