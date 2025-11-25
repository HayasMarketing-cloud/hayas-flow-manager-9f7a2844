-- Asignar rol admin a ruben@hayas.es
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE p.email = 'ruben@hayas.es'
ON CONFLICT (user_id, role) DO NOTHING;