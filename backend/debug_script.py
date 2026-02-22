import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def print_step(msg):
    print(f"\n👉 {msg}")

def test_login(username, password, role_name):
    print(f"   Logging in as {role_name} ({username})...")
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
        if response.status_code == 200:
            token = response.json().get("access_token")
            # Get user details to confirm role/org
            headers = {"Authorization": f"Bearer {token}"}
            user_res = requests.get(f"{BASE_URL}/auth/me", headers=headers)
            user_data = user_res.json()
            print(f"   ✅ Success. User: {user_data['username']}, Role: {user_data['role']}, Org: {user_data.get('organization_id')}")
            return token, user_data
        else:
            print(f"   ❌ Login Failed: {response.text}")
            return None, None
    except Exception as e:
        print(f"   ❌ Connection Error: {e}")
        return None, None

def run_e2e_flow():
    print("=== STARTING E2E AUDIT (API LAYER) ===")
    
    # ---------------------------------------------------------
    # FLOW A: Core Booking Loop
    # ---------------------------------------------------------
    print_step("FLOW A: Booking -> Approval -> Execution -> Billing")
    
    # 1. Farmer Login & Search
    farmer_token, farmer_user = test_login("farmer1", "farmer123", "Farmer")
    if not farmer_token: return
    
    headers_farmer = {"Authorization": f"Bearer {farmer_token}"}
    
    # Browse Machinery (Public or Private?)
    # FarmerBrowsePage uses public endpoint. Let's use that.
    res = requests.get(f"{BASE_URL}/public/machinery") 
    machinery_list = res.json()
    print(f"   Farmer sees {len(machinery_list)} machines.")
    
    # Verify Location Data presence
    if machinery_list and "location" in machinery_list[0]:
        print(f"   ✅ Location Data Verified: {machinery_list[0]['location']}")
    else:
        print(f"   ❌ Location Data MISSING in API response!")

    # Book the first available machine
    target_machine = next((m for m in machinery_list if m["status"] == "Available"), None)
    if not target_machine:
        print("   ❌ No available machinery to book.")
        return

    print(f"   Booking Machine: {target_machine['machine_type']} ({target_machine['machinery_id']})")
    
    booking_payload = {
        "machinery_id": target_machine["machinery_id"],
        "booking_date": "2026-10-25T00:00:00", # Specific future date
        "field_location": "Test Field A",
        "expected_hours": 5.0
    }
    res = requests.post(f"{BASE_URL}/bookings", json=booking_payload, headers=headers_farmer)
    if res.status_code == 200:
        booking = res.json()
        print(f"   ✅ Booking Created: ID {booking['booking_id']}, Status: {booking['status']}")
    else:
        print(f"   ❌ Booking Creation Failed: {res.text}")
        return

    # 2. Admin Approval
    print_step("Admin Approval")
    admin_token, admin_user = test_login("admin", "admin123", "Admin")
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    
    # Find the booking
    res = requests.get(f"{BASE_URL}/bookings", headers=headers_admin)
    all_bookings = res.json()
    my_booking = next((b for b in all_bookings if b["booking_id"] == booking["booking_id"]), None)
    
    if my_booking:
        print(f"   Admin found booking {my_booking['booking_id']}. Approving...")
        # Get an operator
        res = requests.get(f"{BASE_URL}/employees", headers=headers_admin)
        operators = [e for e in res.json() if e['role'] == "Operator"]
        if not operators:
            print("   ❌ No operators found!")
            return
        operator = operators[0]
        print(f"   Assigning Operator: {operator['name']} ({operator['employee_id']})")
        
        # Approve
        update_payload = {
            "approval_status": "Approved",
            "operator_id": operator["employee_id"]
        }
        res = requests.put(f"{BASE_URL}/bookings/{my_booking['booking_id']}", json=update_payload, headers=headers_admin)
        if res.status_code == 200:
            print(f"   ✅ Booking Approved & Assigned. New Status: {res.json().get('status')}")
        else:
            print(f"   ❌ Approval Failed: {res.text}")
            return
    else:
        print("   ❌ Booking not found in Admin dashboard!")
        return

    # 3. Execution (Operator)
    print_step("Operator Execution")
    # We need to login as the SPECIFIC operator we assigned.
    # In init_data, 'operator1' is usually 'EMP_0001'. Let's check who we assigned.
    # If we assigned a random operator, we might not have their login.
    # But 'admin' assigned 'operators[0]'. In init_data, 'Operator 1' is created with fixed ID?
    # Actually, init_data creates user 'operator1'. Does it map to 'Operator 1' employee?
    # Yes, init_data creates 'Operator 1' employee.
    # We'll assume the assigned operator is 'Operator 1' (EMP_0001) for this E2E to work smoothly, 
    # OR we just login as 'operator1' and hope the admin assigned HIM.
    # To be safe, let's login as 'operator1' and check HIS bookings.
    
    op_token, op_user = test_login("operator1", "op123", "Operator 1")
    headers_op = {"Authorization": f"Bearer {op_token}"}
    
    res = requests.get(f"{BASE_URL}/bookings", headers=headers_op)
    op_bookings = res.json()
    # Check if our booking is there
    my_job = next((b for b in op_bookings if b["booking_id"] == booking["booking_id"]), None)
    
    if my_job:
        print(f"   ✅ Operator sees job {my_job['booking_id']}.")
        # Complete Job
        print("   Completing Job...")
        log_payload = {
            "booking_id": my_job["booking_id"],
            "actual_hours": 5.0,
            "notes": "Finished efficiently."
        }
        res = requests.post(f"{BASE_URL}/field-logs", json=log_payload, headers=headers_op)
        if res.status_code == 200:
             print("   ✅ Job Completed. Field Log Created.")
        else:
             print(f"   ❌ Job Completion Failed: {res.text}")
    else:
        print(f"   ⚠️ Operator 1 does NOT see the job. Maybe Admin assigned a different operator ({operator['name']})?")
        # If Admin assigned someone else, we can't login as them (no creds in init_data for randoms).
        # But we know init_data creates 'Operator 1' and credentials 'operator1'.
        # If Admin picked 'Operator 1', it should work.

    # 4. Billing Verification
    print_step("Billing Verification")
    res = requests.get(f"{BASE_URL}/invoices", headers=headers_admin)
    invoices = res.json()
    # Find invoice for our booking
    inv = next((i for i in invoices if i["booking_id"] == booking["booking_id"]), None)
    if inv:
        print(f"   ✅ Invoice Found: {inv['invoice_id']}, Amount: {inv['amount']}")
        print(f"   ✅ Organization ID: {inv.get('organization_id')} (Multi-Tenancy Check)")
        if inv.get('organization_id') == "default_org":
             print("   ✅ Tenant Isolation Passed.")
        else:
             print("   ❌ Tenant Isolation FAILED (Wrong/Missing Org ID)")
    else:
        print("   ❌ Auto-Invoice Generation FAILED. No invoice found.")

    # ---------------------------------------------------------
    # FLOW B: Breakdown & Maintenance
    # ---------------------------------------------------------
    print_step("FLOW B: Breakdown -> Mechanic -> Expense")
    
    # We need an active job. Let's create another booking or reuse if possible.
    # Let's verify Breakdown reporting endpoint.
    # Login as Operator
    if not op_token: return
    
    # Find a confirmed booking (we just completed one, so it's 'Completed').
    # We need a 'Confirmed' booking.
    # Let's Assume Operator 1 has another one or we create one quickly.
    # For speed, let's just use the 'machinery' direct endpoint if allowed, or skip if no active job.
    # Or we can just use the 'Breakdown' endpoint on ANY machinery if we are authorized.
    # API says: "operator, org_admin, owner" can report.
    
    target_machine_id = machinery_list[-1]["machinery_id"] # Pick last machine
    print(f"   Reporting Breakdown for machine {target_machine_id}...")
    
    res = requests.post(f"{BASE_URL}/machinery/{target_machine_id}/report-breakdown", headers=headers_op)
    if res.status_code == 200:
        print("   ✅ Breakdown Reported.")
    else:
        print(f"   ❌ Breakdown Report Failed: {res.text}")

    # Admin verification
    res = requests.get(f"{BASE_URL}/machinery", headers=headers_admin)
    m_list = res.json()
    broken_machine = next((m for m in m_list if m["machinery_id"] == target_machine_id), None)
    if broken_machine and broken_machine["status"] == "Under Maintenance":
        print("   ✅ Admin sees status: Under Maintenance")
    else:
        print(f"   ❌ Status update failed. Status is {broken_machine.get('status') if broken_machine else 'Unknown'}")

    # Mechanic Logic
    mech_token, mech_user = test_login("mechanic1", "mech123", "Mechanic")
    headers_mech = {"Authorization": f"Bearer {mech_token}"}
    
    # Create Maintenance Record (usually done by Admin/Manager assignment, but let's see if Mechanic can view)
    # The 'report-breakdown' doesn't auto-create a maintenance record in schema, just updates status?
    # We usually need to Create Maintenance.
    # Admin creates maintenance.
    print("   Admin creating maintenance record...")
    maint_payload = {
        "machinery_id": target_machine_id,
        "mechanic_id": "EMP_0002", # Mechanic 1 ID from init_data
        "service_type": "Engine Repair",
        "notes": "Breakdown reported by operator"
    }
    res = requests.post(f"{BASE_URL}/maintenance", json=maint_payload, headers=headers_admin)
    if res.status_code == 200:
        maint_record = res.json()
        print(f"   ✅ Maintenance Record Created: {maint_record['maintenance_id']}")
        
        # Mechanic Material Request
        print("   Mechanic requesting materials...")
        req_payload = {
            "maintenance_id": maint_record["maintenance_id"],
            "part_name": "Piston Ring",
            "estimated_cost": 4500.0
        }
        res = requests.post(f"{BASE_URL}/maintenance/material-requests", json=req_payload, headers=headers_mech)
        if res.status_code == 200:
            print("   ✅ Material Request Submitted.")
        else:
             print(f"   ❌ Material Request Failed: {res.text}")
    else:
        print(f"   ❌ Maintenance Creation Failed: {res.text}")

if __name__ == "__main__":
    run_e2e_flow()
