// Gerador pseudoaleatório com semente (mulberry32). O estado é um inteiro,
// então dá para salvar e retomar a sequência exatamente de onde parou.
export function criarRng(semente) {
  let s = semente >>> 0;
  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (lista) => lista[Math.floor(next() * lista.length)],
    embaralhar: (lista) => {
      const copia = [...lista];
      for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    },
    estado: () => s,
  };
}
