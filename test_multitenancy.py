import asyncio
import httpx
from colorama import init, Fore, Style

init(autoreset=True)

BASE_URL = "http://localhost:8000"

async def get_token(username, password):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
            if response.status_code == 200:
                return response.json()["access_token"]
            print(f"{Fore.RED}Login Failed for {username}: {response.text}{Style.RESET_ALL}")
            return None
        except Exception as e:
            print(f"{Fore.RED}Login Error: {e}{Style.RESET_ALL}")
            return None

async def verify_isolation():
    print(f"{Fore.CYAN}=== Starting Tenant Isolation Verification ==={Style.RESET_ALL}")
    
    # 1. Login Org A (manager / manager123 -> default_org)
    token_a = await get_token("manager", "manager123")
    if not token_a: return
    
    # 2. Login Org B (manager_b / manager123 -> org_b)
    token_b = await get_token("manager_b", "manager123")
    if not token_b: return

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    async with httpx.AsyncClient() as client:
        # TEST 1: Get Machinery
        print(f"\n{Fore.YELLOW}TEST 1: Machinery Isolation{Style.RESET_ALL}")
        
        # Org A should verify they see Org A machines, but NOT Org B machines
        resp_a = await client.get(f"{BASE_URL}/api/machinery", headers=headers_a)
        machines_a = resp_a.json()
        ids_a = [m["machinery_id"] for m in machines_a]
        print(f"Org A sees {len(machines_a)} machines: {ids_a}")
        
        resp_b = await client.get(f"{BASE_URL}/api/machinery", headers=headers_b)
        machines_b = resp_b.json()
        ids_b = [m["machinery_id"] for m in machines_b]
        print(f"Org B sees {len(machines_b)} machines: {ids_b}")

        if "MCH_B_001" in ids_a:
            print(f"{Fore.RED}[FAIL] Org A can see Org B machine MCH_B_001{Style.RESET_ALL}")
        elif "MCH_B_001" not in ids_b:
             print(f"{Fore.RED}[FAIL] Org B CANNOT see their own machine MCH_B_001{Style.RESET_ALL}")
        else:
            print(f"{Fore.GREEN}[PASS] Machinery Isolation Confirmed{Style.RESET_ALL}")

        # TEST 2: Booking Isolation
        print(f"\n{Fore.YELLOW}TEST 2: Booking Isolation{Style.RESET_ALL}")
        # Try to fetch bookings
        resp_bk_a = await client.get(f"{BASE_URL}/api/bookings", headers=headers_a)
        bookings_a = resp_bk_a.json()
        org_ids_a = {b.get("organization_id") for b in bookings_a}
        
        resp_bk_b = await client.get(f"{BASE_URL}/api/bookings", headers=headers_b)
        bookings_b = resp_bk_b.json()
        org_ids_b = {b.get("organization_id") for b in bookings_b} # B might have none if we didn't seed bookings properly yet, or mocked one
        
        print(f"Org A Bookings Orgs: {org_ids_a}")
        print(f"Org B Bookings Orgs: {org_ids_b}")
        
        if "org_b" in org_ids_a:
             print(f"{Fore.RED}[FAIL] Org A sees Org B bookings{Style.RESET_ALL}")
        else:
             print(f"{Fore.GREEN}[PASS] Booking Isolation Confirmed{Style.RESET_ALL}")
             
        # TEST 3: Cross-Tenant Update Attempt
        print(f"\n{Fore.YELLOW}TEST 3: Cross-Tenant Update (Org A modifies Org B Machine){Style.RESET_ALL}")
        # Org A tries to update MCH_B_001
        update_payload = {"status": "Maintenance"} 
        resp_update = await client.put(f"{BASE_URL}/api/machinery/MCH_B_001", json=update_payload, headers=headers_a)
        
        if resp_update.status_code in [403, 404]:
            print(f"{Fore.GREEN}[PASS] Org A blocked from updating Org B machine (Status: {resp_update.status_code}){Style.RESET_ALL}")
        else:
            print(f"{Fore.RED}[FAIL] Org A updated Org B machine! Status: {resp_update.status_code}{Style.RESET_ALL}")

        # TEST 4: Global Role Access
        print(f"\n{Fore.YELLOW}TEST 4: Global Role Access (Farmer){Style.RESET_ALL}")
        # Login as farmer1 (Global)
        token_f = await get_token("farmer1", "farmer123")
        if token_f:
            headers_f = {"Authorization": f"Bearer {token_f}"}
            # Farmer should check availability of Org B machine
            chk_payload = {"machinery_id": "MCH_B_001", "date": "2026-05-20"}
            resp_chk = await client.post(f"{BASE_URL}/api/public/check-availability", json=chk_payload) 
            # Note: check-availability is PUBLIC, but let's verify it works for tenant machine
            if resp_chk.status_code == 200:
                 print(f"{Fore.GREEN}[PASS] Public availability check works for Org B machine{Style.RESET_ALL}")
            else:
                 print(f"{Fore.RED}[FAIL] Availability check failed: {resp_chk.status_code}{Style.RESET_ALL}")
        else:
            print(f"{Fore.RED}[SKIP] Could not login as farmer1{Style.RESET_ALL}")

    print(f"\n{Fore.CYAN}=== Verification Complete ==={Style.RESET_ALL}")

if __name__ == "__main__":
    asyncio.run(verify_isolation())
