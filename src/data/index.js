import clubes from './clubes.json';
import estaduais from './estaduais.json';
import estrangeiros from './estrangeiros.json';
import e1960 from './elencos/1960-1979.json';
import e1980 from './elencos/1980-1989.json';
import e1990 from './elencos/1990-1999.json';
import e2000 from './elencos/2000-2009.json';
import e2010 from './elencos/2010-2024.json';

// Base completa no formato que carreira.js consome.
export const dados = {
  clubes,
  estaduais,
  estrangeiros,
  elencos: [...e1960, ...e1980, ...e1990, ...e2000, ...e2010],
};
