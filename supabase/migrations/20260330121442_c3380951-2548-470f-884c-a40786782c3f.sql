UPDATE public.sales_commissions 
SET liquidation_id = '07e2fe71-512d-4d10-a7ed-c274d6edbfdc'
WHERE id IN ('99778366-3b58-4835-a1c1-dee285a05da7', '013ebc8b-eb53-4ae4-acb0-f50ae3d24c44')
AND liquidation_id IS NULL;