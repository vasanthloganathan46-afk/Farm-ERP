import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def generate_id(prefix: str, index: int) -> str:
    return f"{prefix}_{str(index).zfill(4)}"

async def init_sample_data():
    print("Initializing sample data...")
    
    # Clear existing data
    await db.users.delete_many({})
    await db.farmers.delete_many({})
    await db.machinery.delete_many({})
    await db.employees.delete_many({})
    await db.bookings.delete_many({})
    await db.field_logs.delete_many({})
    await db.invoices.delete_many({})
    await db.payments.delete_many({})
    await db.maintenance.delete_many({})
    await db.wages.delete_many({})
    
    # Create users for each role (UPDATED FOR SELF-SERVICE MODEL)
    users = [
        {"username": "admin", "full_name": "Admin User", "role": "super_admin", "email": "admin@agrigear.com", "password_hash": pwd_context.hash("admin123"), "organization_id": "default_org", "status": "Active"},
        {"username": "manager", "full_name": "Manager", "role": "org_admin", "email": "manager@agrigear.com", "password_hash": pwd_context.hash("manager123"), "organization_id": "default_org", "status": "Active"},
        {"username": "operator1", "full_name": "Operator 1", "role": "operator", "email": "operator@agrigear.com", "password_hash": pwd_context.hash("op123"), "organization_id": "default_org", "status": "Active"},
        {"username": "mechanic1", "full_name": "Mechanic 1", "role": "mechanic", "email": "mechanic@agrigear.com", "password_hash": pwd_context.hash("mech123"), "organization_id": "default_org", "status": "Active"},
        {"username": "owner", "full_name": "Business Owner", "role": "owner", "email": "owner@agrigear.com", "password_hash": pwd_context.hash("owner123"), "organization_id": "default_org", "status": "Active"},
        # Sample farmers with login capability
        {"username": "farmer1", "full_name": "Rajesh Kumar", "role": "farmer", "email": "rajesh@example.com", "phone": "+91-9876543210", "password_hash": pwd_context.hash("farmer123"), "village": "Greenfield", "land_size": 10.5, "organization_id": "default_org", "status": "Active"},
        {"username": "farmer2", "full_name": "Amit Patel", "role": "farmer", "email": "amit@example.com", "phone": "+91-9876543211", "password_hash": pwd_context.hash("farmer123"), "village": "Riverside", "land_size": 8.2, "organization_id": "default_org", "status": "Active"},
        {"username": "farmer3", "full_name": "Suresh Singh", "role": "farmer", "email": "suresh@example.com", "phone": "+91-9876543212", "password_hash": pwd_context.hash("farmer123"), "village": "Meadow Valley", "land_size": 15.0, "organization_id": "default_org", "status": "Active"}
    ]
    await db.users.insert_many(users)
    print(f"Created {len(users)} users (including farmer logins)")
    
    # Create farmers
    # Villages around Coimbatore with approximate coordinates
    villages_data = [
        {"name": "Thondamuthur", "lat": 11.0016, "lon": 76.8236},
        {"name": "Pollachi", "lat": 10.6609, "lon": 77.0048},
        {"name": "Kinathukadavu", "lat": 10.8242, "lon": 77.0229},
        {"name": "Mettupalayam", "lat": 11.2994, "lon": 76.9405},
        {"name": "Annur", "lat": 11.2330, "lon": 77.1080},
        {"name": "Sulur", "lat": 11.0260, "lon": 77.1264},
        {"name": "Madukkarai", "lat": 10.9027, "lon": 76.9642}
    ]
    villages = [v["name"] for v in villages_data]
    
    farmers = []
    for i in range(1, 16):
        village_info = random.choice(villages_data)
        farmer = {
            "farmer_id": generate_id("FRM", i),
            "name": f"Farmer {i}",
            "phone": f"+91-9{str(random.randint(100000000, 999999999))}",
            "village": village_info["name"],
            "location": {"lat": village_info["lat"] + random.uniform(-0.01, 0.01), "lon": village_info["lon"] + random.uniform(-0.01, 0.01)},
            "land_size": round(random.uniform(2.0, 20.0), 2),
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(30, 365))).isoformat()
        }
        farmers.append(farmer)
    await db.farmers.insert_many(farmers)
    print(f"Created {len(farmers)} farmers")
    
    # Create machinery
    machine_types = [
        {"type": "Heavy Duty Tractor", "hour": 800, "acre": 1200},
        {"type": "Medium Tractor", "hour": 600, "acre": 900},
        {"type": "Harvester", "hour": 1000, "acre": 1500},
        {"type": "Rotavator", "hour": 500, "acre": 750},
        {"type": "Plough", "hour": 400, "acre": 600},
        {"type": "Seeder", "hour": 450, "acre": 700},
        {"type": "Sprayer", "hour": 350, "acre": 550}
    ]
    machinery = []
    for i, mt in enumerate(machine_types, 1):
        village_info = random.choice(villages_data) # Assign machine to a village
        machine = {
            "machinery_id": generate_id("MCH", i),
            "machine_type": mt["type"],
            "rate_per_hour": mt["hour"],
            "rate_per_acre": mt["acre"],
            "status": random.choice(["Available", "Available", "Available", "Booked"]),
            "total_usage_hours": round(random.uniform(50.0, 500.0), 2),
            "location": {
                "type": "Point",
                "coordinates": [
                    village_info["lon"] + random.uniform(-0.01, 0.01), 
                    village_info["lat"] + random.uniform(-0.01, 0.01)
                ]
            },
            "curr_village": village_info["name"],
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(100, 500))).isoformat(),
             # Assign to default_org for now, or randomize if multi-tenant testing needs it. 
             # The user asked for "Tenant A". Let's assume default_org IS Tenant A for this test.
             "organization_id": "default_org" 
        }
        machinery.append(machine)
    await db.machinery.insert_many(machinery)
    await db.machinery.create_index([("location", "2dsphere")])
    print(f"Created {len(machinery)} machinery items with 2dsphere index")
    
    # Create employees
    # Create specific employees for demo users
    employees = [
        {
            "employee_id": generate_id("EMP", 1),
            "name": "Operator 1",
            "role": "Operator",
            "department": "Field Operations",
            "skill": "Expert",
            "joining_date": datetime.now(timezone.utc).isoformat(),
            "wage_rate": 500,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "organization_id": "default_org"
        },
        {
            "employee_id": generate_id("EMP", 2),
            "name": "Mechanic 1",
            "role": "Mechanic",
            "department": "Maintenance",
            "skill": "Expert",
            "joining_date": datetime.now(timezone.utc).isoformat(),
            "wage_rate": 600,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "organization_id": "default_org"
        }
    ]

    # Create random employees
    roles = ["Manager", "Operator", "Mechanic", "Field Worker"]
    for i in range(3, 11):
        role = random.choice(roles)
        dept = "Management" if role == "Manager" else "Field Operations" if role in ["Operator", "Field Worker"] else "Maintenance"
        employee = {
            "employee_id": generate_id("EMP", i),
            "name": f"{role} {i}",
            "role": role,
            "department": dept,
            "skill": random.choice(["Beginner", "Intermediate", "Expert"]),
            "joining_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(30, 1000))).isoformat(),
            "wage_rate": random.randint(300, 800),
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(30, 1000))).isoformat(),
            "organization_id": "default_org"
        }
        employees.append(employee)
    
    await db.employees.insert_many(employees)
    print(f"Created {len(employees)} employees")
    
    # Create bookings
    statuses = ["Confirmed", "Completed", "Pending"]
    approval_statuses = ["Approved", "Approved", "Pending"]
    bookings = []
    for i in range(1, 21):
        status = random.choice(statuses)
        approval = "Approved" if status != "Pending" else "Pending"
        booking = {
            "booking_id": generate_id("BKG", i),
            "farmer_id": farmers[random.randint(0, 2)]["name"],  # Use first 3 farmers who have login
            "machinery_id": random.choice(machinery)["machinery_id"],
            "operator_id": random.choice([emp["employee_id"] for emp in employees if emp["role"] == "Operator"]) if approval == "Approved" else None,
            "booking_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))).isoformat(),
            "field_location": f"Field {random.randint(1, 50)}, {random.choice(villages)}",
            "expected_hours": round(random.uniform(2.0, 10.0), 2) if random.choice([True, False]) else None,
            "expected_acres": round(random.uniform(3.0, 15.0), 2) if random.choice([True, False]) else None,
            "status": status,
            "approval_status": approval,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))).isoformat()
        }
        bookings.append(booking)
    await db.bookings.insert_many(bookings)
    print(f"Created {len(bookings)} bookings")
    
    # Create field logs for completed bookings
    completed_bookings = [b for b in bookings if b["status"] == "Completed"]
    field_logs = []
    for i, booking in enumerate(completed_bookings, 1):
        log = {
            "log_id": generate_id("LOG", i),
            "booking_id": booking["booking_id"],
            "operator_id": booking["operator_id"],
            "actual_hours": round(random.uniform(2.0, 10.0), 2) if booking["expected_hours"] else None,
            "actual_acres": round(random.uniform(3.0, 15.0), 2) if booking["expected_acres"] else None,
            "notes": random.choice(["Work completed successfully", "Minor delay due to weather", "Field conditions were good", "Equipment performed well"]),
            "completed_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 20))).isoformat(),
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 20))).isoformat()
        }
        field_logs.append(log)
    await db.field_logs.insert_many(field_logs)
    print(f"Created {len(field_logs)} field logs")
    
    # Create invoices for completed bookings
    invoices = []
    for i, booking in enumerate(completed_bookings, 1):
        # Get corresponding field log
        log = next((l for l in field_logs if l["booking_id"] == booking["booking_id"]), None)
        if log:
            # Get machinery to calculate amount
            machine = next((m for m in machinery if m["machinery_id"] == booking["machinery_id"]), None)
            if machine:
                amount = 0.0
                if log.get("actual_hours"):
                    amount = log["actual_hours"] * machine["rate_per_hour"]
                elif log.get("actual_acres"):
                    amount = log["actual_acres"] * machine["rate_per_acre"]
                
                invoice = {
                    "invoice_id": generate_id("INV", i),
                    "booking_id": booking["booking_id"],
                    "farmer_id": booking["farmer_id"],
                    "amount": amount,
                    "payment_status": random.choice(["Paid", "Paid", "Pending", "Partially Paid"]),
                    "generated_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 15))).isoformat(),
                    "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 15))).isoformat(),
                    # Invoices belong to the organization that owns the machinery/booking
                    "organization_id": "default_org" 
                }
                invoices.append(invoice)
    await db.invoices.insert_many(invoices)
    print(f"Created {len(invoices)} invoices")
    
    # Create payments for paid invoices
    paid_invoices = [inv for inv in invoices if inv["payment_status"] in ["Paid", "Partially Paid"]]
    payments = []
    for i, invoice in enumerate(paid_invoices, 1):
        payment_amount = invoice["amount"] if invoice["payment_status"] == "Paid" else invoice["amount"] * 0.5
        payment = {
            "payment_id": generate_id("PAY", i),
            "invoice_id": invoice["invoice_id"],
            "amount": payment_amount,
            "payment_method": random.choice(["Cash", "UPI", "Bank Transfer"]),
            "paid_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 10))).isoformat(),
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 10))).isoformat(),
            "organization_id": "default_org"
        }
        payments.append(payment)
    await db.payments.insert_many(payments)
    print(f"Created {len(payments)} payments")
    
    # Create maintenance records
    maintenance_records = []
    for i in range(1, 8):
        completed = random.choice([True, True, False])
        record = {
            "maintenance_id": generate_id("MNT", i),
            "machinery_id": random.choice(machinery)["machinery_id"],
            "mechanic_id": random.choice([emp["employee_id"] for emp in employees if emp["role"] == "Mechanic"]),
            "service_type": random.choice(["Routine Service", "Oil Change", "Parts Replacement", "Engine Repair", "General Inspection"]),
            "notes": random.choice(["Regular maintenance completed", "Replaced worn parts", "Engine tuning done", "All checks passed"]),
            "started_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat(),
            "completed_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 10))).isoformat() if completed else None,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat()
        }
        maintenance_records.append(record)
    await db.maintenance.insert_many(maintenance_records)
    print(f"Created {len(maintenance_records)} maintenance records")
    
    # Create wage records for completed bookings
    wage_records = []
    for i, booking in enumerate(completed_bookings[:10], 1):
        operator = next((emp for emp in employees if emp["employee_id"] == booking["operator_id"]), None)
        if operator:
            wage = {
                "wage_id": generate_id("WAG", i),
                "employee_id": operator["employee_id"],
                "booking_id": booking["booking_id"],
                "wage_amount": operator["wage_rate"],
                "paid_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 15))).isoformat(),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 15))).isoformat()
            }
            wage_records.append(wage)
    await db.wages.insert_many(wage_records)
    print(f"Created {len(wage_records)} wage records")
    
    print("\n=== Sample Data Initialization Complete ===")
    print("\nDemo Users Created:")
    print("  Admin:       username: admin       password: admin123")
    print("  Operator:    username: operator1   password: op123")
    print("  Mechanic:    username: mechanic1   password: mech123")
    print("  Owner:       username: owner       password: owner123")
    print("\nDemo Farmers (with login access):")
    print("  Farmer 1:    username: farmer1     password: farmer123")
    print("  Farmer 2:    username: farmer2     password: farmer123")
    print("  Farmer 3:    username: farmer3     password: farmer123")
    print("\nYou can now login with any of these users.")

if __name__ == "__main__":
    asyncio.run(init_sample_data())
