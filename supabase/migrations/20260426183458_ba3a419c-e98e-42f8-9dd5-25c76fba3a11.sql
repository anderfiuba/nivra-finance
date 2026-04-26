UPDATE public.pluggy_items
SET last_sync_warning = 'Saldos da conta: limite mensal do Open Finance atingido pelo banco para o seu CPF nesta instituição (reseta no início do próximo mês); Extrato da conta corrente: limite mensal do Open Finance atingido pelo banco para o seu CPF nesta instituição (reseta no início do próximo mês)'
WHERE pluggy_item_id = '17002738-4aaf-4d80-ba3c-98a4dd68a3b6'
  AND execution_status = 'PARTIAL_SUCCESS'
  AND last_sync_warning IS NOT NULL
  AND last_sync_warning NOT LIKE '%limite mensal%';