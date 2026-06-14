DO $$
DECLARE
  admin_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      is_super_admin, is_sso_user, is_anonymous
  ) VALUES (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'turgaydolu23@gmail.com', extensions.crypt('password123', extensions.gen_salt('bf')), NOW(),
      '{"provider": "email", "providers": ["email"]}', '{"display_name": "Admin"}', NOW(), NOW(),
      false, false, false
  );
  
  INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
      gen_random_uuid(), admin_id, admin_id::text, json_build_object('sub', admin_id::text, 'email', 'turgaydolu23@gmail.com'),
      'email', NOW(), NOW(), NOW()
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
