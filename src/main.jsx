import { createRoot } from 'react-dom/client';
import { dados } from './data/index.js';
import { CarreiraProvider } from './ui/estado/CarreiraContext.jsx';
import { App } from './ui/App.jsx';
import './ui/estilo.css';

createRoot(document.getElementById('root')).render(
  <CarreiraProvider dados={dados}>
    <App />
  </CarreiraProvider>,
);
