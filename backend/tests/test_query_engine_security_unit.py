from services.query_engine import validate_sql


def test_validate_sql_allows_scoped_receipts_query():
    sql = "SELECT r.id, r.total FROM receipts r WHERE r.user_id = :user_id LIMIT 10;"
    ok, _ = validate_sql(sql)
    assert ok is True


def test_validate_sql_blocks_users_table_access():
    sql = "SELECT u.id, u.email FROM users u WHERE u.id = :user_id;"
    ok, reason = validate_sql(sql)
    assert ok is False
    assert "restricted tables" in reason.lower()


def test_validate_sql_blocks_unscoped_receipts_query():
    sql = "SELECT r.id, r.total FROM receipts r ORDER BY r.created_at DESC LIMIT 20;"
    ok, reason = validate_sql(sql)
    assert ok is False
    assert "user_id" in reason


def test_validate_sql_blocks_receipt_items_without_receipts_join():
    sql = "SELECT ri.id, ri.total_price FROM receipt_items ri WHERE ri.category_id IS NOT NULL;"
    ok, reason = validate_sql(sql)
    assert ok is False
    assert "must join receipts" in reason

