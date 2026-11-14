import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import Providers from './Providers';
import { getToken } from './lib/api';
import './index.css';

const container = document.getElementById('root')!;
const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';
const tree = (
  <StrictMode>
    <BrowserRouter basename={basename}>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </StrictMode>
);

const atRoot = window.location.pathname.replace(/\/$/, '') === basename.replace(/\/$/, '');
// The landing page is pre-rendered at build time; hydrate it for visitors who are signed out.
if (container.firstElementChild && atRoot && !getToken()) hydrateRoot(container, tree);
else createRoot(container).render(tree);
