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

def verify_financials():
    print("=== STARTING FINANCIAL VERIFICATION ===")
    
    # Login as Admin
    token = login("admin", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Check ROI Report (Initial)
    print_step("Initial ROI Report")
    res = requests.get(f"{BASE_URL}/reports/roi", headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(json.dumps(data, indent=2))
        # Sum revenue from all machines
        initial_revenue = sum(item["revenue"] for item in data.get("roi_analysis", []))
        print(f"   Initial Total Revenue: {initial_revenue}")
    else:
        print(f"❌ Failed to get ROI report: {res.text}")
        return

    # 2. Find a Pending Invoice
    print_step("Finding Pending Invoice")
    res = requests.get(f"{BASE_URL}/invoices", headers=headers)
    invoices = res.json()
    pending_inv = next((i for i in invoices if i["payment_status"] == "Pending"), None)
    
    if not pending_inv:
        print("⚠️ No Pending invoices found. Cannot test payment.")
        return

    print(f"   Found Pending Invoice: {pending_inv['invoice_id']} Amount: {pending_inv['amount']}")

    # 3. Mark as Paid
    print_step(f"Marking Invoice {pending_inv['invoice_id']} as Paid")
    res = requests.post(f"{BASE_URL}/invoices/{pending_inv['invoice_id']}/pay", headers=headers)
    if res.status_code == 200:
        print("   ✅ Payment Recorded: " + str(res.json()))
    else:
        print(f"❌ Failed to mark paid: {res.text}")
        return

    # 4. Check ROI Report (Post-Payment)
    print_step("Post-Payment ROI Report")
    res = requests.get(f"{BASE_URL}/reports/roi", headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(json.dumps(data, indent=2))
        final_revenue = sum(item["revenue"] for item in data.get("roi_analysis", []))
        
        if final_revenue > initial_revenue:
            print(f"   ✅ Revenue Increased: {initial_revenue} -> {final_revenue}")
        else:
            print(f"   ❌ Revenue did NOT increase! (Initial: {initial_revenue}, Final: {final_revenue})")
    else:
        print(f"❌ Failed to get ROI report: {res.text}")

if __name__ == "__main__":
    verify_financials()
