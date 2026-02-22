import requests
import json

BASE_URL = "http://localhost:8000/api"

def print_step(msg):
    print(f"\n👉 {msg}")

def login(username, password):
    res = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
    if res.status_code == 200:
        return res.json()["access_token"]
    return None

def verify_admins():
    print("=== STARTING ADMIN RBAC VERIFICATION ===")
    
    # 1. Login as Super Admin
    print_step("Testing SUPER ADMIN (admin)")
    token = login("admin", "admin123")
    if not token:
        print("❌ Login failed")
        return
    headers = {"Authorization": f"Bearer {token}"}
    
    # Check Pending Users (Should Succeed)
    res = requests.get(f"{BASE_URL}/admin/users/pending", headers=headers)
    if res.status_code == 200:
        print(f"   ✅ Accessed Pending Users (Count: {len(res.json())})")
    else:
        print(f"   ❌ Failed to access Pending Users: {res.status_code}")

    # Check Tenant Data (Should be RESTRICTED - Empty List or 403)
    res = requests.get(f"{BASE_URL}/bookings", headers=headers)
    # The current implementation returns 403 or empty list depending on strictness. 
    # server.py: get_bookings -> if super_admin return [] (lines 750ish check)
    # Let's check what it does.
    if res.status_code == 200 and len(res.json()) == 0:
        print("   ✅ Bookings List is EMPTY (Correct for Super Admin)")
    elif res.status_code == 403:
         print("   ✅ Bookings Access DENIED (Correct for Super Admin)")
    else:
        print(f"   ⚠️ Unexpected Bookings Access: {res.status_code} Items: {len(res.json())}")

    # 2. Login as Org Admin
    print_step("Testing ORG ADMIN (owner)")
    token = login("owner", "owner123")
    if not token:
        print("❌ Login failed")
        return
    headers = {"Authorization": f"Bearer {token}"}

    # Check Pending Users (Should FAIL)
    res = requests.get(f"{BASE_URL}/admin/users/pending", headers=headers)
    if res.status_code == 403:
        print("   ✅ Pending Users Access DENIED (Correct for Org Admin)")
    else:
        print(f"   ❌ Unexpected Pending Users Access: {res.status_code}")

    # Check Tenant Data (Should SUCCEED)
    res = requests.get(f"{BASE_URL}/bookings", headers=headers)
    if res.status_code == 200:
        print(f"   ✅ Accessed Organization Bookings (Count: {len(res.json())})")
    else:
        print(f"   ❌ Failed to access Bookings: {res.status_code}")

if __name__ == "__main__":
    verify_admins()
