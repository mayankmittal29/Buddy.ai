from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.common.finance import (
    add_expense,
    add_subscription,
    check_budget_status,
    get_expense_summary,
    get_monthly_insights,
    get_savings_progress,
)
from app.core.db import AsyncSessionLocal
from app.core.models import (
    BillingCycle,
    Budget,
    Expense,
    SavingsEntry,
    SavingsGoal,
    Subscription,
)

router = APIRouter(prefix="/api/finance")


# ---- Expenses ----------------------------------------------------------


class ExpenseCreate(BaseModel):
    amount: float
    category: str
    note: str | None = None
    spent_at: date | None = None


class ExpenseOut(BaseModel):
    id: int
    amount: float
    category: str
    note: str | None
    spent_at: date

    model_config = {"from_attributes": True}


@router.get("/expenses", response_model=list[ExpenseOut])
async def list_expenses() -> list[ExpenseOut]:
    async with AsyncSessionLocal() as db:
        stmt = select(Expense).order_by(Expense.spent_at.desc(), Expense.id.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(data: ExpenseCreate) -> ExpenseOut:
    async with AsyncSessionLocal() as db:
        expense = await add_expense(
            db, data.amount, data.category, data.note, data.spent_at
        )
        await db.commit()
        await db.refresh(expense)
        return expense


@router.put("/expenses/{expense_id}", response_model=ExpenseOut)
async def update_expense(expense_id: int, data: ExpenseCreate) -> ExpenseOut:
    async with AsyncSessionLocal() as db:
        expense = await db.get(Expense, expense_id)
        if expense is None:
            raise HTTPException(
                status_code=404, detail=f"expense {expense_id} not found"
            )
        expense.amount = data.amount
        expense.category = data.category
        expense.note = data.note
        expense.spent_at = data.spent_at or expense.spent_at
        await db.commit()
        await db.refresh(expense)
        return expense


@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(expense_id: int) -> None:
    async with AsyncSessionLocal() as db:
        expense = await db.get(Expense, expense_id)
        if expense is None:
            raise HTTPException(
                status_code=404, detail=f"expense {expense_id} not found"
            )
        await db.delete(expense)
        await db.commit()


# ---- Budgets -------------------------------------------------------------


class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float


class BudgetOut(BaseModel):
    id: int
    category: str
    monthly_limit: float

    model_config = {"from_attributes": True}


@router.get("/budgets", response_model=list[BudgetOut])
async def list_budgets() -> list[BudgetOut]:
    async with AsyncSessionLocal() as db:
        stmt = select(Budget).order_by(Budget.category.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/budgets", response_model=BudgetOut, status_code=201)
async def create_budget(data: BudgetCreate) -> BudgetOut:
    async with AsyncSessionLocal() as db:
        budget = Budget(category=data.category, monthly_limit=data.monthly_limit)
        db.add(budget)
        await db.commit()
        await db.refresh(budget)
        return budget


@router.put("/budgets/{budget_id}", response_model=BudgetOut)
async def update_budget(budget_id: int, data: BudgetCreate) -> BudgetOut:
    async with AsyncSessionLocal() as db:
        budget = await db.get(Budget, budget_id)
        if budget is None:
            raise HTTPException(status_code=404, detail=f"budget {budget_id} not found")
        budget.category = data.category
        budget.monthly_limit = data.monthly_limit
        await db.commit()
        await db.refresh(budget)
        return budget


@router.delete("/budgets/{budget_id}", status_code=204)
async def delete_budget(budget_id: int) -> None:
    async with AsyncSessionLocal() as db:
        budget = await db.get(Budget, budget_id)
        if budget is None:
            raise HTTPException(status_code=404, detail=f"budget {budget_id} not found")
        await db.delete(budget)
        await db.commit()


# ---- Subscriptions ---------------------------------------------------------


class SubscriptionCreate(BaseModel):
    name: str
    amount: float
    billing_cycle: BillingCycle
    next_charge_at: date | None = None


class SubscriptionOut(BaseModel):
    id: int
    name: str
    amount: float
    billing_cycle: BillingCycle
    next_charge_at: date

    model_config = {"from_attributes": True}


@router.get("/subscriptions", response_model=list[SubscriptionOut])
async def list_subscriptions() -> list[SubscriptionOut]:
    async with AsyncSessionLocal() as db:
        stmt = select(Subscription).order_by(Subscription.next_charge_at.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/subscriptions", response_model=SubscriptionOut, status_code=201)
async def create_subscription(data: SubscriptionCreate) -> SubscriptionOut:
    async with AsyncSessionLocal() as db:
        subscription = await add_subscription(
            db, data.name, data.amount, data.billing_cycle, data.next_charge_at
        )
        await db.commit()
        await db.refresh(subscription)
        return subscription


@router.put("/subscriptions/{subscription_id}", response_model=SubscriptionOut)
async def update_subscription(
    subscription_id: int, data: SubscriptionCreate
) -> SubscriptionOut:
    async with AsyncSessionLocal() as db:
        subscription = await db.get(Subscription, subscription_id)
        if subscription is None:
            raise HTTPException(
                status_code=404, detail=f"subscription {subscription_id} not found"
            )
        subscription.name = data.name
        subscription.amount = data.amount
        subscription.billing_cycle = data.billing_cycle
        subscription.next_charge_at = data.next_charge_at or subscription.next_charge_at
        await db.commit()
        await db.refresh(subscription)
        return subscription


@router.delete("/subscriptions/{subscription_id}", status_code=204)
async def delete_subscription(subscription_id: int) -> None:
    async with AsyncSessionLocal() as db:
        subscription = await db.get(Subscription, subscription_id)
        if subscription is None:
            raise HTTPException(
                status_code=404, detail=f"subscription {subscription_id} not found"
            )
        await db.delete(subscription)
        await db.commit()


# ---- Savings goals ---------------------------------------------------------


class SavingsGoalCreate(BaseModel):
    title: str
    target_amount: float
    current_amount: float = 0
    target_date: date | None = None


class SavingsGoalOut(BaseModel):
    id: int
    title: str
    target_amount: float
    current_amount: float
    target_date: date | None

    model_config = {"from_attributes": True}


@router.get("/savings-goals", response_model=list[SavingsGoalOut])
async def list_savings_goals() -> list[SavingsGoalOut]:
    async with AsyncSessionLocal() as db:
        stmt = select(SavingsGoal).order_by(SavingsGoal.id.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/savings-goals", response_model=SavingsGoalOut, status_code=201)
async def create_savings_goal(data: SavingsGoalCreate) -> SavingsGoalOut:
    async with AsyncSessionLocal() as db:
        goal = SavingsGoal(
            title=data.title,
            target_amount=data.target_amount,
            current_amount=data.current_amount,
            target_date=data.target_date,
        )
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        return goal


@router.put("/savings-goals/{goal_id}", response_model=SavingsGoalOut)
async def update_savings_goal(goal_id: int, data: SavingsGoalCreate) -> SavingsGoalOut:
    async with AsyncSessionLocal() as db:
        goal = await db.get(SavingsGoal, goal_id)
        if goal is None:
            raise HTTPException(
                status_code=404, detail=f"savings goal {goal_id} not found"
            )
        goal.title = data.title
        goal.target_amount = data.target_amount
        goal.current_amount = data.current_amount
        goal.target_date = data.target_date
        await db.commit()
        await db.refresh(goal)
        return goal


@router.delete("/savings-goals/{goal_id}", status_code=204)
async def delete_savings_goal(goal_id: int) -> None:
    async with AsyncSessionLocal() as db:
        goal = await db.get(SavingsGoal, goal_id)
        if goal is None:
            raise HTTPException(
                status_code=404, detail=f"savings goal {goal_id} not found"
            )
        await db.delete(goal)
        await db.commit()


# ---- Savings entries (a simple ledger of completed savings) ---------------


class SavingsEntryCreate(BaseModel):
    name: str
    amount: float
    saved_at: date | None = None
    notes: str | None = None


class SavingsEntryOut(BaseModel):
    id: int
    name: str
    amount: float
    saved_at: date
    notes: str | None

    model_config = {"from_attributes": True}


@router.get("/savings-entries", response_model=list[SavingsEntryOut])
async def list_savings_entries() -> list[SavingsEntryOut]:
    async with AsyncSessionLocal() as db:
        stmt = select(SavingsEntry).order_by(
            SavingsEntry.saved_at.desc(), SavingsEntry.id.desc()
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/savings-entries", response_model=SavingsEntryOut, status_code=201)
async def create_savings_entry(data: SavingsEntryCreate) -> SavingsEntryOut:
    async with AsyncSessionLocal() as db:
        entry = SavingsEntry(
            name=data.name,
            amount=data.amount,
            saved_at=data.saved_at or date.today(),
            notes=data.notes,
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)
        return entry


@router.put("/savings-entries/{entry_id}", response_model=SavingsEntryOut)
async def update_savings_entry(
    entry_id: int, data: SavingsEntryCreate
) -> SavingsEntryOut:
    async with AsyncSessionLocal() as db:
        entry = await db.get(SavingsEntry, entry_id)
        if entry is None:
            raise HTTPException(
                status_code=404, detail=f"savings entry {entry_id} not found"
            )
        entry.name = data.name
        entry.amount = data.amount
        entry.saved_at = data.saved_at or entry.saved_at
        entry.notes = data.notes
        await db.commit()
        await db.refresh(entry)
        return entry


@router.delete("/savings-entries/{entry_id}", status_code=204)
async def delete_savings_entry(entry_id: int) -> None:
    async with AsyncSessionLocal() as db:
        entry = await db.get(SavingsEntry, entry_id)
        if entry is None:
            raise HTTPException(
                status_code=404, detail=f"savings entry {entry_id} not found"
            )
        await db.delete(entry)
        await db.commit()


# ---- Derived views (summary / budget status / insights) --------------------


@router.get("/summary")
async def expense_summary(month: str | None = None) -> dict:
    async with AsyncSessionLocal() as db:
        return await get_expense_summary(db, month)


@router.get("/budget-status/{category}")
async def budget_status(category: str) -> dict:
    async with AsyncSessionLocal() as db:
        return await check_budget_status(db, category)


@router.get("/savings-goals/{goal_id}/progress")
async def savings_progress(goal_id: int) -> dict:
    async with AsyncSessionLocal() as db:
        progress = await get_savings_progress(db, goal_id)
        if progress is None:
            raise HTTPException(
                status_code=404, detail=f"savings goal {goal_id} not found"
            )
        return progress


@router.get("/insights")
async def monthly_insights() -> dict:
    async with AsyncSessionLocal() as db:
        return await get_monthly_insights(db)
