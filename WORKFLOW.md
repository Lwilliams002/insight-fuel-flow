# Titan Prime CRM - Deal Workflow

## Owner's Workflow Requirements (Updated Feb 2026)

This document outlines the complete deal workflow based on the owner's requirements.

**Implementation Status:** ✅ Complete (Native App + Web App updated)

---

## Workflow Phases & Steps

### PHASE 1: SIGN (Blue)

| Step | Status | Who | Action | Description |
|------|--------|-----|--------|-------------|
| 1 | `lead` | Rep | Upload Photos | Knock on door, inspect roof, take photos, show homeowner inspection report |
| 2 | `inspection_scheduled` | Rep | File Claim | File claim with insurance (get adjuster info, schedule adjuster appt, get claim info), sign agreement |
| 3 | `claim_filed` | Rep | Meet Adjuster | Meet adjuster at appointment |
| 4 | `signed` | Rep | Wait | Wait for insurance decision |
| 5 | `adjuster_met` | Rep | Upload Loss Statement | Upload loss statement from insurance |
| 6 | `awaiting_approval` | Admin | Approve Financials | Admin reviews & approves financials (RCV, ACV, deductible, depreciation) |

### PHASE 2: BUILD (Orange)

| Step | Status | Who | Action | Description |
|------|--------|-----|--------|-------------|
| 7 | `approved` | Rep | Collect ACV | Collect ACV payment from homeowner, upload receipt |
| 8 | `acv_collected` | Rep | Collect Deductible | Collect deductible from homeowner, upload receipt |
| 9 | `deductible_collected` | Rep | Select Materials | Pick roof materials/colors with homeowner |
| 10 | `materials_selected` | Admin | Schedule Install | Admin schedules installation with crew |
| 11 | `install_scheduled` | Crew | Install | Crew installs, takes progress + completion photos |
| 12 | `installed` | Rep | Get Signature | Have homeowner sign installation completion form |

### PHASE 3: FINALIZING (Yellow)

| Step | Status | Who | Action | Description |
|------|--------|-----|--------|-------------|
| 13 | `completion_signed` | Admin | Send Invoice | Send final invoice to insurance (if depreciation to collect) |
| 14 | `invoice_sent` | Rep | Collect Depreciation | Collect depreciation payment from homeowner, give receipt + roof certificate |
| 15 | `depreciation_collected` | Rep | Request Commission | All payments collected, request commission |

### PHASE 4: COMPLETE (Green)

| Step | Status | Who | Action | Description |
|------|--------|-----|--------|-------------|
| 16 | `complete` | Admin | Approve Commission | Review and approve commission payment |
| 17 | `paid` | System | Done | Commission paid to rep |

---

## Key Business Rules

### Admin Approval Gates
- **`awaiting_approval`**: Admin must approve financials (RCV, ACV, deductible, depreciation) before deal moves to approved
- **`materials_selected`**: Admin schedules install
- **`completion_signed`**: Admin generates and sends invoice
- **`complete`**: Admin approves commission payment

### Rep Actions
- Upload inspection photos
- File insurance claim
- Get agreement signed
- Meet adjuster
- Collect payments (ACV, deductible, depreciation)
- Get completion form signed
- Request commission

### Receipts Generated
1. **ACV Receipt** - When collecting ACV payment
2. **Deductible Receipt** - When collecting deductible
3. **Depreciation Receipt** - When collecting final depreciation payment (includes roof certificate)

### Documents Required
- Inspection photos
- Loss statement (from insurance)
- Signed agreement
- Installation completion form (signed by homeowner)
- Final invoice (to insurance)

---

## Database Status Values

```sql
-- New statuses added in migration 007
'lead'
'inspection_scheduled'
'claim_filed'
'signed'
'adjuster_met'
'awaiting_approval'  -- NEW
'approved'
'acv_collected'      -- renamed from collect_acv
'deductible_collected' -- renamed from collect_deductible
'materials_selected' -- NEW
'install_scheduled'
'installed'
'completion_signed'  -- NEW
'invoice_sent'
'depreciation_collected'
'complete'
'paid'
```

---

## Future: Crew Portal

After completion:
- Crew can request payment after submitting completion photos
- Crew leader login to see their install schedule
