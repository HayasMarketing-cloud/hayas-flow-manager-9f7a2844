

## Plan: Assign Tomas to Asendia USA as PM

### Problem
Tomás White (`c3f5376d`) is PM on several budgets for ASENDIA HQ, and has a `client_assignments` record for that client. However, he has no assignment for **Asendia USA Inc** (`30662760-7724-40a5-8b4b-675b353c29a3`), so he cannot see any budgets for that client.

The two Asendia USA budgets (PRE-2026-027 "New HubDB Table USA" and PRE-2026-005 "Newsletter Q4 USA") were created by Iolanda with herself as both AM and PM.

### Changes

**Database migration** — Insert a `client_assignments` record linking Tomás to Asendia USA Inc as PM:

```sql
INSERT INTO public.client_assignments (user_id, client_id, role)
VALUES (
  'c3f5376d-dcc1-46bd-92ef-c5012db6e241',  -- Tomás White
  '30662760-7724-40a5-8b4b-675b353c29a3',  -- Asendia USA Inc
  'pm'
)
ON CONFLICT DO NOTHING;
```

This will give Tomás visibility over all budgets, contracts, and requests for Asendia USA Inc, matching the existing pattern used for ASENDIA HQ.

If Iolanda also needs to update the `pm_user_id` on specific Asendia USA budgets from herself to Tomás, that can be done via the budget edit modal in the UI.

