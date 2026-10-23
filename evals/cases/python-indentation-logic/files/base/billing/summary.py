from dataclasses import dataclass


@dataclass
class LineItem:
    name: str
    price_cents: int
    quantity: int
    active: bool


def order_summary(items: list[LineItem]) -> dict[str, int]:
    """Totals for the order page: what the customer pays and how many items that covers."""
    total = 0
    count = 0
    for item in items:
        if item.active:
            total += item.price_cents * item.quantity
            count += item.quantity
    return {"total_cents": total, "item_count": count}


def is_free_shipping(items: list[LineItem], threshold_cents: int = 5000) -> bool:
    return order_summary(items)["total_cents"] >= threshold_cents
