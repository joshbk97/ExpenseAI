from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str = ""


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Categories ────────────────────────────────────────

class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str
    description: str

    model_config = {"from_attributes": True}


# ── Receipt Items ─────────────────────────────────────

class ReceiptItemOut(BaseModel):
    id: int
    name: str
    quantity: float
    unit_price: float
    total_price: float
    category_confidence: float
    category: Optional[CategoryOut] = None

    model_config = {"from_attributes": True}


class ReceiptItemUpdate(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    quantity: float = Field(..., ge=0)
    unit_price: float = Field(0, ge=0)
    category_id: Optional[int] = None


class ReceiptItemsUpdateRequest(BaseModel):
    items: List[ReceiptItemUpdate] = []
    deleted_item_ids: List[int] = []


class ManualReceiptItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    quantity: float = Field(1, gt=0)
    unit_price: float = Field(..., ge=0)
    category_id: Optional[int] = None


class ManualReceiptCreateRequest(BaseModel):
    merchant: str = Field(..., min_length=1, max_length=255)
    receipt_date: Optional[datetime] = None
    items: List[ManualReceiptItemCreate] = Field(..., min_length=1)


# ── Receipts ──────────────────────────────────────────

class ReceiptOut(BaseModel):
    id: int
    merchant: str
    total: float
    currency: str
    receipt_date: Optional[datetime]
    status: str
    image_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReceiptDetail(ReceiptOut):
    raw_text: str
    structured_json: str
    items: List[ReceiptItemOut] = []


class ReceiptListResponse(BaseModel):
    receipts: List[ReceiptOut]
    total: int
    page: int
    page_size: int


# ── Expenses ──────────────────────────────────────────

class ExpenseSummary(BaseModel):
    total_spent: float
    receipt_count: int
    item_count: int
    avg_receipt: float
    top_merchant: Optional[str] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class CategorySpending(BaseModel):
    category_name: str
    category_icon: str
    total: float
    item_count: int
    percentage: float


class SpendingTrend(BaseModel):
    date: str
    total: float
    receipt_count: int


# ── NL Query ──────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


class QueryResponse(BaseModel):
    question: str
    sql_generated: str
    answer: str
    data: Optional[List[dict]] = None


# ── Insights ──────────────────────────────────────────

class InsightResponse(BaseModel):
    insights: List[str]
    generated_at: datetime
    data_summary: dict
