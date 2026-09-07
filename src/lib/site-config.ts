// Shared copy and structured content for the Piscinas Reus landing page.
// All visible strings are Spanish; identifiers stay in English.

export const siteConfig = {
  name: "Piscinas Reus",
  ctaLabel: "Pedir presupuesto",
  phone: "977 12 34 56",
  phoneHref: "tel:+34977123456",
  email: "hola@piscinasreus.es",
  addressLine: "Reus, Tarragona",
};

export const navLinks = [
  { label: "Servicios", href: "#servicios" },
  { label: "Cómo trabajamos", href: "#proceso" },
  { label: "Proyectos", href: "#proyectos" },
  { label: "Preguntas", href: "#preguntas" },
];

export type Service = {
  id: string;
  title: string;
  description: string;
  imageSeed: string | null;
};

export const services: Service[] = [
  {
    id: "construccion",
    title: "Construcción de piscinas",
    description:
      "Piscinas de obra de gunitado, diseñadas a medida del jardín: excavación, estructura, impermeabilización, revestimiento y coronación.",
    imageSeed: "obra-gunitado-piscina-reus",
  },
  {
    id: "reformas",
    title: "Reformas de piscinas antiguas",
    description:
      "Cambiamos el revestimiento, reparamos fugas y filtraciones, y ponemos al día la instalación de piscinas con años de uso.",
    imageSeed: "reforma-piscina-antigua-gres",
  },
  {
    id: "mantenimiento",
    title: "Mantenimiento todo el año",
    description:
      "Limpieza periódica, control químico del agua, revisión de equipos y invernaje, con contrato mensual o solo en temporada.",
    imageSeed: null,
  },
];

export type ProcessStep = {
  label: string;
  description: string;
  duration: string;
};

export const processSteps: ProcessStep[] = [
  {
    label: "Visita y presupuesto",
    description:
      "Vamos a tu jardín, medimos el espacio y hablamos de forma, tamaño y acabados. El presupuesto llega cerrado, sin sorpresas después.",
    duration: "3 a 5 días",
  },
  {
    label: "Excavación",
    description:
      "Movimiento de tierras y replanteo exacto de la piscina según el proyecto, adaptando la maquinaria al acceso de tu parcela.",
    duration: "2 a 4 días",
  },
  {
    label: "Estructura de gunitado",
    description:
      "Ferrallado y proyección de hormigón gunitado, la técnica que da a la piscina su forma definitiva y su resistencia estructural.",
    duration: "1 a 2 semanas",
  },
  {
    label: "Impermeabilización y revestimiento",
    description:
      "Sellado del vaso y colocación del acabado que hayas elegido: gres, láminas o microcemento, más la coronación perimetral.",
    duration: "2 a 3 semanas",
  },
  {
    label: "Acabados y puesta en marcha",
    description:
      "Instalación de la depuradora, primer llenado, equilibrado del agua y explicación del mantenimiento antes del primer baño.",
    duration: "3 a 5 días",
  },
];

export type GalleryImage = {
  seed: string;
  alt: string;
  aspect: string;
};

export const galleryImages: GalleryImage[] = [
  {
    seed: "piscina-desbordante-cambrils",
    alt: "Piscina desbordante con vistas al jardín en Cambrils",
    aspect: "aspect-[3/4]",
  },
  {
    seed: "piscina-rectangular-tarragona",
    alt: "Piscina rectangular de obra en una vivienda de Tarragona",
    aspect: "aspect-[4/3]",
  },
  {
    seed: "piscina-nocturna-iluminada-reus",
    alt: "Piscina iluminada al anochecer con revestimiento oscuro",
    aspect: "aspect-square",
  },
  {
    seed: "detalle-revestimiento-gres-piscina",
    alt: "Detalle del revestimiento de gres en el borde de una piscina",
    aspect: "aspect-[4/5]",
  },
  {
    seed: "piscina-familiar-jardin-salou",
    alt: "Piscina familiar con solárium de madera en Salou",
    aspect: "aspect-[4/3]",
  },
  {
    seed: "piscina-reforma-vilaseca",
    alt: "Piscina reformada con playa de piedra natural en Vila-seca",
    aspect: "aspect-[3/4]",
  },
];

// Placeholder testimonials with realistic names, pending real customer quotes.
export const testimonials = [
  {
    quote:
      "Vinieron a medir el jardín, nos dieron el presupuesto en cuatro días y no se movió ni un euro hasta el final de la obra.",
    author: "Montse Ferré",
    location: "Cambrils",
  },
  {
    quote:
      "Reformaron una piscina de los años noventa que perdía agua. Ahora no le falta ni un litro y quedó como nueva.",
    author: "Jordi Vendrell",
    location: "Reus",
  },
];

export type Town = {
  name: string;
  distance: string;
  note: string;
  imageSeed: string;
};

export const serviceTowns: Town[] = [
  {
    name: "Reus",
    distance: "Sede",
    note: "Base del equipo y de la mayoría de nuestras obras.",
    imageSeed: "reus-centro-ciudad",
  },
  {
    name: "Cambrils",
    distance: "5 km",
    note: "Piscinas con playa de piedra, habituales en las urbanizaciones de la costa.",
    imageSeed: "cambrils-paseo-maritimo",
  },
  {
    name: "Salou",
    distance: "11 km",
    note: "Mantenimiento intensivo en verano por el uso constante de la vivienda.",
    imageSeed: "salou-playa-litoral",
  },
  {
    name: "Tarragona",
    distance: "13 km",
    note: "Reformas frecuentes en piscinas de chalets con más de veinte años.",
    imageSeed: "tarragona-ciudad-mediterraneo",
  },
  {
    name: "Vila-seca",
    distance: "9 km",
    note: "Obra nueva en parcelas de reciente construcción.",
    imageSeed: "vila-seca-urbanizacion",
  },
  {
    name: "Mont-roig del Camp",
    distance: "20 km",
    note: "Desplazamiento habitual para mantenimiento de temporada.",
    imageSeed: "mont-roig-camp-paisaje",
  },
];

export type ServiceTypeOption = {
  value: string;
  label: string;
};

export const serviceTypeOptions: ServiceTypeOption[] = [
  { value: "construccion", label: "Construcción de una piscina nueva" },
  { value: "reforma", label: "Reforma de una piscina existente" },
  { value: "mantenimiento", label: "Contrato de mantenimiento" },
  { value: "otro", label: "Otra consulta" },
];

export type FaqItem = {
  question: string;
  answer: string;
};

export const faqItems: FaqItem[] = [
  {
    question: "¿Cuánto tarda la construcción de una piscina?",
    answer:
      "Desde la excavación hasta el primer baño suelen pasar entre cinco y ocho semanas, según el tamaño, los acabados elegidos y el acceso a la parcela. En la visita inicial te damos un plazo concreto para tu jardín.",
  },
  {
    question: "¿Qué mantenimiento necesita una piscina de gunitado?",
    answer:
      "Limpieza del vaso y los filtros, control del pH y del cloro cada semana en temporada, y una revisión completa de los equipos antes y después del verano. El invernaje protege la instalación durante los meses de frío.",
  },
  {
    question: "¿Hace falta licencia o permiso de obra?",
    answer:
      "Sí, la mayoría de ayuntamientos de la zona exigen una licencia de obra menor o mayor según el volumen de excavación. Nos encargamos de preparar la documentación técnica y de tramitarla contigo.",
  },
  {
    question: "¿En qué se diferencia una piscina de gunitado de una prefabricada?",
    answer:
      "El gunitado se proyecta en obra y permite cualquier forma y medida, con una estructura pensada para durar décadas. La prefabricada llega en una pieza y se instala más rápido, pero limita la forma y el tamaño a los moldes disponibles.",
  },
  {
    question: "¿Puedo bañarme el mismo verano en que empiezo la obra?",
    answer:
      "Depende de cuándo arranquemos. Si la obra empieza a finales de invierno o principio de primavera, normalmente sí llegas a estrenarla ese mismo verano. Te lo confirmamos con fecha en la primera visita.",
  },
  {
    question: "¿Qué incluye un contrato de mantenimiento?",
    answer:
      "Visitas periódicas de limpieza, control y ajuste químico del agua, revisión de bomba y filtro, y aviso previo si detectamos alguna pieza que conviene cambiar antes de que falle.",
  },
];
