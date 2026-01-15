-- Insert Dummy Clients
-- Using existing client types: 'Lifestyle', 'Competition Prep', 'Strength & Conditioning'
WITH types AS (SELECT id, name FROM client_types)
INSERT INTO clients (name, email, phone, status, start_date, client_type_id, ghl_contact_id)
VALUES
('Sarah Johnson', 'sarah.j@example.com', '555-0101', 'active', NOW() - INTERVAL '30 days', (SELECT id FROM types WHERE name = 'Lifestyle' LIMIT 1), 'ghl_123'),
('Michael Chen', 'mike.chen@example.com', '555-0102', 'active', NOW() - INTERVAL '15 days', (SELECT id FROM types WHERE name = 'Competition Prep' LIMIT 1), 'ghl_124'),
('Emma Davis', 'emma.d@example.com', '555-0103', 'inactive', NOW() - INTERVAL '90 days', (SELECT id FROM types WHERE name = 'Strength & Conditioning' LIMIT 1), 'ghl_125')
ON CONFLICT (email) DO NOTHING;
