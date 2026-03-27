import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from database import Base
import enum


class ReceiptStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    receipts = relationship("Receipt", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    icon = Column(String(50), default="📦")
    description = Column(Text, default="")

    items = relationship("ReceiptItem", back_populates="category")


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    merchant = Column(String(255), default="Unknown")
    total = Column(Float, default=0.0)
    currency = Column(String(10), default="AUD")
    receipt_date = Column(DateTime, nullable=True)
    raw_text = Column(Text, default="")
    structured_json = Column(Text, default="{}")
    image_path = Column(String(500), default="")
    status = Column(SAEnum(ReceiptStatus), default=ReceiptStatus.PENDING)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="receipts")
    # Keep line items in a stable order (creation/id order) across reloads.
    items = relationship(
        "ReceiptItem",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ReceiptItem.id.asc()",
    )


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    category_confidence = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    receipt = relationship("Receipt", back_populates="items")
    category = relationship("Category", back_populates="items")
