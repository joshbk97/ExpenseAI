import urllib.request, json
body = json.dumps({"email":"test100@example.com","password":"password123","full_name":"Test"}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/auth/register', data=body, headers={'Content-Type':'application/json'}, method='POST')
try:
    res = urllib.request.urlopen(req)
    token = json.loads(res.read())['access_token']
    req2 = urllib.request.Request('http://127.0.0.1:8000/api/auth/me', headers={'Authorization': 'Bearer ' + token})
    res2 = urllib.request.urlopen(req2)
    print("SUCCESS", res2.read().decode())
except Exception as e:
    import urllib.error
    if isinstance(e, urllib.error.HTTPError):
        print("ERROR:", e.code, e.read().decode())
    else:
        print("ERROR:", str(e))
