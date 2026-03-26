import asyncio
from auth import get_current_user, create_access_token
from database import async_session
from fastapi.security import HTTPAuthorizationCredentials
import traceback
import sys

async def main():
    try:
        # Create a valid token for user ID 1 (or any existing user)
        token = create_access_token(1)
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        
        async with async_session() as db:
            user = await get_current_user(creds, db)
            print("User fetch successful:", user.email, user.full_name, user.created_at)
            
            # Now test Pydantic validation
            from schemas import UserOut
            out = UserOut.model_validate(user, from_attributes=True)
            print("Pydantic validation successful:", out.model_dump())
            
    except Exception as e:
        print("EXCEPTION CAUGHT:")
        traceback.print_exc(file=sys.stdout)

if __name__ == "__main__":
    asyncio.run(main())
