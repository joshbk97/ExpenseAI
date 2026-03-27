from auth import create_access_token, decode_token, hash_password, verify_password


def test_password_hash_and_verify():
    password = "super-secret"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_create_and_decode_access_token():
    token = create_access_token(42)
    decoded = decode_token(token)
    assert decoded == 42


def test_decode_invalid_token_returns_none():
    assert decode_token("not-a-valid-token") is None
