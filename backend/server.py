from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import random
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ── Database connection ─────────────────────────────────────────────────────
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name   = os.environ.get('DB_NAME',   'agrigear_erp')

if not os.environ.get('MONGO_URL'):
    print("\n[WARNING] MONGO_URL not found in .env — using fallback: mongodb://localhost:27017")
if not os.environ.get('DB_NAME'):
    print("[WARNING] DB_NAME not found in .env — using fallback: agrigear_erp\n")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============ MODELS ============

class Organization(BaseModel):
    model_config = ConfigDict(extra="ignore")
    organization_id: str
    name: str
    plan: str = "Standard"
    status: str = "Active"
    created_at: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    username: str
    full_name: str
    role: str  # super_admin, org_admin, owner, operator, mechanic, farmer
    email: str
    phone: Optional[str] = None
    password_hash: str
    organization_id: str = "default_org"
    status: str = "Pending"  # Pending, Active, Rejected

class FarmerRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: Optional[str] = None
    village: str
    land_size: float

class UserCreate(BaseModel):
    username: str
    full_name: str
    role: str
    email: str
    password: str
    monthly_salary: Optional[float] = 0.0

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    organization_id: Optional[str] = None
    status: Optional[str] = None

class MechanicRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: Optional[str] = None
    skills: str  # e.g. "Tractor repair, hydraulics, welding"
    hourly_rate: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class SuspendUserRequest(BaseModel):
    suspension_reason: str

class SupportMessageCreate(BaseModel):
    username: str
    message_text: str

class SupportReplyCreate(BaseModel):
    message_text: str

class SupportGuestInquiryCreate(BaseModel):
    name: str
    email: EmailStr
    message: str

class InquiryReplyCreate(BaseModel):
    message: str

class OrganizationCreate(BaseModel):
    company_name: str
    contact_email: EmailStr
    phone: Optional[str] = None
    owner_name: str
    owner_email: EmailStr

class ManagerCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: Optional[str] = None
    monthly_salary: Optional[float] = 0.0

class UserResponse(BaseModel):
    username: str
    full_name: str
    role: str
    email: Optional[str] = None
    phone: Optional[str] = None
    organization_id: Optional[str] = None
    status: Optional[str] = None
    company_name: Optional[str] = None
    tenant_name: Optional[str] = None
    tenant_id: Optional[str] = None
    monthly_salary: Optional[float] = 0.0
    must_change_password: Optional[bool] = False
    hourly_wage: Optional[float] = 0.0

class OperatorCreate(BaseModel):
    username: str
    full_name: str
    email: str
    phone: Optional[str] = None
    password: Optional[str] = None
    hourly_wage: Optional[float] = 0.0

class OperatorUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class Machinery(BaseModel):
    model_config = ConfigDict(extra="ignore")
    machinery_id: str
    machine_type: str
    rate_per_hour: float
    rate_per_acre: float
    status: str
    total_usage_hours: float
    image_url: Optional[str] = None
    description: Optional[str] = None
    location: Optional[dict] = None # GeoJSON: { "type": "Point", "coordinates": [lon, lat] }
    curr_village: Optional[str] = None
    created_at: str
    organization_id: str = "default_org"
    company_name: Optional[str] = None
    company_rating: Optional[float] = None

class MachineryCreate(BaseModel):
    machine_type: str
    rate_per_hour: float
    rate_per_acre: float
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class MachineryUpdate(BaseModel):
    machine_type: Optional[str] = None
    rate_per_hour: Optional[float] = None
    rate_per_acre: Optional[float] = None
    status: Optional[str] = None
    total_usage_hours: Optional[float] = None

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    employee_id: str
    name: str
    role: str
    department: Optional[str] = None
    skill: str
    joining_date: str
    wage_rate: float
    monthly_salary: Optional[float] = 0.0
    hourly_wage: Optional[float] = 0.0
    created_at: str
    organization_id: str = "default_org"

class EmployeeCreate(BaseModel):
    name: str
    role: str
    department: Optional[str] = None
    skill: str
    joining_date: str
    wage_rate: float

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    booking_id: str
    farmer_id: str
    machinery_id: str
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    booking_date: str
    field_location: str
    expected_hours: Optional[float] = None
    expected_acres: Optional[float] = None
    status: str
    approval_status: str
    created_at: str
    organization_id: str = "default_org"
    farmer_name: Optional[str] = None
    machine_type: Optional[str] = None
    machine_status: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = None
    review: Optional[str] = None

class BookingCreate(BaseModel):
    machinery_id: str
    booking_date: str
    field_location: str
    expected_hours: Optional[float] = None
    expected_acres: Optional[float] = None
    operator_id: Optional[str] = None

class BookingUpdate(BaseModel):
    operator_id: Optional[str] = None
    status: Optional[str] = None
    approval_status: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = None
    review: Optional[str] = None

class BookingReassign(BaseModel):
    machinery_id: str
    operator_id: str

class FieldLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    booking_id: str
    operator_id: str
    actual_hours: Optional[float] = None
    actual_acres: Optional[float] = None
    notes: Optional[str] = None
    completed_at: str
    created_at: str
    organization_id: str = "default_org"

class FieldLogCreate(BaseModel):
    booking_id: str
    actual_hours: Optional[float] = None
    actual_acres: Optional[float] = None
    notes: Optional[str] = None

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invoice_id: str
    booking_id: str
    farmer_id: str
    amount: float
    payment_status: str
    generated_at: str
    created_at: str
    organization_id: str = "default_org"
    farmer_name: Optional[str] = None

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payment_id: str
    invoice_id: str
    amount: float
    payment_method: str
    paid_at: str
    organization_id: str = "default_org"

class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    payment_method: str

class MaintenanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    maintenance_id: str
    machinery_id: str
    mechanic_id: str
    service_type: str
    status: Optional[str] = "pending_assignment"   # ← CRITICAL: must be in model or it gets stripped
    notes: Optional[str] = None
    started_at: str
    completed_at: Optional[str] = None
    spare_parts_cost: float = 0.0
    labor_cost: float = 0.0
    total_cost: float = 0.0
    created_at: str
    organization_id: str = "default_org"
    spare_parts: List[dict] = []
    machine_type: Optional[str] = None
    mechanic_name: Optional[str] = None
    rating: Optional[int] = None
    feedback: Optional[str] = None
    accepted_at: Optional[str] = None
    rejected_at: Optional[str] = None
    assigned_at: Optional[str] = None
    completed_at: Optional[str] = None

class MaintenanceCreate(BaseModel):
    machinery_id: str
    mechanic_id: str
    service_type: str
    notes: Optional[str] = None
    status: str = Field("pending_assignment", description="Must never be None")

class MaintenanceUpdate(BaseModel):
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    spare_parts_cost: Optional[float] = None
    labor_cost: Optional[float] = None
    mechanic_id: Optional[str] = None
    status: Optional[str] = None

class MaterialRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str
    maintenance_id: str
    mechanic_id: str
    part_name: str
    estimated_cost: float
    status: str = "Pending"  # Pending, Approved, Rejected, Ordered
    admin_notes: Optional[str] = None
    created_at: str
    organization_id: str = "default_org"
    mechanic_name: Optional[str] = None

class MaterialRequestCreate(BaseModel):
    maintenance_id: str
    part_name: str
    estimated_cost: float = Field(0.0, ge=0, description="Cost cannot be negative")
    quantity: int = Field(default=1, gt=0, description="Must be at least 1")

class MaterialRequestUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None

class WageRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    wage_id: str
    employee_id: str
    booking_id: str
    wage_amount: float
    payment_status: str = "pending"  # pending, paid
    paid_at: Optional[str] = None
    created_at: str
    organization_id: str = "default_org"
    employee_name: Optional[str] = None
    employee_role: Optional[str] = None

class WageCreate(BaseModel):
    employee_id: str
    booking_id: str
    wage_amount: float

class FuelExpenseCreate(BaseModel):
    liters: float
    cost_per_liter: float
    date: str
    notes: Optional[str] = None

class MaintenanceAssign(BaseModel):
    mechanic_username: str

class CompleteJobRequest(BaseModel):
    labor_charge: float = 0.0
    spare_parts_cost: float = 0.0
    notes: Optional[str] = None

class DashboardStats(BaseModel):
    total_revenue: float
    total_bookings: int
    active_machinery: int
    pending_payments: float
    total_farmers: int
    total_employees: int
    average_rating: Optional[float] = 0.0
    total_reviews: Optional[int] = 0
    total_spare_parts_cost: Optional[float] = 0.0

class AvailabilityCheck(BaseModel):
    machinery_id: str
    date: str

# ============ HELPER FUNCTIONS ============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if user is None:
        raise credentials_exception
        
    if user.get("status") != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Please wait for admin approval."
        )
        
    return UserResponse(**user)

def generate_id(prefix: str) -> str:
    import uuid
    return f"{prefix}_{str(uuid.uuid4())[:8]}"

# ============ AUTO-INVOICE GENERATOR ============
async def auto_generate_invoice(booking_id: str, field_log: dict):
    """Automatically generate invoice when field log is completed"""
    try:
        booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
        if not booking:
            return
        
        machinery = await db.machinery.find_one({"machinery_id": booking["machinery_id"]}, {"_id": 0})
        if not machinery:
            return
        
        # Calculate amount
        amount = 0.0
        if field_log.get("actual_hours"):
            amount = field_log["actual_hours"] * machinery["rate_per_hour"]
        elif field_log.get("actual_acres"):
            amount = field_log["actual_acres"] * machinery["rate_per_acre"]
        
        # Check if invoice already exists
        existing = await db.invoices.find_one({"booking_id": booking_id}, {"_id": 0})
        if existing:
            return
        
        invoice_data = {
            "invoice_id": generate_id("INV"),
            "booking_id": booking_id,
            "farmer_id": booking["farmer_id"],
            "amount": amount,
            "payment_status": "Pending",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "organization_id": booking.get("organization_id", "default_org")
        }
        
        await db.invoices.insert_one(invoice_data)
        logging.info(f"Auto-generated invoice {invoice_data['invoice_id']} for booking {booking_id}")
        
    except Exception as e:
        logging.error(f"Failed to auto-generate invoice: {str(e)}")

# ============ AUTH ROUTES ============

@api_router.post("/auth/register-farmer")
async def register_farmer(farmer_data: FarmerRegister):
    """Public endpoint for farmer self-registration"""
    # Check if email already exists
    existing = await db.users.find_one({"email": farmer_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate username from email
    username = farmer_data.email.split('@')[0] + str(random.randint(1000, 9999))

    # NO password at registration — credentials generated only on admin approval
    user_data = {
        "username": username,
        "full_name": farmer_data.full_name,
        "role": "farmer",
        "email": farmer_data.email,
        "phone": farmer_data.phone,
        "password_hash": None,
        "organization_id": None,
        "village": farmer_data.village,
        "land_size": farmer_data.land_size,
        "must_change_password": True,
        "status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_data)
    
    return {
        "message": "Registration submitted successfully. Your account is pending admin approval.",
        "username": username
    }

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user = await db.users.find_one({"username": request.username}, {"_id": 0})
    if not user:
        # Try email login
        user = await db.users.find_one({"email": request.username}, {"_id": 0})
    
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    # Suspension check — specific message before the generic active check
    if user.get("status", "").lower() == "suspended":
        reason = user.get("suspension_reason") or "No reason provided."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"SUSPENDED:{user['username']}:{reason}"
        )

    if user.get("status") != "Active": 
        if user.get("role") == "mechanic":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your mechanic account is pending approval by the Super Admin. Please wait for approval before logging in."
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Please wait for admin approval."
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "organization_id": user.get("organization_id", "default_org")
        },
        expires_delta=access_token_expires
    )
    
    user_response = UserResponse(**user)
    # Carry must_change_password from DB
    user_response.must_change_password = user.get("must_change_password", False)

    # Populate company_name from org so it's available immediately at login
    org_id = user.get("organization_id")
    if org_id and org_id != "default_org":
        org = await db.organizations.find_one({"organization_id": org_id})
        if org:
            user_response.company_name = org.get("name", "")
            user_response.tenant_name = org.get("name", "")

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    # Verified dependency: get_current_user is used and NOT restricted to Super Admin role
    user_dict = current_user.model_dump()
    if user_dict.get("organization_id") and user_dict["organization_id"] != "default_org":
        org = await db.organizations.find_one({"organization_id": user_dict["organization_id"]})
        if org:
            current_user.company_name = org.get("name", "Unknown Organization")
            current_user.tenant_name = org.get("name", "Unknown Organization")
        else:
            current_user.company_name = "No Org Found"
            current_user.tenant_name = "No Org Found"
    elif current_user.tenant_id:
        from bson import ObjectId
        org = await db.organizations.find_one({"_id": ObjectId(current_user.tenant_id)})
        if org:
            current_user.company_name = org.get("name") # Using name, not company_name which might be missing
            current_user.tenant_name = org.get("name")
            
    return current_user

@api_router.get("/farmers", response_model=List[UserResponse])
async def get_farmers(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "org_admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    farmers = await db.users.find({"role": "farmer"}, {"_id": 0}).to_list(1000)
    return farmers

@api_router.get("/admin/users/pending", response_model=List[UserResponse])
async def get_pending_users(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can view pending users")
    users = await db.users.find({"status": "Pending"}, {"_id": 0}).to_list(1000)
    return users

@api_router.post("/admin/users/{username}/approve")
async def approve_user(username: str, background_tasks: BackgroundTasks, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "owner", "org_admin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate credentials at approval time (deferred credential workflow)
    temp_password = secrets.token_urlsafe(10)

    await db.users.update_one(
        {"username": username},
        {"$set": {
            "status": "Active",
            "password_hash": hash_password(temp_password),
            "must_change_password": True
        }}
    )

    # Queue the email so the API responds instantly
    from utils.email import send_approval_email
    background_tasks.add_task(
        send_approval_email,
        user.get("email"),
        user.get("full_name", username),
        temp_password
    )

    return {"message": f"User {username} approved and email sent."}

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(role: Optional[str] = None, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can list all users")
    # Always exclude operators (tenant-managed by org_admin)
    query: dict = {"role": {"$ne": "operator"}}
    if role:
        # If a specific role is requested, honour it only if it's not operator
        if role == "operator":
            raise HTTPException(status_code=403, detail="Operators are managed by Org Admins")
        query = {"role": role}
    users = await db.users.find(query, {"_id": 0}).to_list(1000)
    return users

@api_router.put("/admin/users/{username}")
async def update_user(username: str, update: UserUpdate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can update users")
    
    update_data = update.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.users.find_one_and_update(
        {"username": username},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    result.pop("_id", None)
    return {"message": f"User {username} updated", "user": UserResponse(**result)}

@api_router.delete("/admin/users/{username}")
async def delete_user(username: str, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can delete users")
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User {username} deleted"}

@api_router.get("/admin/org-farmers")
async def get_org_farmers(current_user: UserResponse = Depends(get_current_user)):
    """Return farmers who have bookings with this organization."""
    if current_user.role not in ["org_admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Aggregate unique farmer_ids from bookings for this org
    pipeline = [
        {"$match": {"organization_id": current_user.organization_id}},
        {"$group": {"_id": "$farmer_id"}},
    ]
    farmer_agg = await db.bookings.aggregate(pipeline).to_list(1000)
    farmer_usernames = [f["_id"] for f in farmer_agg if f["_id"]]
    
    if not farmer_usernames:
        return []
    
    # Fetch user details for these farmers
    farmers = await db.users.find(
        {"username": {"$in": farmer_usernames}, "role": "farmer"},
        {"_id": 0}
    ).to_list(1000)
    
    return [UserResponse(**f) for f in farmers]

@api_router.get("/admin/mechanics")
async def get_all_mechanics(current_user: UserResponse = Depends(get_current_user)):
    """Return all mechanic-role employees globally (freelancers)."""
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    mechanics = await db.employees.find({"role": "Mechanic"}, {"_id": 0}).to_list(1000)
    return mechanics

@api_router.get("/org/farmers/all")
async def get_all_active_farmers(current_user: UserResponse = Depends(get_current_user)):
    """Fetch ALL active users where role == 'farmer', completely ignoring tenant_id."""
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    farmers = await db.users.find(
        {"role": "farmer", "status": "Active"},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    return farmers

@api_router.get("/org/farmers")
async def get_org_farmers_global(current_user: UserResponse = Depends(get_current_user)):
    """
    Tenant-specific farmers: only farmers who have booked with THIS org.
    Returns raw dicts (not UserResponse) so land_size and village are preserved.
    """
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Step 1: find all distinct farmer usernames who booked with this org
    farmer_usernames = await db.bookings.distinct(
        "farmer_id",
        {"organization_id": current_user.organization_id}
    )

    if not farmer_usernames:
        print(f"[ORG FARMERS] No bookings found for org '{current_user.organization_id}'")
        return []

    # Step 2: fetch those farmers from users collection — raw dict preserves land_size, village
    farmers = await db.users.find(
        {"username": {"$in": farmer_usernames}, "role": "farmer"},
        {"_id": 0, "password_hash": 0}  # exclude sensitive fields
    ).to_list(1000)

    print(f"[ORG FARMERS] Returning {len(farmers)} tenant-specific farmers for org '{current_user.organization_id}'")
    return farmers

@api_router.get("/org/mechanic-users")
async def get_mechanic_users(current_user: UserResponse = Depends(get_current_user)):
    """Return all ACTIVE users with role=mechanic (for assigning to maintenance jobs by username)."""
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    mechanics = await db.users.find(
        {"role": "mechanic", "status": "Active"},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return mechanics

@api_router.get("/org/mechanics/available")
async def get_available_mechanics(current_user: UserResponse = Depends(get_current_user)):
    """
    Global mechanic pool — NO tenant filter (mechanics are freelancers, not tenant-bound).
    Returns all Active mechanics from the users collection for the assignment dropdown.
    """
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    mechanics = await db.users.find(
        {"role": "mechanic", "status": "Active"},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    print(f"[MECHANICS AVAILABLE] Returning {len(mechanics)} global active mechanics")
    return mechanics

# ============ ORG ADMIN: OPERATOR CRUD ============

@api_router.get("/org/operators", response_model=List[UserResponse])
async def get_org_operators(current_user: UserResponse = Depends(get_current_user)):
    """Org Admin: list operators belonging to this organization."""
    if current_user.role not in ["org_admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    operators = await db.users.find(
        {"role": "operator", "organization_id": current_user.organization_id},
        {"_id": 0}
    ).to_list(1000)
    return [UserResponse(**o) for o in operators]

@api_router.post("/org/operators")
async def create_org_operator(operator: OperatorCreate, current_user: UserResponse = Depends(get_current_user)):
    """Org Admin: create a new operator for this organization + email credentials."""
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Only Org Admin can create operators")
    # Check username uniqueness
    existing = await db.users.find_one({"username": operator.username})
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{operator.username}' already exists")
    # Check email uniqueness
    existing_email = await db.users.find_one({"email": operator.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Auto-generate temp password (operator never sees their own password creation)
    raw_password = secrets.token_urlsafe(10)

    user_doc = {
        "username": operator.username,
        "full_name": operator.full_name,
        "role": "operator",
        "email": operator.email,
        "phone": operator.phone,
        "password_hash": hash_password(raw_password),
        "organization_id": current_user.organization_id,
        "hourly_wage": operator.hourly_wage or 0.0,
        "must_change_password": True,
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    user_doc["tenant_id"] = current_user.tenant_id
    user_doc["role"] = "operator"
    await db.users.insert_one(user_doc)

    # Get company name for email
    org = await db.organizations.find_one({"organization_id": current_user.organization_id})
    company_name = org.get("name", "Your Organization") if org else "Your Organization"

    # Try to send welcome email to operator
    email_sent = False
    try:
        send_welcome_email(
            to_email=operator.email,
            owner_name=operator.full_name,
            company_name=company_name,
            username=operator.username,
            temp_password=raw_password,
            role_title="Operator"
        )
        email_sent = True
    except Exception as e:
        print(f"[OPERATOR] WARNING: Welcome email failed for {operator.email}: {e}")

    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)

    response = {**user_doc, "email_sent": email_sent}
    if not email_sent:
        response["temp_password"] = raw_password
    return response

@api_router.put("/org/operators/{username}", response_model=UserResponse)
async def update_org_operator(username: str, update: OperatorUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Org Admin: update an operator belonging to this organization."""
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Only Org Admin can update operators")
    # Guard: must belong to same org
    existing = await db.users.find_one({"username": username, "role": "operator", "organization_id": current_user.organization_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Operator not found in your organization")
    update_data = update.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.users.find_one_and_update(
        {"username": username},
        {"$set": update_data},
        return_document=True
    )
    result.pop("_id", None)
    return UserResponse(**result)

@api_router.delete("/org/operators/{username}")
async def delete_org_operator(username: str, current_user: UserResponse = Depends(get_current_user)):
    """Org Admin: delete an operator belonging to this organization."""
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Only Org Admin can delete operators")
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    existing = await db.users.find_one({"username": username, "role": "operator", "organization_id": current_user.organization_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Operator not found in your organization")
    await db.users.delete_one({"username": username})
    return {"message": f"Operator '{username}' deleted"}

# ============ SMTP EMAIL HELPER ============

SMTP_SERVER   = os.environ.get("SMTP_SERVER", "")
SMTP_PORT     = int(os.environ.get("SMTP_PORT", 587))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM     = os.environ.get("SMTP_FROM_NAME", "AgriGear ERP")
FRONTEND_URL  = os.environ.get("FRONTEND_URL", "http://localhost:3000")

def send_reset_email(to_email: str, reset_link: str):
    """Send password reset email via SMTP with strict Gmail TLS sequence."""

    # ── 1. Environment Variable Validation ──────────────────────────────────
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("\n" + "="*60)
        print("WARNING: SMTP credentials not found in environment.")
        print(f"  SMTP_SERVER   = '{SMTP_SERVER}'")
        print(f"  SMTP_PORT     = {SMTP_PORT}")
        print(f"  SMTP_USERNAME = '{SMTP_USERNAME}'")
        print(f"  SMTP_PASSWORD = {'[SET]' if SMTP_PASSWORD else '[EMPTY]'}")
        print("  → Falling back to terminal link output.")
        print("="*60)
        print(f"\n>>> [DEV] PASSWORD RESET LINK for {to_email}:\n    {reset_link}\n")
        logging.info(f"[PASSWORD RESET] Link for {to_email}: {reset_link}")
        return

    # ── 2. Build the HTML email ──────────────────────────────────────────────
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "AgriGear ERP - Password Reset Request"
    msg["From"]    = f"{SMTP_FROM} <{SMTP_USERNAME}>"
    msg["To"]      = to_email
    html_body = f"""
    <html><body style="font-family:sans-serif;max-width:600px;margin:auto">
      <div style="background:#0F3D3E;padding:24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0">AgriGear ERP</h1>
      </div>
      <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="{reset_link}" style="display:inline-block;background:#F97316;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">Reset My Password</a>
        <p style="color:#6b7280;font-size:12px">If you didn't request this, ignore this email. Your password won't change.</p>
        <p style="color:#6b7280;font-size:12px">Or copy this link: {reset_link}</p>
      </div>
    </body></html>
    """
    msg.attach(MIMEText(html_body, "html"))

    # ── 3. Strict TLS SMTP Sequence (Gmail standard) ─────────────────────────
    print(f"\n[EMAIL] Attempting SMTP connection → {SMTP_SERVER}:{SMTP_PORT} as {SMTP_USERNAME}")
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.ehlo()                              # Identify to server
        server.starttls()                          # Upgrade to TLS (mandatory for Gmail port 587)
        server.ehlo()                              # Re-identify after TLS upgrade
        server.login(SMTP_USERNAME, SMTP_PASSWORD) # Authenticate
        server.send_message(msg)                   # Send
        server.quit()                              # Graceful disconnect
        print(f"SUCCESS: Password reset email sent to {to_email}")
        logging.info(f"[EMAIL] Password reset sent to {to_email}")
    except Exception as e:
        print(f"\nSMTP EXCEPTION: {str(e)}")
        print(f"  Server : {SMTP_SERVER}:{SMTP_PORT}")
        print(f"  User   : {SMTP_USERNAME}")
        logging.error(f"[EMAIL] SMTP failure for {to_email}: {str(e)}")
        # Fallback: always print the link so the user isn't blocked
        print(f">>> [FALLBACK] PASSWORD RESET LINK for {to_email}:\n    {reset_link}\n")

def send_reply_email(to_email: str, message_text: str):
    """Send admin reply email via SMTP with strict Gmail TLS sequence."""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("\n" + "="*60)
        print(f"WARNING: SMTP credentials missing. Fake sent reply to {to_email}: {message_text}")
        print("="*60)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "AgriGear ERP - Support Reply"
    msg["From"]    = f"{SMTP_FROM} <{SMTP_USERNAME}>"
    msg["To"]      = to_email
    html_body = f"""
    <html><body style="font-family:sans-serif;max-width:600px;margin:auto">
      <div style="background:#0F3D3E;padding:24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0">AgriGear ERP Support</h1>
      </div>
      <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p>Hello,</p>
        <p>An admin has replied to your inquiry:</p>
        <blockquote style="background:#f3f4f6;padding:16px;border-left:4px solid #10b981;margin:16px 0;">
          {message_text}
        </blockquote>
        <p style="color:#6b7280;font-size:12px">Thank you, AgriGear ERP Team</p>
      </div>
    </body></html>
    """
    msg.attach(MIMEText(html_body, "html"))

    print(f"\n[EMAIL] Attempting SMTP connection → {SMTP_SERVER}:{SMTP_PORT} as {SMTP_USERNAME}")
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"SUCCESS: Reply email sent to {to_email}")
    except Exception as e:
        print(f"\nSMTP EXCEPTION: {str(e)}")
        logging.error(f"[EMAIL] SMTP failure for {to_email}: {str(e)}")

def send_welcome_email(to_email: str, owner_name: str, company_name: str, username: str, temp_password: str, role_title: str = "Owner"):
    """Send 'Welcome to AgriGear ERP' email with login credentials."""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("\n" + "="*60)
        print(f"WARNING: SMTP credentials missing. Printing credentials to terminal instead.")
        print(f"  TO: {to_email}")
        print(f"  Name: {owner_name}")
        print(f"  Role: {role_title}")
        print(f"  Company: {company_name}")
        print(f"  Username: {username}")
        print(f"  Password: {temp_password}")
        print(f"  Login URL: {FRONTEND_URL}/login")
        print("="*60)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Welcome to AgriGear ERP \u2014 {company_name}"
    msg["From"]    = f"{SMTP_FROM} <{SMTP_USERNAME}>"
    msg["To"]      = to_email
    html_body = f"""
    <html><body style="font-family:sans-serif;max-width:600px;margin:auto">
      <div style="background:#16a34a;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:white;margin:0">\U0001f69c Welcome to AgriGear ERP</h1>
      </div>
      <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <p>Hello <strong>{owner_name}</strong>,</p>
        <p>You have been added as a <strong>{role_title}</strong> for the organization
           <strong>{company_name}</strong> on AgriGear ERP. Here are your login credentials:</p>
        <div style="background:white;border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:4px 0"><strong>Login URL:</strong> <a href="{FRONTEND_URL}/login">{FRONTEND_URL}/login</a></p>
          <p style="margin:4px 0"><strong>Email:</strong> {to_email}</p>
          <p style="margin:4px 0"><strong>Username:</strong> {username}</p>
          <p style="margin:4px 0"><strong>Temporary Password:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">{temp_password}</code></p>
        </div>
        <p style="color:#dc2626;font-weight:bold">\u26a0\ufe0f Please change your password immediately after first login.</p>
        <p style="color:#6b7280;font-size:12px">If you did not expect this email, please contact the AgriGear ERP support team.</p>
      </div>
    </body></html>
    """
    msg.attach(MIMEText(html_body, "html"))

    print(f"\n[EMAIL] Sending welcome email to {to_email} for org '{company_name}' as {role_title}")
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"SUCCESS: Welcome email sent to {to_email}")
    except Exception as e:
        print(f"\nSMTP EXCEPTION: {str(e)}")
        print(f">>> [FALLBACK] Credentials for {to_email}:")
        print(f"    Username: {username}")
        print(f"    Password: {temp_password}")
        logging.error(f"[EMAIL] SMTP failure for welcome email to {to_email}: {str(e)}")

# ============ PASSWORD RESET FLOW ============

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """Generate a password reset token and send email (non-blocking via BackgroundTasks)."""
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        await db.users.update_one(
            {"email": request.email},
            {"$set": {"reset_token": token, "reset_token_expires": expires_at}}
        )
        reset_link = f"{FRONTEND_URL}/reset-password/{token}"
        background_tasks.add_task(send_reset_email, request.email, reset_link)
    return {"message": "If an account exists with that email, a reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Verify reset token and update password."""
    user = await db.users.find_one({"reset_token": request.token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    expires = user.get("reset_token_expires")
    if not expires or datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    await db.users.update_one(
        {"reset_token": request.token},
        {"$set": {"password_hash": hash_password(request.new_password)},
         "$unset": {"reset_token": "", "reset_token_expires": ""}}
    )
    return {"message": "Password reset successful. You can now log in with your new password."}

# ---- Forced password change for first login ----
class ChangePasswordRequest(BaseModel):
    new_password: str

@api_router.put("/users/change-password")
async def change_password(data: ChangePasswordRequest, current_user: UserResponse = Depends(get_current_user)):
    """Authenticated user changes their own password. Clears must_change_password flag."""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    await db.users.update_one(
        {"username": current_user.username},
        {"$set": {"password_hash": hash_password(data.new_password), "must_change_password": False}}
    )
    return {"message": "Password updated successfully"}

# ---- Drill-down report detail endpoint ----
@api_router.get("/dashboard/reports/{report_type}")
async def get_report_details(report_type: str, current_user: UserResponse = Depends(get_current_user)):
    """Return detailed data for a dashboard card drill-down."""
    if current_user.role not in ["org_admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    org_id = current_user.organization_id

    # Keys to strip from response dicts (raw IDs leak into frontend tables)
    RAW_ID_KEYS = {
        "machinery_id", "machine_id", "employee_id", "user_id",
        "farmer_id", "booking_id", "operator_id", "organization_id",
        "wage_id", "maintenance_id", "invoice_id", "log_id",
        "_id", "tenant_id", "password_hash"
    }

    if report_type == "revenue":
        bookings = await db.bookings.find(
            {"organization_id": org_id, "status": "Completed"},
            {"_id": 0}
        ).to_list(500)
        result = []
        for b in bookings:
            mach = await db.machinery.find_one({"machinery_id": b.get("machinery_id")}, {"_id": 0})
            farmer = await db.users.find_one({"username": b.get("farmer_id")}, {"_id": 0})
            hours = b.get("actual_hours") or b.get("expected_hours") or 0
            rate = mach.get("rate_per_hour", 0) if mach else 0
            result.append({
                "date": b.get("booking_date", ""),
                "machine": mach.get("machine_type", "Unknown") if mach else "Unknown",
                "farmer": farmer.get("full_name", "Unknown") if farmer else "Unknown",
                "hours": hours,
                "amount": round(hours * rate, 2)
            })
        return result

    elif report_type == "diesel":
        fuel_logs = await db.fuel_expenses.find(
            {"organization_id": org_id},
            {"_id": 0}
        ).to_list(500)
        result = []
        for f in fuel_logs:
            machine_name = "Unknown Machine"
            m_id = f.get("machinery_id") or f.get("machine_id") or f.get("equipment_id")
            if m_id:
                try:
                    # Try string-based machinery_id first
                    mach = await db.machinery.find_one({"machinery_id": m_id}, {"_id": 0})
                    if not mach:
                        # Fallback: try as ObjectId on _id
                        from bson import ObjectId as BsonObjectId
                        mach = await db.machinery.find_one({"_id": BsonObjectId(str(m_id))})
                    if mach:
                        machine_name = mach.get("machine_type") or mach.get("name") or mach.get("model") or "Unknown Machine"
                except Exception:
                    machine_name = str(m_id)
            result.append({
                "date": f.get("date", ""),
                "machine": machine_name,
                "liters": f.get("liters", 0),
                "cost_per_liter": f.get("cost_per_liter", 0),
                "total_cost": round(f.get("total_cost", 0), 2)
            })
        return result

    elif report_type == "wages":
        wages = await db.wages.find(
            {"organization_id": org_id},
            {"_id": 0}
        ).to_list(500)
        result = []
        for w in wages:
            # Resolve employee name — try multiple strategies
            emp_name = w.get("employee_name")
            if not emp_name or emp_name in ("N/A", "Unknown"):
                uid = w.get("employee_id") or w.get("operator_id") or w.get("user_id")
                if uid:
                    try:
                        # Strategy 1: lookup by username
                        emp = await db.users.find_one({"username": uid}, {"_id": 0})
                        # Strategy 2: lookup by email
                        if not emp:
                            emp = await db.users.find_one({"email": uid}, {"_id": 0})
                        # Strategy 3: lookup in employees collection by employee_id
                        if not emp:
                            emp = await db.employees.find_one({"employee_id": uid}, {"_id": 0})
                        # Strategy 4: try ObjectId lookup
                        if not emp:
                            try:
                                from bson import ObjectId as BsonObjectId
                                emp = await db.users.find_one({"_id": BsonObjectId(str(uid))})
                            except Exception:
                                pass
                        emp_name = emp.get("full_name") or emp.get("name") or uid if emp else uid
                    except Exception:
                        emp_name = str(uid)
            result.append({
                "date": w.get("date", w.get("created_at", "")),
                "employee": emp_name or "Unknown",
                "role": w.get("employee_role", w.get("role", "Unknown")),
                "amount": round(w.get("wage_amount", w.get("amount", 0)), 2),
                "status": w.get("payment_status", w.get("status", "Unknown"))
            })
        return result

    elif report_type == "maintenance":
        records = await db.maintenance.find(
            {"organization_id": org_id},
            {"_id": 0}
        ).to_list(500)
        result = []
        for m in records:
            mach = await db.machinery.find_one({"machinery_id": m.get("machinery_id")}, {"_id": 0})
            # Resolve mechanic name from users collection
            mechanic_name = m.get("mechanic_name")
            if not mechanic_name or mechanic_name == "N/A":
                mid = m.get("mechanic_id")
                if mid and mid != "unassigned":
                    mech_user = await db.users.find_one({"username": mid}, {"_id": 0})
                    mechanic_name = mech_user.get("full_name", mid) if mech_user else mid
                else:
                    mechanic_name = "Unassigned"
            result.append({
                "date": m.get("created_at", ""),
                "machine": mach.get("machine_type", "Unknown") if mach else "Unknown",
                "issue": m.get("service_type") or m.get("notes") or "Routine Maintenance",
                "mechanic": mechanic_name,
                "labor_charge": round(m.get("labor_cost", 0), 2),
                "spare_parts": round(m.get("spare_parts_cost", 0), 2),
                "total_cost": round(m.get("total_cost", 0), 2),
                "status": m.get("status", "Unknown")
            })
        return result

    elif report_type == "spare_parts":
        records = await db.maintenance.find(
            {"organization_id": org_id, "spare_parts": {"$exists": True, "$ne": []}},
            {"_id": 0}
        ).to_list(500)
        result = []
        for m in records:
            mach = await db.machinery.find_one({"machinery_id": m.get("machinery_id")}, {"_id": 0})
            machine_name = mach.get("machine_type", "Unknown") if mach else "Unknown"
            # Resolve mechanic name
            mechanic_name = m.get("mechanic_name")
            if not mechanic_name or mechanic_name in ("N/A", "Unknown"):
                mid = m.get("mechanic_id")
                if mid and mid != "unassigned":
                    mech_user = await db.users.find_one({"username": mid}, {"_id": 0})
                    mechanic_name = mech_user.get("full_name", mid) if mech_user else mid
                else:
                    mechanic_name = "Unassigned"
            for part in m.get("spare_parts", []):
                if part.get("status") in ("approved", "provided"):
                    result.append({
                        "date": m.get("created_at", ""),
                        "machine": machine_name,
                        "part_name": part.get("part_name", "Unknown"),
                        "cost": round(part.get("cost", part.get("estimated_cost", 0)), 2),
                        "mechanic": mechanic_name,
                        "status": part.get("status", "approved")
                    })
        return result

    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")

# ---- Manager Monthly Payroll Generator ----
@api_router.post("/wages/generate-managers")
async def generate_manager_payroll(current_user: UserResponse = Depends(get_current_user)):
    """Generate monthly salary records for all org_admin managers."""
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only the Owner can run Manager payroll.")
    now = datetime.now(timezone.utc)
    month_key = now.strftime("%Y-%m")  # e.g. "2026-03"
    org_id = current_user.organization_id

    managers = await db.users.find(
        {"role": "org_admin", "organization_id": org_id},
        {"_id": 0}
    ).to_list(100)

    generated = 0
    skipped = 0
    for mgr in managers:
        salary = mgr.get("monthly_salary", 0)
        if not salary or salary <= 0:
            skipped += 1
            continue
        # Prevent duplicate: check if wage for this month already exists
        existing = await db.wages.find_one({
            "employee_id": mgr["username"],
            "payroll_month": month_key,
            "organization_id": org_id
        })
        if existing:
            skipped += 1
            continue
        wage_doc = {
            "wage_id": f"SAL-{mgr['username']}-{month_key}",
            "employee_id": mgr["username"],
            "employee_name": mgr.get("full_name", mgr["username"]),
            "employee_role": "org_admin",
            "role": "org_admin",
            "wage_amount": salary,
            "payment_status": "pending",
            "payroll_month": month_key,
            "organization_id": org_id,
            "tenant_id": mgr.get("tenant_id", current_user.tenant_id),
            "booking_id": f"SALARY-{month_key}",
            "date": now.isoformat(),
            "created_at": now.isoformat()
        }
        await db.wages.insert_one(wage_doc)
        generated += 1

    return {
        "message": f"Payroll generated: {generated} manager(s). Skipped: {skipped} (already exists or no salary set).",
        "generated": generated,
        "skipped": skipped
    }

@api_router.post("/auth/register-mechanic")
async def register_mechanic(mechanic_data: MechanicRegister):
    """Public endpoint for freelance mechanic self-registration — requires Super Admin approval."""
    existing = await db.users.find_one({"email": mechanic_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    username = mechanic_data.email.split('@')[0] + str(random.randint(1000, 9999))

    # NO password at registration — credentials generated only on admin approval
    user_data = {
        "username": username,
        "full_name": mechanic_data.full_name,
        "role": "mechanic",
        "email": mechanic_data.email,
        "phone": mechanic_data.phone,
        "password_hash": None,
        "organization_id": None,  # Global contractor — no tenant
        "skills": mechanic_data.skills,
        "hourly_rate": mechanic_data.hourly_rate,
        "lat": mechanic_data.latitude,
        "lng": mechanic_data.longitude,
        "must_change_password": True,
        "status": "Pending",  # Requires Super Admin approval before first login
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_data)
    return {
        "message": f"Application submitted! Your username is '{username}'. Your account is pending admin approval.",
        "username": username
    }

# ============ SUSPENSION & SUPPORT TICKETING ============

@api_router.put("/admin/users/{username}/suspend")
async def suspend_user(username: str, body: SuspendUserRequest, current_user: UserResponse = Depends(get_current_user)):
    """Super Admin: suspend user with a mandatory reason."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can suspend users")
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot suspend yourself")
    if not body.suspension_reason.strip():
        raise HTTPException(status_code=400, detail="A suspension reason is required")
    result = await db.users.update_one(
        {"username": username},
        {"$set": {"status": "Suspended", "suspension_reason": body.suspension_reason.strip()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User '{username}' suspended"}

@api_router.post("/support/guest-inquiry")
async def create_guest_inquiry(inquiry: SupportGuestInquiryCreate):
    """Public (no auth) — prospective users send inquiry to super admin."""
    if not inquiry.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    now = datetime.now(timezone.utc).isoformat()
    guest_username = f"guest_{inquiry.email}"

    message_doc = {
        "sender": "user",
        "text": inquiry.message.strip(),
        "timestamp": now
    }
    
    await db.support_tickets.update_one(
        {"username": guest_username},
        {
            "$push": {"messages": message_doc},
            "$set": {
                "status": "open", 
                "updated_at": now,
                "role": "guest",
                "name": inquiry.name,
                "email": inquiry.email
            },
            "$setOnInsert": {
                "username": guest_username, 
                "created_at": now
            }
        },
        upsert=True
    )
    print(f"[SUPPORT] Guest inquiry saved for '{inquiry.email}': {inquiry.message.strip()[:60]}")
    return {"message": "Inquiry sent successfully. An admin will contact you soon."}

@api_router.post("/support/tickets")
async def create_support_message(msg: SupportMessageCreate):
    """Public (no auth) — suspended user sends appeal message."""
    if not msg.message_text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    now = datetime.now(timezone.utc).isoformat()
    message_doc = {
        "sender": "user",
        "text": msg.message_text.strip(),
        "timestamp": now
    }
    # Use $set for status so it's always present (not just on first insert)
    await db.support_tickets.update_one(
        {"username": msg.username},
        {
            "$push": {"messages": message_doc},
            "$set": {"status": "open", "updated_at": now},
            "$setOnInsert": {"username": msg.username, "created_at": now}
        },
        upsert=True
    )
    print(f"[SUPPORT] Message saved for '{msg.username}': {msg.message_text.strip()[:60]}")
    return {"message": "Message sent"}

@api_router.get("/support/tickets/{username}/public")
async def get_ticket_public(username: str):
    """
    Public (no auth) — suspended users poll their own thread for admin replies.
    Only returns the messages array and status — no admin-sensitive info.
    """
    ticket = await db.support_tickets.find_one({"username": username}, {"_id": 0})
    if not ticket:
        return {"username": username, "messages": [], "status": "none"}
    return {
        "username": ticket["username"],
        "messages": ticket.get("messages", []),
        "status": ticket.get("status", "open"),
    }

@api_router.get("/support/tickets/status/{username}")
async def get_ticket_status(username: str):
    """
    Public (no auth) — check if a suspended user already has an open appeal.
    Called by the LoginPage immediately after a 403 Suspended error so the UI
    can show 'appeal submitted' or 'write your appeal' without a token.
    """
    ticket = await db.support_tickets.find_one({"username": username}, {"_id": 0})
    if not ticket or not ticket.get("messages"):
        return {"has_open_ticket": False, "message_count": 0}
    return {
        "has_open_ticket": True,
        "status": ticket.get("status", "open"),
        "message_count": len(ticket.get("messages", [])),
        "last_updated": ticket.get("updated_at") or ticket.get("created_at"),
    }

@api_router.get("/support/tickets")
async def get_all_tickets(current_user: UserResponse = Depends(get_current_user)):
    """Super Admin only — list all open support tickets."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    tickets = await db.support_tickets.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return tickets

@api_router.get("/support/tickets/{username}")
async def get_ticket_thread(username: str, current_user: UserResponse = Depends(get_current_user)):
    """Get the support ticket thread for a user (super_admin or the user themselves)."""
    if current_user.role != "super_admin" and current_user.username != username:
        raise HTTPException(status_code=403, detail="Not authorized")
    ticket = await db.support_tickets.find_one({"username": username}, {"_id": 0})
    return ticket or {"username": username, "messages": [], "status": "none"}

@api_router.post("/support/tickets/{username}/reply")
async def reply_to_ticket(username: str, reply: SupportReplyCreate, current_user: UserResponse = Depends(get_current_user)):
    """Super Admin: reply to a user's support ticket."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can reply")
    message_doc = {
        "sender": "admin",
        "text": reply.message_text.strip(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.support_tickets.update_one(
        {"username": username},
        {"$push": {"messages": message_doc}, "$set": {"status": "open"}},
        upsert=True
    )
    return {"message": "Reply sent"}

# ============ ADMIN SUPPORT TICKET ALIASES ============
# These mirror the /support/tickets routes under /admin/ so the
# Super Admin dashboard can use a predictable admin-namespaced URL.

@api_router.get("/admin/support/tickets")
async def admin_get_all_tickets(current_user: UserResponse = Depends(get_current_user)):
    """Super Admin only — list all support tickets, joined with full user details."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    pipeline = [
        # Join users collection to get name, email, suspension_reason
        {
            "$lookup": {
                "from": "users",
                "localField": "username",
                "foreignField": "username",
                "as": "user_docs"
            }
        },
        # Flatten the joined array (first element)
        {
            "$addFields": {
                "user_info": {
                    "$cond": {
                        "if": {"$gt": [{"$size": "$user_docs"}, 0]},
                        "then": {
                            "full_name":        {"$arrayElemAt": ["$user_docs.full_name", 0]},
                            "email":            {"$arrayElemAt": ["$user_docs.email", 0]},
                            "role":             {"$arrayElemAt": ["$user_docs.role", 0]},
                            "status":           {"$arrayElemAt": ["$user_docs.status", 0]},
                            "suspension_reason": {"$arrayElemAt": ["$user_docs.suspension_reason", 0]}
                        },
                        "else": {}
                    }
                }
            }
        },
        # Drop the raw joined array and mongo _id
        {"$unset": ["user_docs", "_id"]},
        # Newest first
        {"$sort": {"created_at": -1}},
        {"$limit": 200}
    ]

    tickets = await db.support_tickets.aggregate(pipeline).to_list(200)
    return tickets

@api_router.put("/admin/support/tickets/{username}/reply")
async def admin_reply_to_ticket(username: str, reply: SupportReplyCreate, current_user: UserResponse = Depends(get_current_user)):
    """Super Admin: reply to appeal ticket (alias under /admin/ namespace)."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can reply")
    message_doc = {
        "sender": "admin",
        "text": reply.message_text.strip(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.support_tickets.update_one(
        {"username": username},
        {"$push": {"messages": message_doc}, "$set": {"status": "open"}},
        upsert=True
    )
    return {"message": "Reply sent"}

@api_router.post("/admin/inquiries/{username}/reply")
async def admin_reply_to_inquiry(username: str, reply: InquiryReplyCreate, current_user: UserResponse = Depends(get_current_user)):
    """Super Admin: reply to a guest inquiry and trigger an email."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can reply")
        
    ticket = await db.support_tickets.find_one({"username": username})
    if not ticket:
        raise HTTPException(status_code=404, detail="Inquiry not found")
        
    now = datetime.now(timezone.utc).isoformat()
    message_doc = {
        "sender": "admin",
        "text": reply.message.strip(),
        "timestamp": now
    }
    
    await db.support_tickets.update_one(
        {"username": username},
        {
            "$push": {"messages": message_doc},
            "$set": {"status": "replied", "updated_at": now}
        }
    )
    
    guest_email = ticket.get("email")
    if guest_email:
        send_reply_email(guest_email, reply.message.strip())
        
    return {"message": "Reply sent and emailed"}

@api_router.post("/admin/organizations")
async def create_organization(org: OrganizationCreate, current_user: UserResponse = Depends(get_current_user)):
    """Super Admin: create a new tenant organization + provision Owner account + email credentials."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can create orgs")

    org_dict = org.model_dump()
    print(f"PAYLOAD RECEIVED: {org_dict}")

    # --- Check if owner email already exists ---
    existing_owner = await db.users.find_one({"email": org.owner_email})
    if existing_owner:
        raise HTTPException(status_code=400, detail=f"A user with email {org.owner_email} already exists")

    new_org_id = generate_id("ORG")
    now = datetime.now(timezone.utc).isoformat()

    # --- 1. Create Organization document ---
    org_doc = {
        "organization_id": new_org_id,
        "name": org.company_name,
        "contact_email": org.contact_email,
        "phone": org.phone,
        "created_at": now
    }
    await db.organizations.insert_one(org_doc)
    org_doc.pop("_id", None)

    # --- 2. Create Owner user with temp password ---
    temp_password = secrets.token_urlsafe(10)  # e.g. "aB3dE_fG7h"
    owner_username = org.owner_email.split('@')[0] + str(random.randint(100, 999))
    owner_doc = {
        "username": owner_username,
        "full_name": org.owner_name,
        "role": "owner",
        "email": org.owner_email,
        "phone": org.phone,
        "password_hash": hash_password(temp_password),
        "organization_id": new_org_id,
        "must_change_password": True,
        "status": "Active",
        "created_at": now
    }
    await db.users.insert_one(owner_doc)
    print(f"[ORG] Created owner '{owner_username}' for org '{new_org_id}' with temp password")

    # --- 3. Try to send welcome email; if it fails, include password in response ---
    email_sent = False
    try:
        send_welcome_email(
            to_email=org.owner_email,
            owner_name=org.owner_name,
            company_name=org.company_name,
            username=owner_username,
            temp_password=temp_password
        )
        email_sent = True
    except Exception as e:
        print(f"[ORG] WARNING: Welcome email failed for {org.owner_email}: {e}")
        print(f"[ORG] FALLBACK: temp_password will be included in API response")

    response = {
        **org_doc,
        "owner_username": owner_username,
        "owner_email": org.owner_email,
        "email_sent": email_sent,
        "message": f"Organization created. Login credentials {'emailed to' if email_sent else 'shown below for'} {org.owner_email}"
    }
    # If email failed, include the temp password so Super Admin can relay it manually
    if not email_sent:
        response["temp_password"] = temp_password
    return response

@api_router.get("/admin/organizations")
async def admin_get_organizations(current_user: UserResponse = Depends(get_current_user)):
    """Super Admin: list all tenant organizations."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can view orgs")
    orgs = await db.organizations.find({}, {"_id": 0}).to_list(1000)
    return orgs

@api_router.delete("/admin/organizations/{org_id}")
async def cascade_delete_organization(org_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Super Admin: CASCADE DELETE an organization and ALL its associated data."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can delete organizations")

    # Verify org exists
    org = await db.organizations.find_one({"organization_id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")

    org_name = org.get("name", org_id)
    print(f"\n{'='*60}")
    print(f"[CASCADE DELETE] Starting for org '{org_name}' ({org_id})")

    # --- Cascade delete all tenant data ---
    del_users = await db.users.delete_many({"organization_id": org_id})
    del_machinery = await db.machinery.delete_many({"organization_id": org_id})
    del_bookings = await db.bookings.delete_many({"organization_id": org_id})
    del_maintenance = await db.maintenance.delete_many({"organization_id": org_id})
    del_employees = await db.employees.delete_many({"organization_id": org_id})
    del_fieldlogs = await db.field_logs.delete_many({"organization_id": org_id})
    del_invoices = await db.invoices.delete_many({"organization_id": org_id})
    del_payments = await db.payments.delete_many({"organization_id": org_id})
    del_wages = await db.wages.delete_many({"organization_id": org_id})
    del_spareparts = await db.spare_parts.delete_many({"organization_id": org_id})
    del_org = await db.organizations.delete_one({"organization_id": org_id})

    summary = {
        "organization": del_org.deleted_count,
        "users": del_users.deleted_count,
        "machinery": del_machinery.deleted_count,
        "bookings": del_bookings.deleted_count,
        "maintenance": del_maintenance.deleted_count,
        "employees": del_employees.deleted_count,
        "field_logs": del_fieldlogs.deleted_count,
        "invoices": del_invoices.deleted_count,
        "payments": del_payments.deleted_count,
        "wages": del_wages.deleted_count,
        "spare_parts": del_spareparts.deleted_count,
    }
    total_deleted = sum(summary.values())
    print(f"[CASCADE DELETE] Complete. {total_deleted} documents removed: {summary}")
    print(f"{'='*60}\n")

    return {
        "message": f"Organization '{org_name}' and all associated data permanently deleted",
        "deleted_counts": summary,
        "total_deleted": total_deleted
    }

@api_router.post("/owner/managers")
async def create_manager(manager: ManagerCreate, current_user: UserResponse = Depends(get_current_user)):
    """Owner: create an org_admin for their tenant + email credentials."""
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only Owners can create managers")
        
    existing_user = await db.users.find_one({"$or": [{"username": manager.email}, {"email": manager.email}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Auto-generate secure temp password (owner never sets it manually)
    raw_password = secrets.token_urlsafe(10)
    manager_username = manager.email

    manager_doc = {
        "username": manager_username,
        "full_name": manager.full_name,
        "role": "org_admin",
        "email": manager.email,
        "phone": manager.phone,
        "password_hash": hash_password(raw_password),
        "organization_id": current_user.organization_id,
        "monthly_salary": manager.monthly_salary or 0.0,
        "must_change_password": True,
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(manager_doc)

    # Get company name for the email
    org = await db.organizations.find_one({"organization_id": current_user.organization_id})
    company_name = org.get("name", "Your Organization") if org else "Your Organization"

    # Try to send welcome email
    email_sent = False
    try:
        send_welcome_email(
            to_email=manager.email,
            owner_name=manager.full_name,
            company_name=company_name,
            username=manager_username,
            temp_password=raw_password,
            role_title="Manager (Org Admin)"
        )
        email_sent = True
    except Exception as e:
        print(f"[MANAGER] WARNING: Welcome email failed for {manager.email}: {e}")

    manager_doc.pop("_id", None)
    manager_doc.pop("password_hash", None)

    response = {
        **manager_doc,
        "email_sent": email_sent,
        "message": f"Manager created. Credentials {'emailed to' if email_sent else 'shown below for'} {manager.email}"
    }
    if not email_sent:
        response["temp_password"] = raw_password
    return response

@api_router.delete("/owner/managers/{username}")
async def delete_manager(username: str, current_user: UserResponse = Depends(get_current_user)):
    """Owner: delete a manager (org_admin) from their tenant."""
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only Owners can delete managers")
    # Verify the manager belongs to the owner's tenant
    manager = await db.users.find_one({"username": username, "role": "org_admin", "organization_id": current_user.organization_id})
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found in your organization")
    await db.users.delete_one({"username": username})
    return {"message": f"Manager '{manager.get('full_name', username)}' deleted successfully"}

# ============ MACHINERY ROUTES (Public + Protected) ============

@api_router.get("/public/machinery", response_model=List[Machinery])
async def get_public_machinery():
    """Public endpoint to browse machinery fleet"""
    machinery = await db.machinery.find({"status": {"$in": ["Available", "Booked"]}}, {"_id": 0}).to_list(1000)
    
    # Inject company name
    for machine in machinery:
        if machine.get("organization_id") and machine["organization_id"] != "default_org":
            org = await db.organizations.find_one({"organization_id": machine["organization_id"]})
            if org:
                machine["company_name"] = org.get("name")
                
    return machinery

@api_router.post("/public/check-availability")
async def check_availability(check: AvailabilityCheck):
    """Public endpoint to check machinery availability"""
    machinery = await db.machinery.find_one({"machinery_id": check.machinery_id}, {"_id": 0})
    if not machinery:
        raise HTTPException(status_code=404, detail="Machinery not found")
    
    # Check if in maintenance
    if machinery["status"] == "Under Maintenance":
        return {"available": False, "reason": "Under maintenance"}
    
    # Check for existing bookings on that date
    target_date = datetime.fromisoformat(check.date).date()
    bookings = await db.bookings.find({
        "machinery_id": check.machinery_id,
        "status": {"$in": ["Confirmed", "Pending"]}
    }, {"_id": 0}).to_list(1000)
    
    for booking in bookings:
        booking_date = datetime.fromisoformat(booking["booking_date"]).date()
        if booking_date == target_date:
            return {"available": False, "reason": "Already booked on this date"}
    
    return {"available": True, "reason": "Available"}

@api_router.get("/machinery", response_model=List[Machinery])
async def get_machinery(
    lat: Optional[float] = None, 
    lon: Optional[float] = None, 
    radius: float = 50000,
    current_user: UserResponse = Depends(get_current_user)
):
    query = {}
    
    # 1. Tenant Roles (Walled Garden)
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
        
    # 2. Global Roles (Geospatial)
    elif current_user.role in ["farmer", "mechanic", "operator"]:
        # If location provided, use $near
        if lat is not None and lon is not None:
             query["location"] = {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat]
                    },
                    "$maxDistance": radius
                }
            }
        else:
            # Fallback: Show only "Available" machinery globally if no location
             query["status"] = "Available"
        
    # 3. Super Admin (Global View - Optional, or restricted)
    elif current_user.role == "super_admin":
        pass # Can see all
        
    else:
        return []

    machinery = await db.machinery.find(query, {"_id": 0}).to_list(1000)
    
    # Inject company name and rating
    for machine in machinery:
        if machine.get("organization_id") and machine["organization_id"] != "default_org":
            org = await db.organizations.find_one({"organization_id": machine["organization_id"]})
            if org:
                machine["company_name"] = org.get("name")
            
            # Calculate company average rating
            pipeline = [
                {"$match": {"organization_id": machine["organization_id"], "status": "Completed", "rating": {"$exists": True, "$ne": None}}},
                {"$group": {
                    "_id": None,
                    "avg_rating": {"$avg": "$rating"}
                }}
            ]
            rating_agg = await db.bookings.aggregate(pipeline).to_list(1)
            if rating_agg:
                machine["company_rating"] = round(rating_agg[0]["avg_rating"], 1)
            else:
                machine["company_rating"] = None

    return machinery

@api_router.post("/machinery", response_model=Machinery)
async def create_machinery(machinery: MachineryCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    machinery_data = machinery.model_dump(exclude={"latitude", "longitude"})
    machinery_data["machinery_id"] = generate_id("MCH")
    machinery_data["status"] = "Available"
    machinery_data["total_usage_hours"] = 0.0
    machinery_data["created_at"] = datetime.now(timezone.utc).isoformat()
    machinery_data["organization_id"] = current_user.organization_id

    # Build GeoJSON location from lat/lng if provided
    if machinery.latitude is not None and machinery.longitude is not None:
        machinery_data["location"] = {
            "type": "Point",
            "coordinates": [machinery.longitude, machinery.latitude]
        }
    
    await db.machinery.insert_one(machinery_data)
    return Machinery(**machinery_data)

@api_router.put("/machinery/{machinery_id}", response_model=Machinery)
async def update_machinery(machinery_id: str, machinery: MachineryUpdate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    machinery_data = machinery.model_dump(exclude_none=True)
    
    # STRICT UPDATES
    result = await db.machinery.find_one_and_update(
        {"machinery_id": machinery_id, "organization_id": current_user.organization_id},
        {"$set": machinery_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Machinery not found or access denied")
    result.pop("_id", None)
    return Machinery(**result)

@api_router.delete("/machinery/{machinery_id}")
async def delete_machinery(machinery_id: str, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # STRICT DELETES
    result = await db.machinery.delete_one({"machinery_id": machinery_id, "organization_id": current_user.organization_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Machinery not found or access denied")
    return {"message": "Machinery deleted successfully"}

@api_router.post("/machinery/{machinery_id}/report-breakdown")
async def report_breakdown(machinery_id: str, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["operator", "org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to report breakdown")
    
    machinery = await db.machinery.find_one({"machinery_id": machinery_id}, {"_id": 0})
    if not machinery:
        raise HTTPException(status_code=404, detail="Machinery not found")
    
    # DUPLICATE BREAKDOWN GUARD: Check for existing unresolved maintenance record
    existing_breakdown = await db.maintenance.find_one({
        "machinery_id": machinery_id,
        "status": {"$in": ["pending_assignment", "assigned", "in_progress"]}
    })
    if existing_breakdown:
        raise HTTPException(
            status_code=400,
            detail=f"An unresolved maintenance record ({existing_breakdown['maintenance_id']}) already exists for this machine. Please wait for it to be resolved before reporting a new breakdown."
        )
    
    # Update machinery status
    await db.machinery.update_one(
        {"machinery_id": machinery_id},
        {"$set": {"status": "Under Maintenance"}}
    )
        
    # Pause active bookings
    await db.bookings.update_many(
        {"machinery_id": machinery_id, "status": "Confirmed"},
        {"$set": {"status": "Paused", "notes": "Paused due to machinery breakdown"}}
    )
    
    # AUTO-CREATE MAINTENANCE RECORD
    maintenance_data = {
        "maintenance_id": generate_id("MNT"),
        "machinery_id": machinery_id,
        "service_type": "Breakdown Repair",
        "mechanic_id": "unassigned",
        "status": "pending_assignment",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": machinery.get("organization_id", "default_org"),
        "spare_parts_cost": 0,
        "labor_cost": 0,
        "total_cost": 0,
    }
    await db.maintenance.insert_one(maintenance_data)
        
    return {"message": "Breakdown reported, maintenance record created, active bookings paused", "maintenance_id": maintenance_data["maintenance_id"]}

# ============ EMPLOYEE ROUTES ============

@api_router.get("/employees", response_model=List[Employee])
async def get_employees(current_user: UserResponse = Depends(get_current_user)):
    # Super Admin cannot view tenant employees
    if current_user.role == "super_admin":
        return []

    if current_user.role not in ["admin", "org_admin", "owner", "mechanic"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
        query["role"] = {"$in": ["operator", "org_admin"]}
        
    elif current_user.role == "mechanic":
        query["organization_id"] = current_user.organization_id or "default_org"
        
    users = await db.users.find(query, {"_id": 0}).to_list(1000)
    
    employees = []
    for u in users:
        # Try to get payroll details from employees collection by matching name
        emp_record = await db.employees.find_one({"name": u.get("full_name")}, {"_id": 0})
        employees.append({
            "employee_id": u.get("username"),
            "name": u.get("full_name"),
            "role": u.get("role"),
            "department": emp_record.get("department") if emp_record else ("Management" if u.get("role") == "org_admin" else "Operations"),
            "skill": emp_record.get("skill") if emp_record else "N/A",
            "joining_date": emp_record.get("joining_date") if emp_record else datetime.now(timezone.utc).isoformat(),
            "wage_rate": emp_record.get("wage_rate", 0.0) if emp_record else 0.0,
            "monthly_salary": u.get("monthly_salary", 0.0),
            "hourly_wage": u.get("hourly_wage", 0.0),
            "created_at": emp_record.get("created_at") if emp_record else datetime.now(timezone.utc).isoformat(),
            "organization_id": u.get("organization_id", "default_org")
        })
        
    return employees

@api_router.post("/employees", response_model=Employee)
async def create_employee(employee: EmployeeCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if employee.role == "org_admin":
        raise HTTPException(status_code=403, detail="Managers cannot create other Managers")
    if employee.role != "operator":
        # Force it according to business logic for this frontend panel
        employee.role = "operator"
    
    employee_data = employee.model_dump()
    employee_data["employee_id"] = generate_id("EMP")
    employee_data["created_at"] = datetime.now(timezone.utc).isoformat()
    employee_data["organization_id"] = current_user.organization_id
    
    await db.employees.insert_one(employee_data)
    return Employee(**employee_data)

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, employee: EmployeeCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee_data = employee.model_dump()
    
    # STRICT UPDATES: Enforce organization_id filter
    result = await db.employees.find_one_and_update(
        {"employee_id": employee_id, "organization_id": current_user.organization_id},
        {"$set": employee_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Employee not found or access denied")
    result.pop("_id", None)
    return Employee(**result)

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # STRICT DELETES: Enforce organization_id filter
    result = await db.employees.delete_one({"employee_id": employee_id, "organization_id": current_user.organization_id})
    await db.users.delete_one({"username": employee_id, "organization_id": current_user.organization_id})
    
    if result.deleted_count == 0:
        # Check if they just existed in the users collection (e.g., manager)
        user_check = await db.users.find_one({"username": employee_id, "organization_id": current_user.organization_id})
        if not user_check:
            raise HTTPException(status_code=404, detail="Employee not found or access denied")
            
    return {"message": "Employee deleted successfully", "id": str(employee_id)}

# ============ BOOKING ROUTES ============

@api_router.get("/bookings", response_model=List[Booking])
async def get_bookings(current_user: UserResponse = Depends(get_current_user)):
    query = {}
    
    # Super Admin cannot view tenant bookings
    if current_user.role == "super_admin":
        return []

    # Farmers see only their bookings
    if current_user.role == "farmer":
        query["farmer_id"] = current_user.username
    
    # Operators see their assigned bookings
    elif current_user.role == "operator":
        # Build $or query to match operator_id as either employee_id or username
        or_conditions = [{"operator_id": current_user.username}]
        employee = await db.employees.find_one({"name": current_user.full_name}, {"_id": 0})
        if employee:
            or_conditions.append({"operator_id": employee["employee_id"]})
        query["$or"] = or_conditions

    # Org Admins and Owners see only their organization's bookings
    elif current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
        
    else:
        # FAIL-SAFE: If role is unknown or not handled, return nothing
        return []
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with details
    # ... (Rest of enrichment logic is fine, but efficiency could be improved with checks)
    for booking in bookings:
        user = await db.users.find_one({"username": booking["farmer_id"]}, {"_id": 0})
        if user:
            booking["farmer_name"] = user["full_name"]
        
        machinery = await db.machinery.find_one({"machinery_id": booking["machinery_id"]}, {"_id": 0})
        if machinery:
            booking["machine_type"] = machinery["machine_type"]
            booking["machine_status"] = machinery["status"]  # Expose status for frontend breakdown guard
        
        if booking.get("operator_id"):
            operator = await db.employees.find_one({"employee_id": booking["operator_id"]}, {"_id": 0})
            if operator:
                booking["operator_name"] = operator["name"]
            else:
                # Fallback: operator_id might be a username from the users collection
                op_user = await db.users.find_one({"username": booking["operator_id"]}, {"_id": 0})
                if op_user:
                    booking["operator_name"] = op_user.get("full_name", "Unknown Operator")
                else:
                    booking["operator_name"] = "Unknown Operator"
    
    return bookings

@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking: BookingCreate, current_user: UserResponse = Depends(get_current_user)):
    # ... (Create logic is fine, relies on machinery's org)
    # Check machinery availability
    machinery = await db.machinery.find_one({"machinery_id": booking.machinery_id}, {"_id": 0})
    if not machinery:
        raise HTTPException(status_code=404, detail="Machinery not found")
    
    if machinery["status"] == "Under Maintenance":
        raise HTTPException(status_code=400, detail="Machinery is under maintenance")
    
    # Check for existing bookings on the same date
    target_date = datetime.fromisoformat(booking.booking_date).date()
    # OPTIMIZATION: Check status in query too
    existing_bookings = await db.bookings.find({
        "machinery_id": booking.machinery_id,
        "status": {"$in": ["Confirmed", "Pending"]}
    }, {"_id": 0}).to_list(1000)
    
    for existing in existing_bookings:
        existing_date = datetime.fromisoformat(existing["booking_date"]).date()
        if existing_date == target_date:
            raise HTTPException(status_code=400, detail="Machinery already booked on this date")

    # Check operator availability if assigned
    if booking.operator_id:
        operator = await db.employees.find_one({"employee_id": booking.operator_id}, {"_id": 0})
        if not operator:
             raise HTTPException(status_code=404, detail="Operator not found")
        
        # Check if operator is already booked on this date
        operator_bookings = await db.bookings.find({
            "operator_id": booking.operator_id,
            "status": {"$in": ["Confirmed", "Pending"]}
        }, {"_id": 0}).to_list(1000)
        
        for op_booking in operator_bookings:
            op_booking_date = datetime.fromisoformat(op_booking["booking_date"]).date()
            if op_booking_date == target_date:
                raise HTTPException(status_code=400, detail=f"Operator {operator['name']} is already assigned to another job on this date")
    
    booking_data = booking.model_dump()
    booking_data["booking_id"] = generate_id("BKG")
    booking_data["farmer_id"] = current_user.username
    booking_data["status"] = "Pending"
    booking_data["approval_status"] = "Pending"
    booking_data["created_at"] = datetime.now(timezone.utc).isoformat()
    # Booking must belong to the machinery's organization
    booking_data["organization_id"] = machinery.get("organization_id", "default_org")
    
    await db.bookings.insert_one(booking_data)
    return Booking(**booking_data)

@api_router.put("/bookings/{booking_id}", response_model=Booking)
async def update_booking(booking_id: str, booking: BookingUpdate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Only admin can update bookings")
    
    booking_data = booking.model_dump(exclude_none=True)
    
    # STRICT: Verify booking belongs to org BEFORE processing logic
    # Actually simpler to just use filters in find_one_and_update, 
    # BUT we have pre-logic checking machinery status etc.
    
    existing = await db.bookings.find_one({"booking_id": booking_id, "organization_id": current_user.organization_id}, {"_id": 0})
    if not existing:
         raise HTTPException(status_code=404, detail="Booking not found or access denied")
    
    # If approving, check machinery availability and REQUIRE operator assignment
    if booking_data.get("approval_status") == "Approved":
        # Check if operator_id is provided in update OR already exists
        if not booking_data.get("operator_id") and not existing.get("operator_id"):
             raise HTTPException(status_code=400, detail="Cannot approve booking without assigning an Operator")
        
        machinery = await db.machinery.find_one({"machinery_id": existing["machinery_id"]}, {"_id": 0})
        if machinery and machinery["status"] == "Under Maintenance":
            raise HTTPException(status_code=400, detail="Machinery is under maintenance")
        
        # Update machinery status to Booked
        await db.machinery.update_one(
            {"machinery_id": existing["machinery_id"]},
            {"$set": {"status": "Booked"}}
        )
        booking_data["status"] = "Confirmed"

    # EMERGENCY REJECT: Allow rejecting from Pending, Confirmed, or Approved states
    if booking_data.get("approval_status") == "Rejected" or booking_data.get("status") == "Rejected":
        current_status = existing.get("status", "")
        # Only block reject for already-completed bookings
        if current_status == "Completed":
            raise HTTPException(status_code=400, detail="Cannot reject a completed booking")
        
        booking_data["status"] = "Rejected"
        booking_data["approval_status"] = "Rejected"
        
        # If the booking was Confirmed/Approved, release the machinery back to Available
        if current_status in ["Confirmed", "Booked"]:
            await db.machinery.update_one(
                {"machinery_id": existing["machinery_id"]},
                {"$set": {"status": "Available"}}
            )
            print(f"[BOOKING] Emergency reject: Released machinery '{existing['machinery_id']}' back to Available")
    
    result = await db.bookings.find_one_and_update(
        {"booking_id": booking_id, "organization_id": current_user.organization_id},
        {"$set": booking_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Booking not found or access denied")
    result.pop("_id", None)
    return Booking(**result)

@api_router.put("/bookings/{booking_id}/rate", response_model=Booking)
async def rate_booking(booking_id: str, update: BookingUpdate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Only farmers can rate bookings")
    
    rating = update.rating
    review = update.review
    
    if rating is None:
        raise HTTPException(status_code=400, detail="Rating is required")
    
    # Force integer cast
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Rating must be a number")
    
    if not (1 <= rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
    existing = await db.bookings.find_one({"booking_id": booking_id, "farmer_id": current_user.username}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Booking not found or access denied")
        
    if existing.get("status") != "Completed":
        raise HTTPException(status_code=400, detail="Only completed bookings can be rated")
        
    result = await db.bookings.find_one_and_update(
        {"booking_id": booking_id, "farmer_id": current_user.username},
        {"$set": {"rating": rating, "review": review or ""}},
        return_document=True
    )
    
    result.pop("_id", None)
    return Booking(**result)

# ============ FIELD LOG ROUTES ============

@api_router.get("/field-logs", response_model=List[FieldLog])
async def get_field_logs(current_user: UserResponse = Depends(get_current_user)):
    query = {}
    
    if current_user.role == "super_admin":
        return []
        
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
        
    elif current_user.role == "operator":
        # Operators see their own logs
        # We need to find the employee_id for this user
        employee = await db.employees.find_one({"name": current_user.full_name}, {"_id": 0})
        if employee:
             query["operator_id"] = employee["employee_id"]
        else:
             return []
    else:
        return []

    logs = await db.field_logs.find(query, {"_id": 0}).to_list(1000)
    return logs

@api_router.post("/field-logs", response_model=FieldLog)
async def create_field_log(log: FieldLogCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["operator", "org_admin"]:
        raise HTTPException(status_code=403, detail="Only operators can log field work")
    
    # Get operator ID
    operator = await db.employees.find_one({"name": current_user.full_name}, {"_id": 0})
    if not operator and current_user.role == "operator":
         # If operator user but no employee record? Should be rare/impossible with valid setup
         # But maybe using username as ID?
         pass 

    # Fetch Booking to get Organization ID
    booking = await db.bookings.find_one({"booking_id": log.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    log_data = log.model_dump()
    log_data["log_id"] = generate_id("LOG")
    log_data["operator_id"] = operator["employee_id"] if operator else "admin"
    log_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    log_data["created_at"] = datetime.now(timezone.utc).isoformat()
    # CORRECT ATTRIBUTION: Log belongs to the Booking's Organization
    log_data["organization_id"] = booking.get("organization_id", "default_org")
    
    # Update booking status to completed
    await db.bookings.update_one(
        {"booking_id": log.booking_id},
        {"$set": {"status": "Completed"}}
    )

    # AUTO-GENERATE INVOICE
    await auto_generate_invoice(log.booking_id, log_data)
    
    # AUTO-GENERATE WAGE for the operator
    if operator and log.actual_hours:
        wage_amount = (operator.get("wage_rate", 0) or 0) * log.actual_hours
        if wage_amount > 0:
            wage_data = {
                "wage_id": generate_id("WAG"),
                "employee_id": operator["employee_id"],
                "booking_id": log.booking_id,
                "wage_amount": wage_amount,
                "payment_status": "pending",
                "paid_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "organization_id": booking.get("organization_id", "default_org"),
            }
            await db.wages.insert_one(wage_data)
    
    # Update machinery usage and status
    machinery = await db.machinery.find_one({"machinery_id": booking["machinery_id"]}, {"_id": 0})
    if machinery:
        hours_to_add = log.actual_hours or 0
        await db.machinery.update_one(
            {"machinery_id": booking["machinery_id"]},
            {
                "$inc": {"total_usage_hours": hours_to_add},
                "$set": {"status": "Available"}
            }
        )
    
    await db.field_logs.insert_one(log_data)
    
    return FieldLog(**log_data)

# ============ INVOICE ROUTES ============

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(current_user: UserResponse = Depends(get_current_user)):
    # Super Admin cannot view invoices
    if current_user.role == "super_admin":
        return []

    query = {}
    
    # Farmers see only their invoices
    if current_user.role == "farmer":
        query["farmer_id"] = current_user.username
    
    # Org Admins and Owners see only their organization's invoices
    elif current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
        
    else:
        return []
    
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with farmer names
    for invoice in invoices:
        user = await db.users.find_one({"username": invoice["farmer_id"]}, {"_id": 0})
        if user:
            invoice["farmer_name"] = user["full_name"]
    
    return invoices

# ============ PAYMENT ROUTES ============

@api_router.get("/payments", response_model=List[Payment])
async def get_payments(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["admin", "owner", "org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
        
    payments = await db.payments.find(query, {"_id": 0}).to_list(1000)
    return payments

@api_router.post("/payments", response_model=Payment)
async def create_payment(payment: PaymentCreate, current_user: UserResponse = Depends(get_current_user)):
    # Update invoice payment status
    invoice = await db.invoices.find_one({"invoice_id": payment.invoice_id}, {"_id": 0})
    if not invoice:
         raise HTTPException(status_code=404, detail="Invoice not found")
         
    # Verify farmer making payment owns the invoice
    if current_user.role == "farmer" and invoice["farmer_id"] != current_user.username:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # OVERPAYMENT GUARD: Check remaining balance before accepting
    existing_payments = await db.payments.find({"invoice_id": payment.invoice_id}, {"_id": 0}).to_list(1000)
    already_paid = sum(p["amount"] for p in existing_payments)
    remaining = invoice["amount"] - already_paid
    
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Invoice is already fully paid")
    if payment.amount > remaining:
        raise HTTPException(status_code=400, detail=f"Payment amount ₹{payment.amount} exceeds remaining balance ₹{remaining:.2f}")
    
    payment_data = payment.model_dump()
    payment_data["payment_id"] = generate_id("PAY")
    payment_data["paid_at"] = datetime.now(timezone.utc).isoformat()
    payment_data["created_at"] = datetime.now(timezone.utc).isoformat()
    # CORRECT ATTRIBUTION: Payment belongs to Invoice's Org
    payment_data["organization_id"] = invoice.get("organization_id", "default_org")
    
    total_paid = already_paid + payment.amount
    
    if total_paid >= invoice["amount"]:
        await db.invoices.update_one(
            {"invoice_id": payment.invoice_id},
            {"$set": {"payment_status": "Paid"}}
        )
    else:
        await db.invoices.update_one(
            {"invoice_id": payment.invoice_id},
            {"$set": {"payment_status": "Partially Paid"}}
        )
    
    await db.payments.insert_one(payment_data)
    return Payment(**payment_data)

# ============ MAINTENANCE ROUTES ============

@api_router.get("/maintenance", response_model=List[MaintenanceRecord])
async def get_maintenance_records(current_user: UserResponse = Depends(get_current_user)):
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
    elif current_user.role == "mechanic":
        # Mechanics ALWAYS filter by their own username so they only see their jobs
        query["mechanic_id"] = current_user.username
    elif current_user.role == "super_admin":
        pass
    else:
        return []

    records = await db.maintenance.find(query, {"_id": 0}).to_list(1000)
    print(f"[GET /maintenance] role={current_user.role}, username={current_user.username}, query={query}, found={len(records)} records")

    for record in records:
        mach = await db.machinery.find_one({"machinery_id": record.get("machinery_id")}, {"_id": 0})
        if mach:
            record["machine_type"] = mach.get("machine_type")

        # Resolve mechanic name from USERS collection (not employees)
        mech_username = record.get("mechanic_id")
        if mech_username and mech_username not in ("unassigned", None, ""):
            mech_user = await db.users.find_one({"username": mech_username}, {"_id": 0})
            if mech_user:
                record["mechanic_name"] = mech_user.get("full_name") or mech_username

    return records

@api_router.post("/maintenance", response_model=MaintenanceRecord)
async def create_maintenance(maintenance: MaintenanceCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check machinery to get Org ID
    machinery = await db.machinery.find_one({"machinery_id": maintenance.machinery_id})
    if not machinery:
        raise HTTPException(status_code=404, detail="Machinery not found")

    maintenance_data = maintenance.model_dump()
    maintenance_data["maintenance_id"] = generate_id("MNT")
    maintenance_data["started_at"] = datetime.now(timezone.utc).isoformat()
    maintenance_data["created_at"] = datetime.now(timezone.utc).isoformat()
    # CORRECT ATTRIBUTION: Inherit from machinery
    maintenance_data["organization_id"] = machinery.get("organization_id", "default_org")

    # Set initial status based on whether a mechanic was pre-assigned
    mechanic_id = maintenance_data.get("mechanic_id", "")
    if mechanic_id and mechanic_id not in ("", "none"):
        maintenance_data["status"] = "pending_acceptance"   # mechanic must accept first
        # Validate mechanic exists
        mech_user = await db.users.find_one({"username": mechanic_id, "role": "mechanic"}, {"_id": 0})
        if mech_user:
            maintenance_data["mechanic_name"] = mech_user.get("full_name")
    else:
        maintenance_data["status"] = "pending_assignment"   # no mechanic yet
        maintenance_data["mechanic_id"] = "unassigned"
    
    # Strictly ensure status is never None when saving
    if not maintenance_data.get("status"):
        maintenance_data["status"] = "pending_assignment"
    
    # Mark machinery as under maintenance
    await db.machinery.update_one(
        {"machinery_id": maintenance.machinery_id},
        {"$set": {"status": "Under Maintenance"}}
    )
    
    await db.maintenance.insert_one(maintenance_data)
    return MaintenanceRecord(**maintenance_data)

@api_router.put("/maintenance/{maintenance_id}", response_model=MaintenanceRecord)
async def update_maintenance(maintenance_id: str, maintenance: MaintenanceUpdate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["mechanic", "org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = maintenance.model_dump(exclude_none=True)
    
    # STRICT FILTER: Org Admin can update own org's. Mechanic must be assigned (or in org).
    filter_query = {"maintenance_id": maintenance_id}
    if current_user.role == "org_admin":
        filter_query["organization_id"] = current_user.organization_id
    elif current_user.role == "mechanic":
        # Mechanic can update if assigned OR if in same org
        # Simpler to just allow if they can see it?
        # Let's enforce mechanic_id if global, or org_id if tenant
        if current_user.organization_id != "default_org":
             filter_query["organization_id"] = current_user.organization_id
        else:
             pass # Global mechanic? Ideally filter by mechanic_id but sometimes they help others?
             # For strictness:
             # filter_query["mechanic_id"] = current_user.employee_id 
             pass 

    existing = await db.maintenance.find_one(filter_query)
    if not existing:
         raise HTTPException(status_code=404, detail="Maintenance record not found or access denied")

    # If calculating totals
    if "spare_parts_cost" in update_data or "labor_cost" in update_data:
        parts = update_data.get("spare_parts_cost", existing.get("spare_parts_cost", 0))
        labor = update_data.get("labor_cost", existing.get("labor_cost", 0))
        update_data["total_cost"] = parts + labor
            
    # If completing, update machinery status
    if update_data.get("completed_at"):
         await db.machinery.update_one(
            {"machinery_id": existing["machinery_id"]},
            {"$set": {"status": "Available"}}
        )
            
    result = await db.maintenance.find_one_and_update(
        filter_query,
        {"$set": update_data},
        return_document=True
    )
    
    result.pop("_id", None)
    return MaintenanceRecord(**result)

@api_router.put("/maintenance/{maintenance_id}/accept")
async def accept_maintenance_job(maintenance_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Mechanic accepts a pending_acceptance job — moves it to in_progress."""
    if current_user.role != "mechanic":
        raise HTTPException(status_code=403, detail="Only mechanics can accept jobs")

    record = await db.maintenance.find_one({
        "maintenance_id": maintenance_id,
        "mechanic_id": current_user.username,
        "status": "pending_acceptance"
    })
    if not record:
        raise HTTPException(status_code=404, detail="Job not found or not awaiting your acceptance")

    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id},
        {"$set": {"status": "in_progress", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Job accepted, status set to in_progress"}

@api_router.put("/maintenance/{maintenance_id}/reject")
async def reject_maintenance_job(maintenance_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Mechanic rejects a pending_acceptance job — returns it to the pending_assignment pool."""
    if current_user.role != "mechanic":
        raise HTTPException(status_code=403, detail="Only mechanics can reject jobs")

    record = await db.maintenance.find_one({
        "maintenance_id": maintenance_id,
        "mechanic_id": current_user.username,
        "status": "pending_acceptance"
    })
    if not record:
        raise HTTPException(status_code=404, detail="Job not found or not awaiting your acceptance")

    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id},
        {"$set": {"mechanic_id": "unassigned", "status": "pending_assignment", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Job rejected, returned to pending pool"}

@api_router.put("/bookings/{booking_id}/reassign")
async def reassign_booking(booking_id: str, reassign: BookingReassign, current_user: UserResponse = Depends(get_current_user)):
    """Reassign a Paused booking to new machinery + operator."""
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Only Org Admin can reassign bookings")
    
    booking = await db.bookings.find_one({
        "booking_id": booking_id,
        "organization_id": current_user.organization_id,
        "status": "Paused"
    })
    if not booking:
        raise HTTPException(status_code=404, detail="Paused booking not found or access denied")
    
    # Validate new machinery is available
    new_machinery = await db.machinery.find_one({"machinery_id": reassign.machinery_id}, {"_id": 0})
    if not new_machinery:
        raise HTTPException(status_code=404, detail="New machinery not found")
    if new_machinery["status"] != "Available":
        raise HTTPException(status_code=400, detail=f"Machinery is {new_machinery['status']}, not Available")
    
    # Validate new operator exists
    operator = await db.employees.find_one({"employee_id": reassign.operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Perform reassignment
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "machinery_id": reassign.machinery_id,
            "operator_id": reassign.operator_id,
            "status": "Confirmed",
            "notes": f"Reassigned from {booking['machinery_id']}"
        }}
    )
    
    # Mark new machinery as booked
    await db.machinery.update_one(
        {"machinery_id": reassign.machinery_id},
        {"$set": {"status": "Booked"}}
    )
    
    return {"message": "Booking reassigned successfully"}
    
    
# ============ MATERIAL REQUESTS ROUTES ============

@api_router.post("/maintenance/material-requests", response_model=MaterialRequest)
async def create_material_request(request: MaterialRequestCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["mechanic", "org_admin"]:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get Maintenance to get Org ID
    mnt = await db.maintenance.find_one({"maintenance_id": request.maintenance_id})
    if not mnt:
         raise HTTPException(status_code=404, detail="Maintenance record not found")

    req_data = request.model_dump()
    req_data["request_id"] = generate_id("MAT")
    req_data["mechanic_id"] = current_user.username 
    req_data["status"] = "Pending"
    req_data["created_at"] = datetime.now(timezone.utc).isoformat()
    # CORRECT ATTRIBUTION: Inherit from Maintenance
    req_data["organization_id"] = mnt.get("organization_id", "default_org")
    req_data["mechanic_name"] = current_user.full_name
    
    await db.material_requests.insert_one(req_data)
    return MaterialRequest(**req_data)

@api_router.get("/maintenance/material-requests", response_model=List[MaterialRequest])
async def get_material_requests(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role == "super_admin":
        return []
        
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
    elif current_user.role == "mechanic":
        if current_user.organization_id != "default_org":
             query["organization_id"] = current_user.organization_id
        else:
             query["mechanic_id"] = current_user.username
        
    requests = await db.material_requests.find(query, {"_id": 0}).to_list(1000)
    return requests

@api_router.put("/maintenance/material-requests/{request_id}", response_model=MaterialRequest)
async def update_material_request(request_id: str, update: MaterialRequestUpdate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Only Org Admin can approve requests")
        
    result = await db.material_requests.find_one_and_update(
        {"request_id": request_id, "organization_id": current_user.organization_id},
        {"$set": update.model_dump(exclude_none=True)},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Request not found or access denied")
    result.pop("_id", None)
    return MaterialRequest(**result)

# ============ WAGE ROUTES ============

@api_router.get("/wages", response_model=List[WageRecord])
async def get_wages(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["admin", "owner", "org_admin", "mechanic"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
    elif current_user.role == "mechanic":
        query["employee_id"] = current_user.username

    wages = await db.wages.find(query, {"_id": 0}).to_list(1000)
    
    for wage in wages:
        employee = await db.employees.find_one({"employee_id": wage["employee_id"]}, {"_id": 0})
        if employee:
            wage["employee_name"] = employee["name"]
        else:
            user = await db.users.find_one({"username": wage["employee_id"]}, {"_id": 0})
            if user:
                wage["employee_name"] = user.get("full_name")
    
    return wages

@api_router.post("/wages", response_model=WageRecord)
async def create_wage(wage: WageCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    wage_data = wage.model_dump()
    wage_data["wage_id"] = generate_id("WAG")
    wage_data["payment_status"] = "pending"
    wage_data["paid_at"] = None
    wage_data["created_at"] = datetime.now(timezone.utc).isoformat()
    wage_data["organization_id"] = current_user.organization_id
    
    await db.wages.insert_one(wage_data)
    return WageRecord(**wage_data)

@api_router.put("/org/pay-operator/{wage_id}")
async def pay_operator(wage_id: str, current_user: UserResponse = Depends(get_current_user)):
    """
    Mark a SINGLE operator wage record as paid, looked up by its unique wage_id.
    Returns 400 if already paid, 404 if not found or access denied.
    """
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Look up the specific wage record
    wage_record = await db.wages.find_one({"wage_id": wage_id}, {"_id": 0})
    if not wage_record:
        raise HTTPException(status_code=404, detail="Wage record not found")

    if wage_record.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied — wage does not belong to your organisation")

    # Guard: already paid?
    if wage_record.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="This wage has already been paid")

    paid_at = datetime.now(timezone.utc).isoformat()
    await db.wages.update_one(
        {"wage_id": wage_id},
        {"$set": {"payment_status": "paid", "paid_at": paid_at}}
    )
    print(f"[PAY OPERATOR] Wage {wage_id} marked paid for booking {wage_record.get('booking_id')}")
    return {
        "message": f"Wage {wage_id} marked as paid",
        "wage_id": wage_id,
        "paid_at": paid_at
    }

@api_router.put("/org/pay-mechanic/{wage_id}")
async def pay_mechanic(wage_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Mark a mechanic's wage record as paid strictly by its wage_id."""
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # 1. Strictly query by wage_id and tenant
    wage_record = await db.wages.find_one(
        {"wage_id": wage_id, "organization_id": current_user.organization_id}, {"_id": 0}
    )
    if not wage_record:
        raise HTTPException(status_code=404, detail="Wage record not found or access denied")
    
    if wage_record.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="This mechanic wage has already been paid")
    
    paid_at = datetime.now(timezone.utc).isoformat()
    
    # 2. Update the Wage Document exclusively
    await db.wages.update_one(
        {"wage_id": wage_id},
        {"$set": {"payment_status": "paid", "paid_at": paid_at}}
    )
    
    return {
        "message": f"Mechanic wage {wage_id} marked as paid",
        "wage_id": wage_id,
        "paid_at": paid_at
    }

# ============ MAINTENANCE ASSIGN ENDPOINT ============

@api_router.put("/maintenance/{maintenance_id}/assign")
async def assign_mechanic(maintenance_id: str, body: MaintenanceAssign, current_user: UserResponse = Depends(get_current_user)):
    """Org Admin assigns a mechanic (by username) to a pending_assignment maintenance job."""
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Only Org Admin can assign mechanics")
    
    record = await db.maintenance.find_one(
        {"maintenance_id": maintenance_id, "organization_id": current_user.organization_id}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found or access denied")
    
    if record.get("status") not in ["pending_assignment", "pending", None]:
        raise HTTPException(status_code=400, detail=f"Cannot assign mechanic to a job with status '{record.get('status')}'. Only pending_assignment jobs can be assigned.")
    
    # Validate mechanic exists and is active
    mechanic_user = await db.users.find_one({"username": body.mechanic_username, "role": "mechanic", "status": "Active"}, {"_id": 0})
    if not mechanic_user:
        raise HTTPException(status_code=404, detail=f"Active mechanic user '{body.mechanic_username}' not found")
    
    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id},
        {"$set": {
            "mechanic_id": body.mechanic_username,
            "mechanic_name": mechanic_user.get("full_name"),
            "status": "pending_acceptance",
            "assigned_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"message": f"Mechanic '{mechanic_user['full_name']}' notified for maintenance {maintenance_id}", "status": "pending_acceptance"}

# ============ SEED ENDPOINT ============

@api_router.post("/seed/mechanic-locations")
async def seed_mechanic_locations(current_user: UserResponse = Depends(get_current_user)):
    """
    One-time endpoint: seeds all mechanics who lack lat/lng with random
    coordinates near Coimbatore (11.0168°N, 76.9558°E).
    Safe to call multiple times — skips mechanics that already have coords.
    """
    import random
    if current_user.role not in ["org_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    LAT_C, LNG_C, SPREAD = 11.0168, 76.9558, 0.25
    mechanics = await db.users.find({"role": "mechanic"}, {"_id": 0, "username": 1, "lat": 1, "lng": 1}).to_list(1000)
    updated, skipped = 0, 0
    for m in mechanics:
        if m.get("lat") and m.get("lng"):
            skipped += 1
            continue
        lat = round(LAT_C + random.uniform(-SPREAD, SPREAD), 6)
        lng = round(LNG_C + random.uniform(-SPREAD, SPREAD), 6)
        await db.users.update_one({"username": m["username"]}, {"$set": {"lat": lat, "lng": lng}})
        updated += 1
    return {"message": f"Seeded {updated} mechanic(s), skipped {skipped} with existing coords"}


# ============ MECHANIC COMPLETE & REVIEW ============

@api_router.put("/maintenance/{maintenance_id}/complete")
async def complete_maintenance_job(maintenance_id: str, body: CompleteJobRequest = CompleteJobRequest(), current_user: UserResponse = Depends(get_current_user)):
    """
    Mechanic marks their accepted (in_progress) job as completed.
    Optionally records labor_cost and notes.
    """
    if current_user.role != "mechanic":
        raise HTTPException(status_code=403, detail="Only mechanics can complete jobs")

    record = await db.maintenance.find_one({
        "maintenance_id": maintenance_id,
        "mechanic_id": current_user.username,
        "status": "in_progress"
    })
    if not record:
        raise HTTPException(status_code=404, detail="Active job not found or not assigned to you")

    now = datetime.now(timezone.utc).isoformat()
    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id},
        {"$set": {"status": "completed", "completed_at": now}}
    )
    # Persist labor_charge and spare_parts_cost to maintenance record before generating wage
    labor_charge = body.labor_charge if body.labor_charge > 0 else record.get("labor_cost", 0.0)
    spare_parts_cost = body.spare_parts_cost if body.spare_parts_cost > 0 else record.get("spare_parts_cost", 0.0)
    total_cost = labor_charge + spare_parts_cost
    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id},
        {"$set": {
            "labor_cost": labor_charge,
            "spare_parts_cost": spare_parts_cost,
            "total_cost": total_cost
        }}
    )
    # Generate wage record for mechanic
    wage_data = {
        "wage_id": generate_id("WAG"),
        "employee_id": current_user.username,
        "employee_role": "mechanic",           # ← role tag for payroll filtering
        "booking_id": maintenance_id,
        "wage_amount": labor_charge,
        "payment_status": "pending",
        "paid_at": None,
        "created_at": now,
        "organization_id": record.get("organization_id", "default_org")
    }
    await db.wages.insert_one(wage_data)

    # Free up the machinery
    await db.machinery.update_one(
        {"machinery_id": record.get("machinery_id")},
        {"$set": {"status": "Available"}}
    )
    print(f"[COMPLETE] Mechanic '{current_user.username}' completed job {maintenance_id}")
    return {"message": "Job marked as completed", "completed_at": now}


class MaintenanceReview(BaseModel):
    rating: int          # 1–5
    feedback: Optional[str] = None

@api_router.post("/maintenance/{maintenance_id}/review")
async def review_maintenance(maintenance_id: str, review: MaintenanceReview, current_user: UserResponse = Depends(get_current_user)):
    """
    Org Admin rates a mechanic after job completion (1–5 stars).
    Updates the mechanic's running average_rating and total_reviews in users collection.
    """
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Only Org Admin can rate mechanics")
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    record = await db.maintenance.find_one(
        {"maintenance_id": maintenance_id, "organization_id": current_user.organization_id}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found or access denied")
    if record.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed jobs")
    if record.get("rating"):
        raise HTTPException(status_code=400, detail="This job has already been reviewed")

    mechanic_username = record.get("mechanic_id")
    now = datetime.now(timezone.utc).isoformat()

    # Save rating on maintenance record
    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id},
        {"$set": {"rating": review.rating, "feedback": review.feedback, "reviewed_at": now, "reviewed_by": current_user.username}}
    )

    # Recalculate mechanic's running average
    mechanic = await db.users.find_one({"username": mechanic_username}, {"_id": 0})
    if mechanic:
        prev_avg = mechanic.get("average_rating", 0) or 0
        prev_count = mechanic.get("total_reviews", 0) or 0
        new_count = prev_count + 1
        new_avg = round(((prev_avg * prev_count) + review.rating) / new_count, 2)
        await db.users.update_one(
            {"username": mechanic_username},
            {"$set": {"average_rating": new_avg, "total_reviews": new_count}}
        )
        print(f"[REVIEW] {mechanic_username} new rating: {new_avg} ({new_count} reviews)")

    return {"message": "Review submitted", "new_average_rating": new_avg if mechanic else None}


@api_router.post("/mechanic/jobs/{maintenance_id}/parts")
async def mechanic_request_parts(maintenance_id: str, request: MaterialRequestCreate, current_user: UserResponse = Depends(get_current_user)):
    """Mechanic requests spare parts. Only allowed if the job is in_progress."""
    if current_user.role != "mechanic":
        raise HTTPException(status_code=403, detail="Only mechanics can request parts this way")
    
    mnt = await db.maintenance.find_one({"maintenance_id": maintenance_id, "mechanic_id": current_user.username})
    if not mnt:
        raise HTTPException(status_code=404, detail="Maintenance job not found or not assigned to you")
    
    if mnt.get("status") != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot request parts: job status is '{mnt.get('status')}'. You must accept the job first (status must be 'in_progress')."
        )
    
    req_data = {
        "request_id": generate_id("MAT"),
        "maintenance_id": maintenance_id,
        "mechanic_id": current_user.username,
        "mechanic_name": current_user.full_name,
        "part_name": request.part_name,
        "estimated_cost": request.estimated_cost,
        "status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": mnt.get("organization_id", "default_org")
    }
    await db.material_requests.insert_one(req_data)
    
    # Update the maintenance document with spare_parts array
    new_part = {
        "part_name": request.part_name,
        "quantity": request.quantity,
        "estimated_cost": request.estimated_cost,
        "status": "requested",
        "requested_at": datetime.now(timezone.utc).isoformat()
    }
    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id},
        {"$push": {"spare_parts": new_part}}
    )
    
    return MaterialRequest(**req_data)

@api_router.put("/maintenance/{maintenance_id}/spare-parts/approve")
async def approve_spare_parts(maintenance_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Manager approves all requested spare parts for a maintenance job."""
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve spare parts")
        
    mnt = await db.maintenance.find_one({"maintenance_id": maintenance_id})
    if not mnt:
         raise HTTPException(status_code=404, detail="Maintenance record not found")
         
    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id},
        {"$set": {"spare_parts.$[elem].status": "approved"}},
        array_filters=[{"elem.status": "requested"}]
    )
    
    updated = await db.maintenance.find_one({"maintenance_id": maintenance_id}, {"_id": 0})
    return {"message": "All spare parts approved", "spare_parts": updated.get("spare_parts", [])}

@api_router.put("/maintenance/{maintenance_id}/spare-parts/{part_name}/approve")
async def approve_single_spare_part(maintenance_id: str, part_name: str, current_user: UserResponse = Depends(get_current_user)):
    """Manager approves a single spare part by name using the positional operator."""
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve spare parts")
    
    mnt = await db.maintenance.find_one({"maintenance_id": maintenance_id, "spare_parts.part_name": part_name})
    if not mnt:
        raise HTTPException(status_code=404, detail=f"Part '{part_name}' not found in maintenance record")

    await db.maintenance.update_one(
        {"maintenance_id": maintenance_id, "spare_parts.part_name": part_name},
        {"$set": {"spare_parts.$.status": "approved"}}
    )
    updated = await db.maintenance.find_one({"maintenance_id": maintenance_id}, {"_id": 0})
    return {"message": f"Part '{part_name}' approved", "spare_parts": updated.get("spare_parts", [])}

# ============ FUEL EXPENSE ROUTES ============

@api_router.post("/org/machines/{machine_id}/fuel")
async def log_fuel_expense(machine_id: str, fuel: FuelExpenseCreate, current_user: UserResponse = Depends(get_current_user)):
    """Log a diesel/fuel expense for a machine."""
    if current_user.role not in ["org_admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    machine = await db.machinery.find_one({"machinery_id": machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    # For org_admin, enforce org ownership
    if current_user.role == "org_admin" and machine.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Machine does not belong to your organization")
    
    total_cost = round(fuel.liters * fuel.cost_per_liter, 2)
    
    fuel_data = {
        "fuel_id": generate_id("FUEL"),
        "machine_id": machine_id,
        "organization_id": machine.get("organization_id", "default_org"),
        "liters": fuel.liters,
        "cost_per_liter": fuel.cost_per_liter,
        "total_cost": total_cost,
        "date": fuel.date,
        "notes": fuel.notes,
        "logged_by": current_user.username,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.fuel_expenses.insert_one(fuel_data)
    fuel_data.pop("_id", None)
    return {"message": "Fuel expense logged successfully", "fuel_expense": fuel_data}

@api_router.get("/org/machines/{machine_id}/fuel")
async def get_fuel_expenses(machine_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get all fuel expenses for a specific machine."""
    if current_user.role not in ["org_admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    expenses = await db.fuel_expenses.find({"machine_id": machine_id}, {"_id": 0}).to_list(1000)
    return expenses

# ============ DASHBOARD & REPORTS ============

@api_router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    org_filter = {}
    
    # 1. Tenant Admins / Owners
    if current_user.role in ["org_admin", "owner"]:
        org_filter["organization_id"] = current_user.organization_id
        
    # 2. Super Admin
    elif current_user.role == "super_admin":
        pass # See all
        
    # 3. Global/Other Roles (Farmer, Mechanic, Operator)
    else:
        # Return empty/zero stats for now to prevent leaking global data
        # Ideally we would return "My Stats" (e.g. My Bookings count), but for now Safety First.
        return DashboardStats(
            total_revenue=0.0,
            total_bookings=0,
            active_machinery=0,
            pending_payments=0.0,
            total_farmers=0,
            total_employees=0
        )
        
    invoices = await db.invoices.find({**org_filter, "payment_status": "Paid"}, {"_id": 0}).to_list(1000)
    total_revenue = sum(inv["amount"] for inv in invoices)
    
    total_bookings = await db.bookings.count_documents(org_filter)
    
    # Machinery active
    mach_query = {**org_filter, "status": {"$in": ["Available", "Booked"]}}
    active_machinery = await db.machinery.count_documents(mach_query)
    
    pending_invoices = await db.invoices.find({**org_filter, "payment_status": {"$in": ["Pending", "Partially Paid"]}}, {"_id": 0}).to_list(1000)
    pending_payments = sum(inv["amount"] for inv in pending_invoices)
    
    # Farmers
    if current_user.role in ["org_admin", "owner"]:
         pipeline = [
             {"$match": {"organization_id": current_user.organization_id}},
             {"$group": {"_id": "$farmer_id"}},
             {"$count": "count"}
         ]
         farmer_agg = await db.bookings.aggregate(pipeline).to_list(1)
         total_farmers = farmer_agg[0]["count"] if farmer_agg else 0
    else:
        # Super admin sees all farmers
        total_farmers = await db.users.count_documents({"role": "farmer"})

    total_employees = await db.employees.count_documents(org_filter)
    
    # Calculate company rating based on completed bookings
    average_rating = 0.0
    total_reviews = 0
    
    if current_user.role in ["org_admin", "owner"]:
        pipeline = [
            {"$match": {"organization_id": current_user.organization_id, "status": "Completed", "rating": {"$exists": True, "$ne": None}}},
            {"$group": {
                "_id": None,
                "avg_rating": {"$avg": "$rating"},
                "review_count": {"$sum": 1}
            }}
        ]
        rating_agg = await db.bookings.aggregate(pipeline).to_list(1)
        if rating_agg:
            average_rating = round(rating_agg[0]["avg_rating"], 1)
            total_reviews = rating_agg[0]["review_count"]
    
    # Calculate total spare parts cost from approved parts
    maint_with_parts = await db.maintenance.find(
        {**org_filter, "spare_parts": {"$exists": True, "$ne": []}},
        {"_id": 0, "spare_parts": 1, "spare_parts_cost": 1}
    ).to_list(5000)
    total_spare_parts_cost = 0.0
    for rec in maint_with_parts:
        parts = rec.get("spare_parts", [])
        if parts:
            total_spare_parts_cost += sum(
                p.get("cost", p.get("estimated_cost", 0))
                for p in parts
                if p.get("status") in ("approved", "provided")
            )
        else:
            total_spare_parts_cost += rec.get("spare_parts_cost", 0)

    # Update DashboardStats return (requires model update too)
    return {
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "active_machinery": active_machinery,
        "pending_payments": pending_payments,
        "total_farmers": total_farmers,
        "total_employees": total_employees,
        "average_rating": average_rating,
        "total_reviews": total_reviews,
        "total_spare_parts_cost": total_spare_parts_cost
    }

@api_router.get("/reports/revenue")
async def get_revenue_report(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["admin", "owner", "org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id

    invoices = await db.invoices.find(query, {"_id": 0}).to_list(1000)
    
    paid_revenue = sum(inv["amount"] for inv in invoices if inv["payment_status"] == "Paid")
    pending_revenue = sum(inv["amount"] for inv in invoices if inv["payment_status"] == "Pending")
    
    return {
        "total_revenue": paid_revenue,
        "pending_revenue": pending_revenue,
        "total_invoices": len(invoices),
        "paid_invoices": len([inv for inv in invoices if inv["payment_status"] == "Paid"])
    }

@api_router.get("/reports/utilization")
async def get_utilization_report(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["admin", "owner", "org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id

    machinery_list = await db.machinery.find(query, {"_id": 0}).to_list(1000)
    
    utilization_data = []
    for machine in machinery_list:
        utilization_data.append({
            "machinery_id": machine["machinery_id"],
            "machine_type": machine["machine_type"],
            "total_usage_hours": machine["total_usage_hours"],
            "status": machine["status"]
        })
    
    return {"machinery_utilization": utilization_data}

@api_router.get("/reports/maintenance")
async def get_maintenance_report(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["admin", "owner", "org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id

    maintenance_records = await db.maintenance.find(query, {"_id": 0}).to_list(1000)
    
    total_maintenance = len(maintenance_records)
    completed_maintenance = len([rec for rec in maintenance_records if rec.get("completed_at")])
    ongoing_maintenance = total_maintenance - completed_maintenance
    
    return {
        "total_maintenance": total_maintenance,
        "completed_maintenance": completed_maintenance,
        "ongoing_maintenance": ongoing_maintenance
    }

@api_router.post("/invoices/{invoice_id}/pay")
async def mark_invoice_paid(invoice_id: str, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if current_user.role == "org_admin" and invoice.get("organization_id") != current_user.organization_id:
         raise HTTPException(status_code=403, detail="Not authorized")

    if invoice["payment_status"] == "Paid":
        return {"message": "Invoice already paid"}

    # Update invoice
    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"payment_status": "Paid"}}
    )

    # Log Payment
    payment_data = {
        "payment_id": generate_id("PAY"),
        "invoice_id": invoice_id,
        "amount": invoice["amount"],
        "payment_method": "Manual (Cash/External)",
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": invoice.get("organization_id", "default_org")
    }
    await db.payments.insert_one(payment_data)

    return {"message": "Invoice marked as paid", "payment_id": payment_data["payment_id"]}

@api_router.get("/reports/wages")
async def get_wages_report(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["admin", "owner", "org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user.role in ["org_admin", "owner"]:
        query["organization_id"] = current_user.organization_id
    
    wages = await db.wages.find(query, {"_id": 0}).to_list(1000)
    
    total_wages = sum(wage["wage_amount"] for wage in wages)
    total_records = len(wages)
    
    return {
        "total_wages_paid": total_wages,
        "total_wage_records": total_records,
        "wages": wages
    }

@api_router.get("/reports/roi")
async def get_roi_report(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role not in ["admin", "owner", "org_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Get all machinery for the org
    machinery_list = await db.machinery.find({"organization_id": current_user.organization_id}, {"_id": 0}).to_list(1000)
    
    roi_data = []
    org_total_revenue = 0
    org_total_maintenance = 0
    org_total_diesel = 0
    org_total_wages = 0
    
    for machine in machinery_list:
        m_id = machine["machinery_id"]
        
        # Calculate revenue from invoices linked to bookings for this machine
        bookings = await db.bookings.find({"machinery_id": m_id}, {"_id": 0}).to_list(1000)
        booking_ids = [b["booking_id"] for b in bookings]
        
        invoices = await db.invoices.find(
            {"booking_id": {"$in": booking_ids}, "payment_status": "Paid"}, 
            {"_id": 0}
        ).to_list(1000)
        
        revenue = sum(inv["amount"] for inv in invoices)
        
        # Calculate maintenance parts costs
        maintenance_records = await db.maintenance.find({"machinery_id": m_id}, {"_id": 0}).to_list(1000)
        maintenance_cost = sum(rec.get("total_cost", 0) for rec in maintenance_records)
        
        # Calculate diesel / fuel costs
        fuel_records = await db.fuel_expenses.find({"machine_id": m_id}, {"_id": 0}).to_list(1000)
        diesel_cost = sum(rec.get("total_cost", 0) for rec in fuel_records)
        
        # Calculate operator wages linked to this machine's bookings
        operator_wages = 0
        for bid in booking_ids:
            wages = await db.wages.find({"booking_id": bid}, {"_id": 0}).to_list(100)
            operator_wages += sum(w.get("wage_amount", 0) for w in wages)
        
        net_roi = revenue - maintenance_cost - diesel_cost - operator_wages
        
        org_total_revenue += revenue
        org_total_maintenance += maintenance_cost
        org_total_diesel += diesel_cost
        org_total_wages += operator_wages
        
        roi_data.append({
            "machinery_id": m_id,
            "machine_type": machine["machine_type"],
            "revenue": revenue,
            "maintenance_cost": maintenance_cost,
            "diesel_cost": diesel_cost,
            "operator_wages": operator_wages,
            "net_roi": net_roi
        })
        
    return {
        "roi_analysis": roi_data,
        "org_totals": {
            "total_revenue": org_total_revenue,
            "total_maintenance_cost": org_total_maintenance,
            "total_diesel_cost": org_total_diesel,
            "total_operator_wages": org_total_wages,
            "net_roi": org_total_revenue - org_total_maintenance - org_total_diesel - org_total_wages
        }
    }

# ============ ADVANCED REPORTS (DATE-FILTERED BI) ============

@api_router.get("/reports/financial")
async def get_financial_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Financial summary: total revenue, maintenance costs, wages paid, and net profit.
    Accepts optional ISO-date strings (YYYY-MM-DD) for date filtering.
    """
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    org_filter = {}
    if current_user.role in ["org_admin", "owner"]:
        org_filter["organization_id"] = current_user.organization_id

    # ── Build date range predicate ──────────────────────────────────
    date_match = {}
    if start_date:
        date_match["$gte"] = start_date
    if end_date:
        # Include the full end day by appending T23:59:59
        date_match["$lte"] = end_date + "T23:59:59"

    # ── Revenue from paid invoices ──────────────────────────────────
    inv_query = {**org_filter, "payment_status": "Paid"}
    if date_match:
        inv_query["generated_at"] = date_match
    invoices = await db.invoices.find(inv_query, {"_id": 0, "amount": 1}).to_list(5000)
    total_revenue = sum(inv.get("amount", 0) for inv in invoices)

    # ── Maintenance costs (split into labor vs approved spare parts) ──
    maint_query = {**org_filter}
    if date_match:
        maint_query["created_at"] = date_match
    maint_records = await db.maintenance.find(maint_query, {"_id": 0, "labor_cost": 1, "spare_parts": 1, "spare_parts_cost": 1, "total_cost": 1}).to_list(5000)
    total_labor_cost = sum(rec.get("labor_cost", 0) for rec in maint_records)
    # Sum approved spare parts from the spare_parts array, fallback to spare_parts_cost field
    total_spare_parts_cost = 0
    for rec in maint_records:
        parts = rec.get("spare_parts", [])
        if parts:
            total_spare_parts_cost += sum(
                p.get("cost", p.get("estimated_cost", 0))
                for p in parts
                if p.get("status") in ("approved", "provided")
            )
        else:
            total_spare_parts_cost += rec.get("spare_parts_cost", 0)

    # ── Wages paid ──────────────────────────────────────────────────
    wage_query = {**org_filter}
    if date_match:
        wage_query["created_at"] = date_match
    wages = await db.wages.find(wage_query, {"_id": 0, "wage_amount": 1}).to_list(5000)
    total_wages_paid = sum(w.get("wage_amount", 0) for w in wages)

    # ── Diesel / fuel costs ─────────────────────────────────────────
    fuel_query = {**org_filter}
    if date_match:
        fuel_query["date"] = date_match
    fuel_records = await db.fuel_expenses.find(fuel_query, {"_id": 0, "total_cost": 1}).to_list(5000)
    total_diesel = sum(rec.get("total_cost", 0) for rec in fuel_records)

    net_profit = total_revenue - total_labor_cost - total_spare_parts_cost - total_wages_paid - total_diesel

    return {
        "total_revenue": total_revenue,
        "total_labor_cost": total_labor_cost,
        "total_spare_parts_cost": total_spare_parts_cost,
        "total_maintenance_costs": total_labor_cost + total_spare_parts_cost,
        "total_wages_paid": total_wages_paid,
        "total_diesel": total_diesel,
        "net_profit": net_profit,
    }


@api_router.get("/reports/utilization-detail")
async def get_utilization_detail(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Fleet utilization: completed bookings grouped by machine with job count
    and total revenue per machine, sorted by number of jobs desc.
    """
    if current_user.role not in ["org_admin", "owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    booking_match = {"status": "Completed"}
    if current_user.role in ["org_admin", "owner"]:
        booking_match["organization_id"] = current_user.organization_id

    if start_date or end_date:
        date_cond = {}
        if start_date:
            date_cond["$gte"] = start_date
        if end_date:
            date_cond["$lte"] = end_date + "T23:59:59"
        booking_match["booking_date"] = date_cond

    # Aggregate bookings → group by machinery_id → lookup machine name → sort
    pipeline = [
        {"$match": booking_match},
        {"$group": {
            "_id": "$machinery_id",
            "total_jobs": {"$sum": 1},
        }},
        {"$lookup": {
            "from": "machinery",
            "localField": "_id",
            "foreignField": "machinery_id",
            "as": "machine_info",
        }},
        {"$unwind": {"path": "$machine_info", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "machinery_id": "$_id",
            "machine_name": {"$ifNull": ["$machine_info.machine_type", "Unknown"]},
            "total_jobs": 1,
        }},
        {"$sort": {"total_jobs": -1}},
    ]

    results = await db.bookings.aggregate(pipeline).to_list(500)

    # Enrich each machine result with revenue from paid invoices
    for item in results:
        m_id = item["machinery_id"]
        # Find booking_ids for this machine that matched our filter
        b_query = {**booking_match, "machinery_id": m_id}
        bookings = await db.bookings.find(b_query, {"_id": 0, "booking_id": 1}).to_list(5000)
        booking_ids = [b["booking_id"] for b in bookings]

        inv_query_inner = {"booking_id": {"$in": booking_ids}, "payment_status": "Paid"}
        invoices = await db.invoices.find(inv_query_inner, {"_id": 0, "amount": 1}).to_list(5000)
        item["total_revenue"] = sum(inv.get("amount", 0) for inv in invoices)

    return results

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
