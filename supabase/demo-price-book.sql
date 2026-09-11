-- A full catalogue for looking at the admin screens on a local database.
--
-- NOT part of supabase/seed.sql on purpose. `supabase db reset` runs the seed
-- before every integration and e2e run, and those tests assert on what the
-- catalogue holds and on which page a row lands; seventy more concepts would
-- break them. Run this by hand against the local container when you want a
-- realistic screen to look at:
--
--   psql "$(npx supabase status -o json | jq -r .DB_URL)" -f supabase/demo-price-book.sql
--
-- Never against the hosted project: the prices below are invented.
--
-- Re-runnable. Groups are matched by name and items by code, so running it
-- twice updates rather than duplicates.

insert into public.price_book_groups (name, position) values
  ('Movimiento de tierras',  1),
  ('Estructura',             2),
  ('Revestimiento',          3),
  ('Depuracion',             4),
  ('Climatizacion',          5),
  ('Iluminacion',            6),
  ('Seguridad',              7),
  ('Accesorios',             8),
  ('Mano de obra',           9),
  ('Mantenimiento',         10)
on conflict (name) do update set position = excluded.position;

insert into public.price_book_items
  (group_id, code, name, description, unit, unit_cost, unit_price, is_active)
select g.id, v.code, v.name, v.description, v.unit::unit_type, v.cost, v.price, v.active
from (values
  ('Movimiento de tierras', 'EXC-001', 'Excavacion vaso piscina',      'Excavacion con retroexcavadora y retirada de tierras',   'm2',    28.00,   48.00, true),
  ('Movimiento de tierras', 'EXC-002', 'Transporte de tierras',        'Portes a vertedero autorizado',                         'lot',  220.00,  380.00, true),
  ('Movimiento de tierras', 'EXC-003', 'Replanteo y nivelacion',       'Marcado del vaso y cotas de referencia',                'lot',   90.00,  165.00, true),
  ('Movimiento de tierras', 'EXC-004', 'Excavacion en roca',           'Martillo hidraulico, terreno duro',                     'm2',    62.00,  110.00, true),
  ('Movimiento de tierras', 'EXC-005', 'Zanja de instalaciones',       'Zanja para hidraulica y electricidad',                  'ml',     9.00,   18.00, true),
  ('Movimiento de tierras', 'EXC-006', 'Relleno perimetral',           'Zahorra compactada alrededor del vaso',                 'm2',    14.00,   26.00, true),
  ('Movimiento de tierras', 'EXC-007', 'Retirada de piscina antigua',  'Demolicion de vaso existente y escombros',              'lot', 1450.00, 2300.00, true),

  ('Estructura',            'EST-001', 'Hormigon gunitado',            'Proyeccion de hormigon, espesor 15 cm',                 'm2',    62.00,  105.00, true),
  ('Estructura',            'EST-002', 'Encofrado y ferralla',         'Armado de muros y solera',                              'm2',    34.00,   58.00, true),
  ('Estructura',            'EST-003', 'Solera de limpieza',           'Capa de hormigon de nivelacion',                        'm2',    12.00,   22.00, true),
  ('Estructura',            'EST-004', 'Muro de bloque de hormigon',   'Bloque de 20 relleno y armado',                         'm2',    41.00,   72.00, true),
  ('Estructura',            'EST-005', 'Impermeabilizacion de vaso',   'Lamina impermeable con refuerzo de angulos',            'm2',    16.00,   31.00, true),
  ('Estructura',            'EST-006', 'Skimmer empotrado',            'Skimmer estandar con tapa, instalado',                  'unit',  48.00,   95.00, true),
  ('Estructura',            'EST-007', 'Boquilla de impulsion',        'Boquilla orientable de pared',                          'unit',  14.00,   29.00, true),
  ('Estructura',            'EST-008', 'Sumidero de fondo',            'Sumidero antivortice normalizado',                      'unit',  52.00,  105.00, true),
  ('Estructura',            'EST-009', 'Rebosadero perimetral',        'Canal de rebose tipo infinity',                         'ml',    88.00,  158.00, true),
  ('Estructura',            'EST-010', 'Escalera romana de obra',      'Peldanos de obra integrados en el vaso',                'lot',  520.00,  890.00, true),

  ('Revestimiento',         'REV-001', 'Gresite 2,5x2,5',              'Colocacion de gresite, incluye material',               'm2',    18.00,   32.50, true),
  ('Revestimiento',         'REV-002', 'Borada',                       'Rejuntado epoxi de gresite',                            'm2',     6.50,   12.00, true),
  ('Revestimiento',         'REV-003', 'Coronacion piedra natural',    'Remate perimetral en piedra',                           'ml',    26.00,   45.00, true),
  ('Revestimiento',         'REV-004', 'Coronacion porcelanica',       'Remate perimetral porcelanico rectificado',             'ml',    21.00,   38.00, true),
  ('Revestimiento',         'REV-005', 'Liner armado 150 micras',      'Lamina armada soldada in situ',                         'm2',    24.00,   44.00, true),
  ('Revestimiento',         'REV-006', 'Liner armado antideslizante',  'Zona de playa y escaleras',                             'm2',    29.00,   52.00, true),
  ('Revestimiento',         'REV-007', 'Microcemento de vaso',         'Acabado continuo con sellado',                          'm2',    38.00,   68.00, true),
  ('Revestimiento',         'REV-008', 'Pintura clorocaucho',          'Dos manos sobre vaso preparado',                        'm2',     7.50,   15.00, true),
  ('Revestimiento',         'REV-009', 'Playa de piedra natural',      'Pavimento perimetral, incluye material',                'm2',    34.00,   62.00, true),
  ('Revestimiento',         'REV-010', 'Gresite veneciano',            'Mosaico de vidrio de alta gama',                        'm2',    46.00,   84.00, true),
  ('Revestimiento',         'REV-011', 'Gresite 5x5 economico',        'Descatalogado por el fabricante',                       'm2',    13.00,   24.00, false),

  ('Depuracion',            'DEP-001', 'Depuradora 8 m3/h',            'Bomba y filtro de arena, instalados',                   'unit', 480.00,  790.00, true),
  ('Depuracion',            'DEP-002', 'Clorador salino',              'Electrolisis salina hasta 75 m3',                       'unit', 620.00,  980.00, true),
  ('Depuracion',            'DEP-003', 'Depuradora 14 m3/h',           'Equipo para vasos de mas de 60 m3',                     'unit', 760.00, 1240.00, true),
  ('Depuracion',            'DEP-004', 'Bomba de velocidad variable',  'Bomba con variador, ahorro de consumo',                 'unit', 540.00,  890.00, true),
  ('Depuracion',            'DEP-005', 'Filtro de vidrio filtrante',   'Carga de vidrio en sustitucion de arena',               'unit', 210.00,  360.00, true),
  ('Depuracion',            'DEP-006', 'Cuadro electrico de piscina',  'Cuadro con proteccion diferencial y reloj',             'unit', 185.00,  330.00, true),
  ('Depuracion',            'DEP-007', 'Caseta tecnica enterrada',     'Arqueta prefabricada con tapa',                         'unit', 420.00,  690.00, true),
  ('Depuracion',            'DEP-008', 'Control de pH automatico',     'Dosificador con sonda y deposito',                      'unit', 340.00,  580.00, true),
  ('Depuracion',            'DEP-009', 'Tuberia PVC 63 mm',            'Tramo instalado con accesorios',                        'ml',     8.00,   16.00, true),
  ('Depuracion',            'DEP-010', 'Valvula selectora 6 vias',     'Recambio de valvula de filtro',                         'unit',  78.00,  140.00, true),

  ('Climatizacion',         'CLI-001', 'Bomba de calor 9 kW',          'Climatizacion para vasos de hasta 40 m3',               'unit', 980.00, 1560.00, true),
  ('Climatizacion',         'CLI-002', 'Bomba de calor 14 kW',         'Climatizacion para vasos de hasta 70 m3',               'unit',1320.00, 2050.00, true),
  ('Climatizacion',         'CLI-003', 'Manta termica de burbujas',    'Cobertor de verano a medida',                           'm2',    11.00,   22.00, true),
  ('Climatizacion',         'CLI-004', 'Enrollador de manta',          'Enrollador de aluminio con ruedas',                     'unit', 260.00,  430.00, true),
  ('Climatizacion',         'CLI-005', 'Instalacion de bomba de calor','Conexionado hidraulico y electrico',                    'lot',  280.00,  470.00, true),

  ('Iluminacion',           'ILU-001', 'Foco LED blanco',              'Foco empotrado 18 W con nicho',                         'unit',  60.00,  145.00, true),
  ('Iluminacion',           'ILU-002', 'Foco LED RGB',                 'Foco de color con mando',                               'unit',  95.00,  210.00, true),
  ('Iluminacion',           'ILU-003', 'Proyector LED plano',          'Foco de superficie sin nicho',                          'unit',  72.00,  158.00, true),
  ('Iluminacion',           'ILU-004', 'Transformador 100 VA',         'Transformador estanco para focos',                      'unit',  58.00,  115.00, true),
  ('Iluminacion',           'ILU-005', 'Iluminacion perimetral LED',   'Tira LED exterior en coronacion',                       'ml',    18.00,   36.00, true),
  ('Iluminacion',           'ILU-006', 'Foco halogeno 300 W',          'Sustituido por LED, no se instala',                     'unit',  34.00,   78.00, false),

  ('Seguridad',             'SEG-001', 'Valla de proteccion',          'Valla desmontable con malla, altura 120 cm',            'ml',    42.00,   78.00, true),
  ('Seguridad',             'SEG-002', 'Cobertor de seguridad',        'Lona de barras con anclajes',                           'm2',    38.00,   68.00, true),
  ('Seguridad',             'SEG-003', 'Alarma de inmersion',          'Deteccion perimetral con sirena',                       'unit', 240.00,  420.00, true),
  ('Seguridad',             'SEG-004', 'Cobertor automatico sumergido','Persiana motorizada en foso',                           'm2',   165.00,  285.00, true),
  ('Seguridad',             'SEG-005', 'Ducha exterior de aluminio',   'Ducha solar con base',                                  'unit', 190.00,  330.00, true),

  ('Accesorios',            'ACC-001', 'Escalera inox 3 peldanos',     'Escalera de acero inoxidable AISI 316',                 'unit', 165.00,  290.00, true),
  ('Accesorios',            'ACC-002', 'Escalera inox 4 peldanos',     'Escalera de acero inoxidable AISI 316',                 'unit', 195.00,  340.00, true),
  ('Accesorios',            'ACC-003', 'Limpiafondos automatico',      'Robot electrico con carro',                             'unit', 540.00,  890.00, true),
  ('Accesorios',            'ACC-004', 'Kit de limpieza manual',       'Recogehojas, cepillo y pertiga',                        'unit',  48.00,   95.00, true),
  ('Accesorios',            'ACC-005', 'Trampolin de fibra',           'Trampolin con base, 2 m',                               'unit', 380.00,  640.00, true),
  ('Accesorios',            'ACC-006', 'Fuente cascada inox',          'Lamina de agua de 60 cm',                               'unit', 280.00,  480.00, true),
  ('Accesorios',            'ACC-007', 'Toma de limpiafondos',         'Conexion empotrada en pared',                           'unit',  22.00,   46.00, true),

  ('Mano de obra',          'MDO-001', 'Oficial de primera',           'Hora de oficial',                                       'hour',  19.00,   35.00, true),
  ('Mano de obra',          'MDO-002', 'Peon',                         'Hora de peon',                                          'hour',  14.00,   26.00, true),
  ('Mano de obra',          'MDO-003', 'Oficial fontanero',            'Hora de fontaneria especializada',                      'hour',  22.00,   40.00, true),
  ('Mano de obra',          'MDO-004', 'Oficial electricista',         'Hora de electricidad especializada',                    'hour',  23.00,   42.00, true),
  ('Mano de obra',          'MDO-005', 'Desplazamiento a obra',        'Desplazamiento dentro del Baix Camp',                   'unit',  18.00,   35.00, true),
  ('Mano de obra',          'MDO-006', 'Hora de maquinaria',           'Retroexcavadora con operario',                          'hour',  48.00,   82.00, true),

  ('Mantenimiento',         'MAN-001', 'Mantenimiento mensual',        'Limpieza, analisis y ajuste de producto',               'unit',  45.00,   90.00, true),
  ('Mantenimiento',         'MAN-002', 'Invernaje',                    'Preparacion de la piscina para el invierno',            'lot',  110.00,  195.00, true),
  ('Mantenimiento',         'MAN-003', 'Puesta en marcha de temporada','Arranque, limpieza y equilibrado del agua',             'lot',  130.00,  230.00, true),
  ('Mantenimiento',         'MAN-004', 'Cambio de arena del filtro',   'Vaciado, carga nueva y puesta en marcha',               'unit', 120.00,  215.00, true),
  ('Mantenimiento',         'MAN-005', 'Tratamiento de choque',        'Correccion de agua verde',                              'lot',   65.00,  125.00, true),
  ('Mantenimiento',         'MAN-006', 'Deteccion de fugas',           'Prueba de presion y localizacion',                      'lot',  180.00,  320.00, true),
  ('Mantenimiento',         'MAN-007', 'Cloro en pastillas 5 kg',      'Bote de 5 kg de tricloro',                              'unit',  22.00,   42.00, true),
  ('Mantenimiento',         'MAN-008', 'Reductor de pH 20 l',          'Garrafa de 20 litros',                                  'unit',  19.00,   36.00, true),
  ('Mantenimiento',         'MAN-009', 'Alguicida 5 l',                'Garrafa de 5 litros',                                   'unit',  14.00,   28.00, true),
  ('Mantenimiento',         'MAN-010', 'Sal para electrolisis 25 kg',  'Saco de 25 kg',                                         'unit',   9.00,   18.00, true)
) as v(group_name, code, name, description, unit, cost, price, active)
join public.price_book_groups g on g.name = v.group_name
on conflict (code) do update set
  group_id    = excluded.group_id,
  name        = excluded.name,
  description = excluded.description,
  unit        = excluded.unit,
  unit_cost   = excluded.unit_cost,
  unit_price  = excluded.unit_price,
  is_active   = excluded.is_active;
