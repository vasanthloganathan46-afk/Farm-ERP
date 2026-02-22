import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone
import uuid

# Configuration
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def generate_id(prefix: str) -> str:
    return f"{prefix}_{str(uuid.uuid4())[:8]}"

async def seed_org_b():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("Seeding Organization B...")
    
    # 1. Create Org B Admin
    await db.users.delete_one({"username": "manager_b"})
    
    admin_b_data = {
        "username": "manager_b",
        "full_name": "Org B Manager",
        "role": "org_admin",
        "email": "manager_b@example.com",
        "phone": "9998887776",
        "password_hash": hash_password("manager123"),
        "organization_id": "org_b",
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_b_data)
    print("Created User: manager_b (Org B Admin)")

    # 2. Create Machinery for Org B
    machinery_b = await db.machinery.find_one({"machinery_id": "MCH_B_001"})
    if not machinery_b:
        mach_data = {
            "machinery_id": "MCH_B_001",
            "name": "Tractor B-Series",
            "machine_type": "Tractor",
            "model": "JD-5050D",
            "status": "Available",
            "rate_per_hour": 1200.0,
            "rate_per_acre": 500.0,
            "fuel_level": 80.0,
            "last_maintenance_date": "2023-01-01",
            "total_usage_hours": 10.0,
            "organization_id": "org_b", # STRICT TENANT
            "location": {
                "type": "Point",
                "coordinates": [78.9629, 20.5937]  # Some location
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.machinery.insert_one(mach_data)
        print("Created Machinery: MCH_B_001 (Org B)")
    
    # 3. Create Invoice for Org B
    invoice_b = await db.invoices.find_one({"invoice_id": "INV_B_001"})
    if not invoice_b:
        inv_data = {
            "invoice_id": "INV_B_001",
            "booking_id": "BKG_B_001", # Assume fake booking
            "farmer_id": "farmer_global", # Assume global farmer
            "amount": 5000.0,
            "payment_status": "Paid",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "organization_id": "org_b"
        }
        await db.invoices.insert_one(inv_data)
        print("Created Invoice: INV_B_001 (Org B)")

    print("Seeding Complete.")

if __name__ == "__main__":
    asyncio.run(seed_org_b())
