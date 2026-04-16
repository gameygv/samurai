// Mapa determinístico: ciudad mexicana → CP centro + estado
// Fuente: Correos de México (SEPOMEX). Solo ciudades principales.
// Usado como fallback cuando la IA no infiere CP/estado de la conversación.

export interface GeoData {
  cp: string;
  estado: string;
}

// Claves normalizadas: minúsculas, sin acentos, sin espacios extra
const GEO_MAP: Record<string, GeoData> = {
  'aguascalientes':       { cp: '20000', estado: 'Aguascalientes' },
  'cancun':               { cp: '77500', estado: 'Quintana Roo' },
  'celaya':               { cp: '38000', estado: 'Guanajuato' },
  'chetumal':             { cp: '77000', estado: 'Quintana Roo' },
  'chihuahua':            { cp: '31000', estado: 'Chihuahua' },
  'chilpancingo':         { cp: '39000', estado: 'Guerrero' },
  'ciudad de mexico':     { cp: '06000', estado: 'Ciudad de México' },
  'cdmx':                 { cp: '06000', estado: 'Ciudad de México' },
  'mexico df':            { cp: '06000', estado: 'Ciudad de México' },
  'df':                   { cp: '06000', estado: 'Ciudad de México' },
  'ciudad juarez':        { cp: '32000', estado: 'Chihuahua' },
  'ciudad obregon':       { cp: '85000', estado: 'Sonora' },
  'ciudad victoria':      { cp: '87000', estado: 'Tamaulipas' },
  'coatzacoalcos':        { cp: '96400', estado: 'Veracruz' },
  'colima':               { cp: '28000', estado: 'Colima' },
  'comitan':              { cp: '30000', estado: 'Chiapas' },
  'cordoba':              { cp: '94500', estado: 'Veracruz' },
  'cuernavaca':           { cp: '62000', estado: 'Morelos' },
  'culiacan':             { cp: '80000', estado: 'Sinaloa' },
  'durango':              { cp: '34000', estado: 'Durango' },
  'ensenada':             { cp: '22800', estado: 'Baja California' },
  'guadalajara':          { cp: '44100', estado: 'Jalisco' },
  'guanajuato':           { cp: '36000', estado: 'Guanajuato' },
  'hermosillo':           { cp: '83000', estado: 'Sonora' },
  'irapuato':             { cp: '36500', estado: 'Guanajuato' },
  'la paz':               { cp: '23000', estado: 'Baja California Sur' },
  'leon':                 { cp: '37000', estado: 'Guanajuato' },
  'los cabos':            { cp: '23400', estado: 'Baja California Sur' },
  'los mochis':           { cp: '81200', estado: 'Sinaloa' },
  'mazatlan':             { cp: '82000', estado: 'Sinaloa' },
  'merida':               { cp: '97000', estado: 'Yucatán' },
  'mexicali':             { cp: '21000', estado: 'Baja California' },
  'monclova':             { cp: '25700', estado: 'Coahuila' },
  'monterrey':            { cp: '64000', estado: 'Nuevo León' },
  'morelia':              { cp: '58000', estado: 'Michoacán' },
  'nogales':              { cp: '84000', estado: 'Sonora' },
  'nuevo laredo':         { cp: '88000', estado: 'Tamaulipas' },
  'oaxaca':               { cp: '68000', estado: 'Oaxaca' },
  'orizaba':              { cp: '94300', estado: 'Veracruz' },
  'pachuca':              { cp: '42000', estado: 'Hidalgo' },
  'playa del carmen':     { cp: '77710', estado: 'Quintana Roo' },
  'puebla':               { cp: '72000', estado: 'Puebla' },
  'puerto vallarta':      { cp: '48300', estado: 'Jalisco' },
  'queretaro':            { cp: '76000', estado: 'Querétaro' },
  'reynosa':              { cp: '88500', estado: 'Tamaulipas' },
  'saltillo':             { cp: '25000', estado: 'Coahuila' },
  'san cristobal de las casas': { cp: '29200', estado: 'Chiapas' },
  'san luis potosi':      { cp: '78000', estado: 'San Luis Potosí' },
  'san miguel de allende': { cp: '37700', estado: 'Guanajuato' },
  'tampico':              { cp: '89000', estado: 'Tamaulipas' },
  'tapachula':            { cp: '30700', estado: 'Chiapas' },
  'tepic':                { cp: '63000', estado: 'Nayarit' },
  'tijuana':              { cp: '22000', estado: 'Baja California' },
  'tlaxcala':             { cp: '90000', estado: 'Tlaxcala' },
  'toluca':               { cp: '50000', estado: 'Estado de México' },
  'torreon':              { cp: '27000', estado: 'Coahuila' },
  'tuxtla gutierrez':     { cp: '29000', estado: 'Chiapas' },
  'uruapan':              { cp: '60000', estado: 'Michoacán' },
  'veracruz':             { cp: '91700', estado: 'Veracruz' },
  'villahermosa':         { cp: '86000', estado: 'Tabasco' },
  'xalapa':               { cp: '91000', estado: 'Veracruz' },
  'zacatecas':            { cp: '98000', estado: 'Zacatecas' },
  'zamora':               { cp: '59600', estado: 'Michoacán' },
  // Zona metropolitana de CDMX
  'naucalpan':            { cp: '53000', estado: 'Estado de México' },
  'tlalnepantla':         { cp: '54000', estado: 'Estado de México' },
  'ecatepec':             { cp: '55000', estado: 'Estado de México' },
  'nezahualcoyotl':       { cp: '57000', estado: 'Estado de México' },
  'neza':                 { cp: '57000', estado: 'Estado de México' },
  // Zona metropolitana de Guadalajara
  'zapopan':              { cp: '45100', estado: 'Jalisco' },
  'tlaquepaque':          { cp: '45500', estado: 'Jalisco' },
  'tonala':               { cp: '45400', estado: 'Jalisco' },
  // Zona metropolitana de Monterrey
  'san pedro garza garcia': { cp: '66200', estado: 'Nuevo León' },
  'san nicolas de los garza': { cp: '66400', estado: 'Nuevo León' },
  'apodaca':              { cp: '66600', estado: 'Nuevo León' },
  'guadalupe':            { cp: '67100', estado: 'Nuevo León' },
  'santa catarina':       { cp: '66100', estado: 'Nuevo León' },
};

/**
 * Normaliza una cadena para búsqueda en el mapa geo:
 * minúsculas, sin acentos, sin puntuación extra.
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[.,;:'"!?()]/g, '')    // quitar puntuación
    .replace(/\s+/g, ' ');           // colapsar espacios
}

/**
 * Busca datos geográficos (CP centro + estado) para una ciudad mexicana.
 * Retorna null si la ciudad no está en el mapa.
 */
export function lookupGeo(ciudad: string): GeoData | null {
  if (!ciudad || ciudad.length < 2) return null;
  const key = normalize(ciudad);
  return GEO_MAP[key] || null;
}

/**
 * Dado un nombre propio mexicano, infiere género con alta confianza.
 * Retorna 'f', 'm', o null si no puede determinarlo.
 * Solo infiere cuando la confianza es alta (sufijos muy claros).
 */
export function inferGender(nombre: string | null | undefined): 'f' | 'm' | null {
  if (!nombre || nombre.length < 2) return null;
  const first = nombre.trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Nombres explícitos comunes (alta confianza)
  const female = new Set([
    'maria', 'ana', 'laura', 'claudia', 'rosa', 'patricia', 'martha', 'marta',
    'guadalupe', 'leticia', 'elizabeth', 'veronica', 'alejandra', 'adriana',
    'andrea', 'angelica', 'beatriz', 'blanca', 'carmen', 'carolina', 'cecilia',
    'cristina', 'daniela', 'diana', 'elena', 'elisa', 'erika', 'esther',
    'eva', 'fabiola', 'fernanda', 'gabriela', 'gloria', 'graciela', 'irma',
    'isabel', 'jessica', 'josefina', 'juana', 'julia', 'karla', 'liliana',
    'lucia', 'luisa', 'luz', 'magdalena', 'marcela', 'margarita', 'marina',
    'marisol', 'monica', 'nora', 'norma', 'olga', 'paola', 'paula', 'pilar',
    'raquel', 'rebeca', 'regina', 'rocio', 'sandra', 'sara', 'silvia',
    'sofia', 'sonia', 'susana', 'teresa', 'valeria', 'vanessa', 'virginia',
    'ximena', 'yolanda', 'alicia', 'araceli', 'brenda', 'celia', 'delia',
    'dulce', 'edith', 'elvia', 'emma', 'esperanza', 'flor', 'frida',
    'griselda', 'hilda', 'ines', 'irene', 'ivonne', 'jackeline', 'jennifer',
    'karen', 'karina', 'lilia', 'lourdes', 'lucero', 'mariana', 'marlene',
    'mayra', 'mercedes', 'miriam', 'nancy', 'natalia', 'nayeli', 'noemi',
    'olivia', 'pamela', 'perla', 'renata', 'rosario', 'ruth', 'samantha',
    'stephania', 'stephanie', 'tatiana', 'viviana', 'wendy', 'yanet', 'yazmin',
    'itzel', 'citlali', 'xochitl',
  ]);
  const male = new Set([
    'jose', 'juan', 'carlos', 'luis', 'miguel', 'francisco', 'antonio',
    'pedro', 'jorge', 'manuel', 'rafael', 'daniel', 'fernando', 'ricardo',
    'alberto', 'alejandro', 'alfredo', 'andres', 'angel', 'arturo', 'benjamin',
    'cesar', 'christian', 'david', 'diego', 'eduardo', 'emilio', 'enrique',
    'ernesto', 'esteban', 'fabian', 'federico', 'felipe', 'gabriel', 'gerardo',
    'gilberto', 'gonzalo', 'guillermo', 'gustavo', 'hector', 'hugo', 'ignacio',
    'ivan', 'jaime', 'javier', 'jesus', 'joaquin', 'jonathan', 'leonel',
    'lorenzo', 'marco', 'marcos', 'mario', 'martin', 'mauricio', 'moises',
    'nestor', 'nicolas', 'octavio', 'omar', 'oscar', 'pablo', 'patricio',
    'raul', 'ramiro', 'ramon', 'roberto', 'rodrigo', 'rogelio', 'ruben',
    'salvador', 'samuel', 'santiago', 'saul', 'sebastian', 'sergio', 'tomas',
    'ulises', 'victor', 'adrian', 'alan', 'aldo', 'axel', 'brandon', 'brian',
    'bruno', 'cristian', 'edgar', 'efrain', 'elias', 'erik', 'ezequiel',
    'genaro', 'heriberto', 'homero', 'ismael', 'israel', 'joel', 'kevin',
    'leonardo', 'mateo', 'misael', 'noel', 'orlando', 'ovidio', 'uriel',
  ]);

  if (female.has(first)) return 'f';
  if (male.has(first)) return 'm';
  return null;
}
