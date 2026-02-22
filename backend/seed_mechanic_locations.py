"""
seed_mechanic_locations.py
──────────────────────────
Patches all mechanic users who don't yet have lat/lng with
random coordinates near Coimbatore, Tamil Nadu (11.0168°N, 76.9558°E).

Run once:
    python seed_mechanic_locations.py
"""
import asyncio, random
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME",   "farm_erp")

# Bounding box: ~30 km around Coimbatore city centre
LAT_CENTER, LNG_CENTER = 11.0168, 76.9558
SPREAD = 0.25  # ± 0.25° ≈ 28 km


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    mechanics = await db.users.find(
        {"role": "mechanic"},
        {"_id": 1, "username": 1, "full_name": 1, "lat": 1, "lng": 1}
    ).to_list(1000)

    updated, skipped = 0, 0
    for m in mechanics:
        if m.get("lat") and m.get("lng"):
            skipped += 1
            continue
        lat = round(LAT_CENTER + random.uniform(-SPREAD, SPREAD), 6)
        lng = round(LNG_CENTER + random.uniform(-SPREAD, SPREAD), 6)
        await db.users.update_one(
            {"_id": m["_id"]},
            {"$set": {"lat": lat, "lng": lng}}
        )
        print(f"  ✓ {m.get('full_name', m['username']):30s}  →  ({lat}, {lng})")
        updated += 1

    print(f"\n[DONE] Updated {updated} mechanic(s), skipped {skipped} with existing coords.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
