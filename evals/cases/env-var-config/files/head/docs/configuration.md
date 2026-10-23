# Configuration

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port |
| `DATABASE_URL` | yes | | Postgres connection string |
| `PAYMENTS_URL` | no | `https://api.payments.example.com` | Payment provider API |
| `PAYMENTS_API_KEY` | yes | | Payment provider secret key |
| `PAYMENTS_TIMEOUT_MS` | no | `5000` | How long a refund request may take before it's aborted |
