// Stemmer Snowball para español (P11), implementación propia sin dependencias.
// Referencia: https://snowballstem.org/algorithms/spanish/stemmer.html
// Verificado contra el vocabulario oficial snowball-data/spanish (voc.txt → output.txt); ver stemmer.test.js.
const VOCALES = new Set([...'aeiouáéíóúü']);
const esV = (c) => VOCALES.has(c);

function regiones(w) {
  const n = w.length;
  let pV = n;
  if (n >= 2) {
    if (esV(w[0])) {
      if (!esV(w[1])) { for (let i = 2; i < n; i++) if (esV(w[i])) { pV = i + 1; break; } }
      else { for (let i = 2; i < n; i++) if (!esV(w[i])) { pV = i + 1; break; } }
    } else if (!esV(w[1])) { for (let i = 2; i < n; i++) if (esV(w[i])) { pV = i + 1; break; } }
    else pV = Math.min(3, n);
  }
  const despues = (desde) => {
    for (let i = desde; i < n - 1; i++) if (esV(w[i]) && !esV(w[i + 1])) return i + 2;
    return n;
  };
  const p1 = despues(0);
  const p2 = despues(p1);
  return { pV, p1, p2 };
}

const ordenar = (l) => [...l].sort((a, b) => b.length - a.length);
const PRONOMBRES = ordenar(['me', 'se', 'sela', 'selo', 'selas', 'selos', 'la', 'le', 'lo', 'las', 'les', 'los', 'nos']);
const ANTES_PRONOMBRE = ordenar(['iéndo', 'ándo', 'ár', 'ér', 'ír', 'ando', 'iendo', 'ar', 'er', 'ir', 'yendo']);
const SIN_TILDE = { 'iéndo': 'iendo', 'ándo': 'ando', 'ár': 'ar', 'ér': 'er', 'ír': 'ir' };
const S1 = [
  [['anza', 'anzas', 'ico', 'ica', 'icos', 'icas', 'ismo', 'ismos', 'able', 'ables', 'ible', 'ibles', 'ista', 'istas', 'oso', 'osa', 'osos', 'osas', 'amiento', 'amientos', 'imiento', 'imientos'], 'a'],
  [['adora', 'ador', 'ación', 'acion', 'adoras', 'adores', 'aciones', 'ante', 'antes', 'ancia', 'ancias'], 'b'],
  [['logía', 'logías'], 'log'],
  [['ución', 'ucion', 'uciones'], 'u'],
  [['encia', 'encias'], 'ente'],
  [['amente'], 'amente'],
  [['mente'], 'mente'],
  [['idad', 'idades'], 'idad'],
  [['iva', 'ivo', 'ivas', 'ivos'], 'iva'],
];
const SUF1 = ordenar(S1.flatMap(([l]) => l));
const TIPO1 = Object.fromEntries(S1.flatMap(([l, t]) => l.map((s) => [s, t])));
const SUF2A = ordenar(['ya', 'ye', 'yan', 'yen', 'yeron', 'yendo', 'yo', 'yó', 'yas', 'yes', 'yais', 'yamos']);
const SUF2B_GU = ['en', 'es', 'éis', 'emos'];
const SUF2B = ordenar([...SUF2B_GU, 'arían', 'arías', 'arán', 'arás', 'aríais', 'aría', 'aréis', 'aríamos', 'aremos', 'ará', 'aré', 'erían', 'erías', 'erán', 'erás', 'eríais', 'ería', 'eréis', 'eríamos', 'eremos', 'erá', 'eré', 'irían', 'irías', 'irán', 'irás', 'iríais', 'iría', 'iréis', 'iríamos', 'iremos', 'irá', 'iré', 'aba', 'ada', 'ida', 'ía', 'ara', 'iera', 'ad', 'ed', 'id', 'ase', 'iese', 'aste', 'iste', 'an', 'aban', 'ían', 'aran', 'ieran', 'asen', 'iesen', 'aron', 'ieron', 'ado', 'ido', 'ando', 'iendo', 'ió', 'ar', 'er', 'ir', 'as', 'abas', 'adas', 'idas', 'ías', 'aras', 'ieras', 'ases', 'ieses', 'ís', 'áis', 'abais', 'íais', 'arais', 'ierais', 'aseis', 'ieseis', 'asteis', 'isteis', 'ados', 'idos', 'amos', 'ábamos', 'íamos', 'imos', 'áramos', 'iéramos', 'iésemos', 'ásemos']);
const SUF3 = ordenar(['os', 'a', 'o', 'á', 'í', 'ó', 'e', 'é']);

const busca = (w, lista, desde = 0) => lista.find((s) => w.endsWith(s) && w.length - s.length >= desde) ?? null;

/** Raíz Snowball de una palabra (minúsculas). */
export function raiz(palabra) {
  let w = String(palabra ?? '').toLowerCase();
  if (w.length < 2) return w.replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c]);
  const { pV, p1, p2 } = regiones(w);

  // Paso 0: pronombre enclítico.
  const pron = busca(w, PRONOMBRES);
  if (pron) {
    const resto = w.slice(0, -pron.length);
    const fin = busca(resto, ANTES_PRONOMBRE, pV);
    if (fin && (fin !== 'yendo' || resto.slice(0, -fin.length).endsWith('u'))) {
      w = SIN_TILDE[fin] ? resto.slice(0, -fin.length) + SIN_TILDE[fin] : resto;
    }
  }

  // Paso 1: sufijos estándar.
  let hecho = false;
  const s1 = busca(w, SUF1);
  if (s1) {
    const ini = w.length - s1.length;
    const t = TIPO1[s1];
    const r2 = ini >= p2;
    const quitar = (suf, desde) => (w.endsWith(suf) && w.length - suf.length >= desde ? ((w = w.slice(0, -suf.length)), true) : false);
    if (t === 'a' && r2) { w = w.slice(0, ini); hecho = true; }
    else if (t === 'b' && r2) { w = w.slice(0, ini); quitar('ic', p2); hecho = true; }
    else if (t === 'log' && r2) { w = w.slice(0, ini) + 'log'; hecho = true; }
    else if (t === 'u' && r2) { w = w.slice(0, ini) + 'u'; hecho = true; }
    else if (t === 'ente' && r2) { w = w.slice(0, ini) + 'ente'; hecho = true; }
    else if (t === 'amente' && ini >= p1) {
      w = w.slice(0, ini); hecho = true;
      const s = busca(w, ['iv', 'os', 'ic', 'ad']);
      if (s && w.length - s.length >= p2) { w = w.slice(0, -s.length); if (s === 'iv') quitar('at', p2); }
    } else if (t === 'mente' && r2) {
      w = w.slice(0, ini); hecho = true;
      const s = busca(w, ['ante', 'able', 'ible']);
      if (s) quitar(s, p2);
    } else if (t === 'idad' && r2) {
      w = w.slice(0, ini); hecho = true;
      const s = busca(w, ['abil', 'ic', 'iv']);
      if (s) quitar(s, p2);
    } else if (t === 'iva' && r2) { w = w.slice(0, ini); quitar('at', p2); hecho = true; }
  }

  // Pasos 2a y 2b: sufijos verbales (dentro de RV).
  if (!hecho) {
    const y = busca(w, SUF2A, pV);
    if (y && w.slice(0, -y.length).endsWith('u')) w = w.slice(0, -y.length);
    else {
      const v = busca(w, SUF2B, pV);
      if (v) {
        w = w.slice(0, -v.length);
        if (SUF2B_GU.includes(v) && w.endsWith('gu')) w = w.slice(0, -1);
      }
    }
  }

  // Paso 3: sufijo residual.
  const r = busca(w, SUF3);
  if (r && w.length - r.length >= pV) {
    w = w.slice(0, -r.length);
    if ((r === 'e' || r === 'é') && w.endsWith('gu') && w.length - 1 >= pV) w = w.slice(0, -1);
  }
  return w.replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c]);
}
