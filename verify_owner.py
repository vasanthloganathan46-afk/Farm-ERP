import asyncio
import httpx
from colorama import init, Fore, Style

init(autoreset=True)

BASE_URL = "http://localhost:8000"

async def login(username, password):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": username, "password": password}
            )
            if response.status_code == 200:
                print(f"{Fore.GREEN}Login successful for {username}{Style.RESET_ALL}")
                return response.json()["access_token"]
            else:
                print(f"{Fore.RED}Login failed for {username}: {response.text}{Style.RESET_ALL}")
                return None
        except Exception as e:
            print(f"{Fore.RED}Login error: {e}{Style.RESET_ALL}")
            return None

async def verify_access():
    print(f"{Fore.CYAN}--- Verifying Role Separation: Owner vs Org Admin ---{Style.RESET_ALL}")

    # 1. Login as Manager (Org Admin)
    manager_token = await login("manager", "manager123")
    if not manager_token: return

    # 2. Login as Owner
    owner_token = await login("owner", "owner123")
    if not owner_token: return

    headers_manager = {"Authorization": f"Bearer {manager_token}"}
    headers_owner = {"Authorization": f"Bearer {owner_token}"}

    async with httpx.AsyncClient() as client:
        # Test 1: Create Machinery (Write Operation)
        print("\nTest 1: Create Machinery")
        machinery_data = {
            "machine_type": "Test Tractor",
            "rate_per_hour": 100.0,
            "rate_per_acre": 50.0
        }
        
        # Manager should SUCCEED
        res_manager = await client.post(f"{BASE_URL}/api/machinery", json=machinery_data, headers=headers_manager)
        if res_manager.status_code == 200:
            print(f"{Fore.GREEN}✓ Manager able to create machinery{Style.RESET_ALL}")
            machinery_id = res_manager.json()["machinery_id"]
        else:
            print(f"{Fore.RED}✗ Manager failed to create machinery: {res_manager.status_code}{Style.RESET_ALL}")
            machinery_id = None

        # Owner should FAIL
        res_owner = await client.post(f"{BASE_URL}/api/machinery", json=machinery_data, headers=headers_owner)
        if res_owner.status_code == 403:
            print(f"{Fore.GREEN}✓ Owner correctly blocked from creating machinery{Style.RESET_ALL}")
        else:
            print(f"{Fore.RED}✗ Owner able to create machinery (Status: {res_owner.status_code}){Style.RESET_ALL}")

        # Test 2: Update Machinery (Write Operation)
        if machinery_id:
            print("\nTest 2: Update Machinery")
            # Owner should FAIL
            res_owner_update = await client.put(f"{BASE_URL}/api/machinery/{machinery_id}", json={"rate_per_hour": 120.0}, headers=headers_owner)
            if res_owner_update.status_code == 403:
                 print(f"{Fore.GREEN}✓ Owner correctly blocked from updating machinery{Style.RESET_ALL}")
            else:
                 print(f"{Fore.RED}✗ Owner able to update machinery (Status: {res_owner_update.status_code}){Style.RESET_ALL}")

        # Test 3: View Invoices (Read Operation)
        print("\nTest 3: View Invoices")
        # Owner should SUCCEED
        res_owner_invoices = await client.get(f"{BASE_URL}/api/invoices", headers=headers_owner)
        if res_owner_invoices.status_code == 200:
            print(f"{Fore.GREEN}✓ Owner able to view invoices{Style.RESET_ALL}")
        else:
            print(f"{Fore.RED}✗ Owner failed to view invoices (Status: {res_owner_invoices.status_code}){Style.RESET_ALL}")
            
        print("\nTest 5: Update Booking (Check RBAC)")
        # Owner should get 403 even if ID is random
        res_owner_booking = await client.put(f"{BASE_URL}/api/bookings/BOK-9999", json={"status": "Confirmed"}, headers=headers_owner)
        if res_owner_booking.status_code == 403:
             print(f"{Fore.GREEN}✓ Owner correctly blocked from updating booking{Style.RESET_ALL}")
        else:
             print(f"{Fore.RED}✗ Owner result for updating booking: {res_owner_booking.status_code} (Expected 403){Style.RESET_ALL}")

if __name__ == "__main__":
    asyncio.run(verify_access())
