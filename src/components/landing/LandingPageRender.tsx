'use client';

import type { LandingPage } from '@/types';
import { CanvaImagePage } from './CanvaImagePage';
import { CodeIAPage } from './CodeIAPage';
import { CodForm } from '@/components/preview/CodForm';

interface Props {
  page: LandingPage;
  productTitle: string;
  productPrice: string;
  productId: string;
}

export function LandingPageRender({ page, productTitle, productPrice, productId }: Props) {
  return (
    <main className="lp-wrapper">
      {page.type === 'IMAGE_CANVA' ? (
        <CanvaImagePage page={page} />
      ) : (
        <CodeIAPage page={page} />
      )}

      {/* Formulaire COD natif ancré — commun aux deux modes */}
      <section id="formulaire-cod" className="lp-cod-section">
        <div className="lp-cod-container">
          <CodForm productId={productId} productName={productTitle} productPrice={productPrice} />
        </div>
      </section>
    </main>
  );
}
