-- Insert super_admin role for lshot.crypto@gmail.com
INSERT INTO user_roles (user_id, role)
VALUES ('4ba55b04-a94c-43d2-a746-fb9969dc0847', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;