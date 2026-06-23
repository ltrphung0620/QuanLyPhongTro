# AI Assistant business coverage

The assistant exposes text-safe business operations through registered tools.

## Covered domains

- Rooms: list, vacant/occupied search, detail by code or ID, create, update price/status.
- Tenants: list, detail by ID/name/phone/CCCD, create, update.
- Contracts: list, active/detail lookup, create, update, cancel, end, archive ended contracts.
- Meter readings: list/detail/missing lookup, create, update, delete, delete readings of an ended contract.
- Invoices: list/detail/payment-code lookup, single/bulk creation, payment state, fee updates, replacement, deletion, PDF.
- Income and expenses: list/detail, create, update, delete.
- Bank payments: list/detail, reconcile, delete.
- Reports: revenue, expense, profit/loss, payment status, sales ledger and sales-ledger PDF.

## Not text tools

- Authentication and OTP endpoints are interactive security flows.
- Realtime SSE and SePay webhook endpoints are infrastructure entry points.
- Meter image upload requires binary form data and stays in the dedicated UI.
- Preview endpoints are invoked internally by write tools before confirmation.
