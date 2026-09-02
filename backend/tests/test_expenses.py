import pytest
from datetime import datetime, timedelta


@pytest.mark.asyncio
async def test_expenses_endpoints_with_receipt_date(client):
    # Register and login user
    reg_res = await client.post("/api/auth/register", json={
        "email": "expensestest@example.com",
        "password": "password123",
        "full_name": "Expenses User"
    })
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get categories
    cat_res = await client.get("/api/receipts/categories/list", headers=headers)
    assert cat_res.status_code == 200
    categories = cat_res.json()
    cat_id = categories[0]["id"]

    # Create a manual receipt with date 90 days ago
    date_90_days_ago = (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%d")
    create_payload = {
        "merchant": "Past Merchant",
        "receipt_date": date_90_days_ago,
        "items": [
            {
                "name": "Vintage Item",
                "quantity": 1,
                "unit_price": 150.00,
                "category_id": cat_id,
            }
        ]
    }
    create_res = await client.post("/api/receipts/manual", json=create_payload, headers=headers)
    assert create_res.status_code == 201

    # Query summary with days=0 (All Time)
    sum_res_all = await client.get("/api/expenses/summary?days=0", headers=headers)
    assert sum_res_all.status_code == 200
    data_all = sum_res_all.json()
    assert data_all["total_spent"] == 150.00
    assert data_all["receipt_count"] == 1
    assert data_all["top_merchant"] == "Past Merchant"

    # Query trends with days=0
    trends_res = await client.get("/api/expenses/trends?days=0", headers=headers)
    assert trends_res.status_code == 200
    trends_data = trends_res.json()
    assert len(trends_data) >= 1
    assert trends_data[0]["date"] == date_90_days_ago
    assert trends_data[0]["total"] == 150.00

    # Query summary with days=30 (should exclude item from 90 days ago, but period_start is 30 days ago to today)
    sum_res_30 = await client.get("/api/expenses/summary?days=30", headers=headers)
    assert sum_res_30.status_code == 200
    data_30 = sum_res_30.json()
    assert data_30["total_spent"] == 0.0
    assert data_30["receipt_count"] == 0
    assert "period_start" in data_30 and "period_end" in data_30

