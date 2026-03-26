import asyncio
from sqlalchemy import select
from database import async_session
from models import Category

CATEGORIES = [
    ('Groceries',       '🛒', 'Food and grocery items'),
    ('Dining',          '🍽️', 'Restaurants, cafes, and takeaway'),
    ('Transport',       '🚗', 'Fuel, parking, public transport, rideshare'),
    ('Utilities',       '💡', 'Electricity, water, gas, internet'),
    ('Entertainment',   '🎬', 'Movies, games, streaming, events'),
    ('Shopping',        '🛍️', 'Clothing, electronics, general retail'),
    ('Health',          '💊', 'Pharmacy, medical, fitness'),
    ('Education',       '📚', 'Books, courses, training'),
    ('Travel',          '✈️', 'Hotels, flights, accommodation'),
    ('Subscriptions',   '🔄', 'Recurring monthly/yearly services'),
    ('Office',          '🏢', 'Office supplies, co-working'),
    ('Personal Care',   '💇', 'Haircuts, beauty, grooming'),
    ('Home',            '🏠', 'Furniture, maintenance, cleaning'),
    ('Other',           '📦', 'Uncategorised expenses')
]

async def seed_categories():
    async with async_session() as session:
        for name, icon, description in CATEGORIES:
            result = await session.execute(select(Category).where(Category.name == name))
            existing = result.scalar_one_or_none()
            if not existing:
                cat = Category(name=name, icon=icon, description=description)
                session.add(cat)
                print(f"Added category: {name}")
            else:
                print(f"Category already exists: {name}")
        
        await session.commit()
        print("Categories seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_categories())
