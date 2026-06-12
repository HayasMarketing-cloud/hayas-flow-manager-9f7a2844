---
name: Client price visibility on requests
description: Sale/price-to-client fields on requests are visible and editable only by admin/finanzas; other roles see specialist cost only
type: feature
---
Request client-price fields (`sale_type`, `unit_price`, `sale_rate`, `sale_hours`, `sale_amount`) are hidden in `RequestFormModal`, `SolicitudDetalle` (financial tab Sale + Margin cards), and `RequestCard` for any role other than admin/finanzas. On submit by non-finance roles, those fields are omitted from the payload so existing values are preserved on update. PMs/AMs/Specialists still see specialist cost. Data flow from budgets/contracts is unaffected since those origins are managed by admin/finanzas.
