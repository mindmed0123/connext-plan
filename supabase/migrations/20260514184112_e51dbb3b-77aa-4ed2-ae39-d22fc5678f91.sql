UPDATE public.assinaturas
SET status = 'active',
    periodo = 'anual',
    plano_id = 'ecc8c2e9-d055-43fd-986d-4f90c58fa8f2',
    cakto_subscription_id = '2cfc80c0-594b-42fd-8628-ebb109504801',
    current_period_start = '2026-05-14T18:28:29Z',
    current_period_end = '2027-05-14T18:28:29Z',
    cancel_at_period_end = false,
    updated_at = now()
WHERE empresa_id = '0a8bcb02-b61f-47b5-b79a-a36e6b76dd18';

UPDATE public.billing_events
SET empresa_id = '0a8bcb02-b61f-47b5-b79a-a36e6b76dd18',
    cakto_subscription_id = '2cfc80c0-594b-42fd-8628-ebb109504801'
WHERE event_id = 'b2d53c87-73cc-4940-8f49-c24f7c633a64';