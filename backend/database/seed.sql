-- Development/demo data only. Never run this against production.
INSERT INTO stations (id, name, city, capacity, geom) VALUES
  ('MUM-01', 'Bandra Linking Road', 'Mumbai', 18, ST_SetSRID(ST_MakePoint(72.8295, 19.0596), 4326)::geography),
  ('MUM-02', 'BKC Metro Hub', 'Mumbai', 20, ST_SetSRID(ST_MakePoint(72.8695, 19.0648), 4326)::geography),
  ('PUN-01', 'FC Road Junction', 'Pune', 16, ST_SetSRID(ST_MakePoint(73.8418, 18.5209), 4326)::geography),
  ('PUN-02', 'Koregaon Park Gate', 'Pune', 18, ST_SetSRID(ST_MakePoint(73.8931, 18.5362), 4326)::geography),
  ('BLR-01', 'Indiranagar Metro', 'Bengaluru', 14, ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326)::geography),
  ('BLR-02', 'Cubbon Park East', 'Bengaluru', 22, ST_SetSRID(ST_MakePoint(77.6065, 12.9741), 4326)::geography)
ON CONFLICT (id) DO NOTHING;

INSERT INTO bicycles (id, station_id, battery_level, network_status, is_locked, health, geom) VALUES
  ('bbbbbbbb-1111-1111-1111-111111111111', 'MUM-01', 100, 'ONLINE', TRUE, 'Good', ST_SetSRID(ST_MakePoint(73.8160, 15.9010), 4326)::geography),
  ('VS-2048', 'MUM-02', 92, 'ONLINE', TRUE, 'Good', ST_SetSRID(ST_MakePoint(72.8695, 19.0648), 4326)::geography),
  ('VS-1842', 'PUN-01', 78, 'ONLINE', TRUE, 'Good', ST_SetSRID(ST_MakePoint(73.8418, 18.5209), 4326)::geography)
ON CONFLICT (id) DO NOTHING;
