-- Development seed. Loaded by `npx supabase db reset` (config.toml [db.seed]),
-- never by the test suite, which arranges its own fixtures.
--
-- Real pool-trade names and plausible Tarragona prices, so screens are built
-- against something that looks like the job rather than "Test Item 1".
-- Prices are what the client is charged, with no VAT: the business quotes
-- gross figures today (see the spec's pricing section).
--
-- Not idempotent by design: it assumes an empty database. Re-run it with
-- `npx supabase db reset`, not by applying this file twice.

insert into public.price_book_groups (name, position) values
  ('Movimiento de tierras', 1),
  ('Estructura',            2),
  ('Revestimiento',         3),
  ('Depuracion',            4),
  ('Iluminacion',           5),
  ('Mano de obra',          6),
  ('Mantenimiento',         7);

insert into public.price_book_items (group_id, code, name, description, unit, unit_cost, unit_price)
select g.id, v.code, v.name, v.description, v.unit::unit_type, v.cost, v.price
from (values
  ('Movimiento de tierras', 'EXC-001', 'Excavacion vaso piscina',   'Excavacion con retroexcavadora y retirada de tierras', 'm2',   28.00,  48.00),
  ('Movimiento de tierras', 'EXC-002', 'Transporte de tierras',     'Portes a vertedero autorizado',                        'lot', 220.00, 380.00),
  ('Estructura',            'EST-001', 'Hormigon gunitado',         'Proyeccion de hormigon, espesor 15 cm',                'm2',   62.00, 105.00),
  ('Estructura',            'EST-002', 'Encofrado y ferralla',      'Armado de muros y solera',                             'm2',   34.00,  58.00),
  ('Revestimiento',         'REV-001', 'Gresite 2,5x2,5',           'Colocacion de gresite, incluye material',              'm2',   18.00,  32.50),
  ('Revestimiento',         'REV-002', 'Borada',                    'Rejuntado epoxi de gresite',                           'm2',    6.50,  12.00),
  ('Revestimiento',         'REV-003', 'Coronacion piedra natural', 'Remate perimetral en piedra',                          'ml',   26.00,  45.00),
  ('Depuracion',            'DEP-001', 'Depuradora 8 m3/h',         'Bomba y filtro de arena, instalados',                  'unit', 480.00, 790.00),
  ('Depuracion',            'DEP-002', 'Clorador salino',           'Electrolisis salina hasta 75 m3',                      'unit', 620.00, 980.00),
  ('Iluminacion',           'ILU-001', 'Foco LED blanco',           'Foco empotrado 18 W con nicho',                        'unit',  60.00, 145.00),
  ('Iluminacion',           'ILU-002', 'Foco LED RGB',              'Foco de color con mando',                              'unit',  95.00, 210.00),
  ('Mano de obra',          'MDO-001', 'Oficial de primera',        'Hora de oficial',                                      'hour',  19.00,  35.00),
  ('Mano de obra',          'MDO-002', 'Peon',                      'Hora de peon',                                         'hour',  14.00,  26.00),
  ('Mantenimiento',         'MAN-001', 'Mantenimiento mensual',     'Limpieza, analisis y ajuste de producto',              'unit',  45.00,  90.00),
  ('Mantenimiento',         'MAN-002', 'Invernaje',                 'Preparacion de la piscina para el invierno',           'lot',  110.00, 195.00)
) as v(group_name, code, name, description, unit, cost, price)
join public.price_book_groups g on g.name = v.group_name;

insert into public.clients (email, full_name, phone, address, city, postal_code) values
  ('ana.ruiz@example.test',    'Ana Ruiz Mora',       '655112233', 'Carrer de Sant Joan 14', 'Reus',     '43201'),
  ('jordi.pons@example.test',  'Jordi Pons Vila',     '655445566', 'Avinguda Diagonal 3',    'Cambrils', '43850'),
  ('marta.sole@example.test',  'Marta Sole Ferrer',   '655778899', 'Carrer del Mar 27',      'Salou',    '43840');
