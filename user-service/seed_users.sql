-- Seed: Sample users
INSERT INTO users (user_id, username, email, city, preferences) VALUES
  ('00000000-0000-0000-0000-000000000001', 'veera', 'veera@example.com', 'Helsinki', '{"genres": ["Software", "Fiction"]}'),
  ('00000000-0000-0000-0000-000000000002', 'mikko', 'mikko@example.com', 'Tampere', '{"genres": ["Science", "History"]}'),
  ('00000000-0000-0000-0000-000000000003', 'anna', 'anna@example.com', 'Turku', '{"genres": ["Fantasy", "Philosophy"]}')
ON CONFLICT DO NOTHING;
