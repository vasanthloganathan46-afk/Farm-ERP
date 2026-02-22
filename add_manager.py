import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Auth configs
PWD_CONTEXT = CryptContext(schemes=["bcrypt"], deprecated="auto")
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

async def add_manager():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    manager_data = {
        "username": "manager", 
        "full_name": "Manager", 
        "role": "org_admin", 
        "email": "manager@agrigear.com", 
        "password_hash": PWD_CONTEXT.hash("manager123"), 
        "organization_id": "default_org", 
        "status": "Active"
    }
    
    existing = await db.users.find_one({"username": "manager"})
    if existing:
        print("Manager already exists, updating role/password...")
        await db.users.update_one({"username": "manager"}, {"$set": manager_data})
    else:
        print("Creating manager user...")
        await db.users.insert_one(manager_data)
    
    print("Manager user ready.")
    client.close()

if __name__ == "__main__":
    asyncio.run(add_manager())
