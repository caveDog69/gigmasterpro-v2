import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import Providers from './Providers';
import Landing from './pages/Landing';

/** Used by scripts/prerender.mjs to render the SEO landing page to static HTML. */
export function render(basename: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={basename} basename={basename}>
        <Providers>
          <Landing />
        </Providers>
      </StaticRouter>
    </StrictMode>,
  );
}
