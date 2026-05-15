-- Forcefully override the admin password to a known hash (password123)
-- This ensures the pre-filled UI credentials will securely authenticate.
UPDATE users 
SET password_hash = '$2a$10$1j01ZdBroNvdR4azs0QxZOsQv5OYpPVQySHqqawtUivobEEeKoZ5u' 
WHERE email = 'admin@coatzadroneusa.com';
