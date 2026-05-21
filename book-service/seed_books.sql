-- Seed: Sample books
INSERT INTO books (name, author, isbn, publication_date, genre, status) VALUES
  ('Clean Architecture', 'Robert C. Martin', '978-0134494166', '2017-09-10', 'Software', 'AVAILABLE'),
  ('Design Patterns', 'Gang of Four', '978-0201633610', '1994-10-31', 'Software', 'AVAILABLE'),
  ('Dune', 'Frank Herbert', '978-0441172719', '1965-08-01', 'Fiction', 'AVAILABLE'),
  ('Sapiens', 'Yuval Noah Harari', '978-0062316097', '2011-01-01', 'History', 'AVAILABLE'),
  ('The Pragmatic Programmer', 'David Thomas', '978-0135957059', '2019-09-23', 'Software', 'AVAILABLE')
ON CONFLICT DO NOTHING;

-- Seed: Corresponding events (GET /books reads from events table)
INSERT INTO events (event_type, version, timestamp, data) VALUES
  ('BookAdded', '1.0', '2026-01-01T00:00:00.000Z', '{"bookId":1,"name":"Clean Architecture","author":"Robert C. Martin","isbn":"978-0134494166","genre":"Software","status":"AVAILABLE"}'),
  ('BookAdded', '1.0', '2026-01-01T00:01:00.000Z', '{"bookId":2,"name":"Design Patterns","author":"Gang of Four","isbn":"978-0201633610","genre":"Software","status":"AVAILABLE"}'),
  ('BookAdded', '1.0', '2026-01-01T00:02:00.000Z', '{"bookId":3,"name":"Dune","author":"Frank Herbert","isbn":"978-0441172719","genre":"Fiction","status":"AVAILABLE"}'),
  ('BookAdded', '1.0', '2026-01-01T00:03:00.000Z', '{"bookId":4,"name":"Sapiens","author":"Yuval Noah Harari","isbn":"978-0062316097","genre":"History","status":"AVAILABLE"}'),
  ('BookAdded', '1.0', '2026-01-01T00:04:00.000Z', '{"bookId":5,"name":"The Pragmatic Programmer","author":"David Thomas","isbn":"978-0135957059","genre":"Software","status":"AVAILABLE"}');
