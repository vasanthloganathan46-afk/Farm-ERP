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

async def verify_fixes():
    print(f"{Fore.CYAN}--- Verifying Fixes: Manager Reports & Mechanic Access ---{Style.RESET_ALL}")

    # 1. Login as Manager (Org Admin)
    manager_token = await login("manager", "manager123")
    
    if manager_token:
        headers_manager = {"Authorization": f"Bearer {manager_token}"}
        async with httpx.AsyncClient() as client:
            print("\nTest 1: Manager accessing Revenue Report")
            res = await client.get(f"{BASE_URL}/api/reports/revenue", headers=headers_manager)
            if res.status_code == 200:
                print(f"{Fore.GREEN}✓ Manager can access revenue report{Style.RESET_ALL}")
            else:
                print(f"{Fore.RED}✗ Manager blocked from revenue report: {res.status_code}{Style.RESET_ALL}")

            print("\nTest 2: Manager accessing Wages Report")
            res = await client.get(f"{BASE_URL}/api/reports/wages", headers=headers_manager)
            if res.status_code == 200:
                print(f"{Fore.GREEN}✓ Manager can access wages report{Style.RESET_ALL}")
            else:
                print(f"{Fore.RED}✗ Manager blocked from wages report: {res.status_code}{Style.RESET_ALL}")

    # 2. Login as Mechanic
    mechanic_token = await login("mechanic1", "mech123")
    
    if mechanic_token:
        headers_mech = {"Authorization": f"Bearer {mechanic_token}"}
        async with httpx.AsyncClient() as client:
            print("\nTest 3: Mechanic accessing Maintenance Records")
            # Trying likely endpoint paths based on grep search results (to be confirmed)
            res = await client.get(f"{BASE_URL}/api/maintenance", headers=headers_mech)
            if res.status_code == 200:
                print(f"{Fore.GREEN}✓ Mechanic can access maintenance records{Style.RESET_ALL}")
                print(f"  Records found: {len(res.json())}")
            else:
                print(f"{Fore.RED}✗ Mechanic blocked from maintenance records: {res.status_code}{Style.RESET_ALL}")

            print("\nTest 4: Mechanic accessing Material Requests")
            res = await client.get(f"{BASE_URL}/api/maintenance/material-requests", headers=headers_mech)
            if res.status_code == 200:
                print(f"{Fore.GREEN}✓ Mechanic can access material requests{Style.RESET_ALL}")
            else:
                print(f"{Fore.RED}✗ Mechanic blocked from material requests: {res.status_code}{Style.RESET_ALL}")

if __name__ == "__main__":
    asyncio.run(verify_fixes())
