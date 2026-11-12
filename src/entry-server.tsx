import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App';
import Providers from './Providers';

/** Used by scripts/prerender.mjs to render the SEO landing page to static HTML (same tree the client hydrates). */
export function render(basename: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={basename} basename={basename}>
        <Providers>
          <App />
        </Providers>
      </StaticRouter>
    </StrictMode>,
  );
}
