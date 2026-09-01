"""
Natural Language → SQL query engine with safety guardrails.
"""
import re
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from services.llm import call_llm
from schemas import QueryResponse

logger = logging.getLogger(__name__)

SCHEMA_DESCRIPTION = """
Database schema (PostgreSQL):

TABLE categories (id SERIAL PK, name VARCHAR, icon VARCHAR, description TEXT)
TABLE receipts (id SERIAL PK, user_id INT FK→users, merchant VARCHAR, total FLOAT, currency VARCHAR, receipt_date TIMESTAMP, status VARCHAR, created_at TIMESTAMP)
TABLE receipt_items (id SERIAL PK, receipt_id INT FK→receipts, category_id INT FK→categories, name VARCHAR, quantity FLOAT, unit_price FLOAT, total_price FLOAT, category_confidence FLOAT, created_at TIMESTAMP)

IMPORTANT RELATIONSHIPS:
- receipts.user_id → users.id
- receipt_items.receipt_id → receipts.id
- receipt_items.category_id → categories.id
"""

SQL_SYSTEM_PROMPT = f"""You are a SQL query generator for an expense tracking application.

{SCHEMA_DESCRIPTION}

Rules:
1. Generate ONLY SELECT queries — never INSERT, UPDATE, DELETE, DROP, ALTER, or any DDL/DML.
2. NEVER query the users table or any authentication-related data.
3. ALWAYS filter by receipts.user_id = :user_id for security (the user should only see their own data).
4. Use PostgreSQL syntax.
5. Return ONLY the SQL query, no explanations or markdown.
6. Use table aliases for readability.
7. Use appropriate aggregations (SUM, COUNT, AVG, GROUP BY) when the question implies summaries.
8. Limit results to 50 rows maximum.
"""

ANSWER_SYSTEM_PROMPT = """You are a helpful expense tracking assistant. Given a user's question and the SQL query results, provide a clear, conversational answer. Format numbers as currency where appropriate. Be concise."""

# Forbidden SQL patterns
FORBIDDEN_PATTERNS = [
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b",
    r"\b(INTO|SET)\b",
    r";\s*\w",  # Multiple statements
]

ALLOWED_TABLES = {"receipts", "receipt_items", "categories"}
DISALLOWED_TABLES = {"users"}


def _extract_tables(sql: str) -> set[str]:
    """
    Find table names referenced by FROM/JOIN clauses.
    Supports schema-qualified names and aliases.
    """
    table_refs = re.findall(r"\b(?:FROM|JOIN)\s+([a-zA-Z0-9_.\"]+)", sql, flags=re.IGNORECASE)
    tables = set()
    for ref in table_refs:
        # Strip quoting and schema (public.receipts -> receipts)
        cleaned = ref.replace('"', "").split(".")[-1].lower()
        tables.add(cleaned)
    return tables


def _has_user_scope(sql: str) -> bool:
    """Require explicit user scoping with user_id = :user_id."""
    patterns = [
        r"\b[a-zA-Z_][a-zA-Z0-9_]*\.user_id\s*=\s*:user_id\b",
        r"\buser_id\s*=\s*:user_id\b",
        r"\b:user_id\s*=\s*[a-zA-Z_][a-zA-Z0-9_]*\.user_id\b",
        r"\b:user_id\s*=\s*user_id\b",
    ]
    return any(re.search(pattern, sql, flags=re.IGNORECASE) for pattern in patterns)


def validate_sql(sql: str) -> tuple[bool, str]:
    """Ensure the generated SQL is a safe SELECT query."""
    sql_upper = sql.upper().strip()

    if not sql_upper.startswith("SELECT"):
        return False, "Only SELECT statements are allowed."

    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, sql_upper):
            return False, "Disallowed SQL operation detected."

    # No multiple statements
    if sql.count(";") > 1:
        return False, "Multiple SQL statements are not allowed."

    tables = _extract_tables(sql)
    if not tables:
        return False, "Could not determine query tables."
    if tables & DISALLOWED_TABLES:
        return False, "Access to restricted tables is not allowed."
    if not tables.issubset(ALLOWED_TABLES):
        return False, "Query references tables outside the allowed scope."

    # If receipt_items is queried, require a join to receipts for ownership filtering.
    if "receipt_items" in tables and "receipts" not in tables:
        return False, "receipt_items queries must join receipts for user scoping."

    if not _has_user_scope(sql):
        return False, "Missing required user_id security filter."

    return True, ""


async def run_nl_query(question: str, user_id: int, db: AsyncSession) -> QueryResponse:
    """Convert natural language to SQL, execute, and format results."""
    # Step 1: Generate SQL
    sql = await call_llm(
        system=SQL_SYSTEM_PROMPT,
        user_content=f"User question: {question}",
        temperature=0.1,
    )

    # Clean up
    sql = sql.strip().rstrip(";") + ";"
    sql = sql.replace("```sql", "").replace("```", "").strip()

    logger.info(f"[QueryEngine] Generated SQL: {sql}")

    # Enforce response size cap even if model forgets.
    if not re.search(r"\bLIMIT\s+\d+\b", sql, flags=re.IGNORECASE):
        sql = sql.rstrip(";") + " LIMIT 50;"
    else:
        sql = re.sub(
            r"\bLIMIT\s+\d+\b",
            "LIMIT 50",
            sql,
            count=1,
            flags=re.IGNORECASE,
        )

    # Step 2: Validate
    is_valid, reason = validate_sql(sql)
    if not is_valid:
        logger.warning(f"[QueryEngine] Rejected SQL: {reason} | SQL: {sql}")
        return QueryResponse(
            question=question,
            sql_generated=sql,
            answer="I'm sorry, I can only run read-only queries on your expense data. Please rephrase your question.",
            data=None,
        )

    # Step 3: Execute with user_id parameter
    try:
        result = await db.execute(text(sql), {"user_id": user_id})
        rows = result.fetchall()
        columns = list(result.keys())

        data = [dict(zip(columns, row)) for row in rows[:50]]

        # Convert non-serializable types
        for row in data:
            for key, value in row.items():
                if hasattr(value, "isoformat"):
                    row[key] = value.isoformat()
                elif isinstance(value, (float,)):
                    row[key] = round(value, 2)

    except Exception as e:
        logger.error(f"[QueryEngine] SQL execution error: {e}")
        return QueryResponse(
            question=question,
            sql_generated=sql,
            answer=f"I had trouble running that query. Could you rephrase your question?",
            data=None,
        )

    # Step 4: Format answer with LLM
    answer = await call_llm(
        system=ANSWER_SYSTEM_PROMPT,
        user_content=f"Question: {question}\n\nQuery results ({len(data)} rows):\n{str(data[:20])}",
        model=None,
        temperature=0.3,
    )

    return QueryResponse(
        question=question,
        sql_generated=sql,
        answer=answer,
        data=data,
    )
