TAX_RATES = {
    "DE": 0.19,   
    "FR": 0.20,
    "NL": 0.21,  
}


def tax_cents(country: str, net_cents: int) -> int:
    return round(net_cents * TAX_RATES.get(country, 0.0))
