'use client';

import type { LandingPage } from '@/types';
import { CanvaImagePage } from './CanvaImagePage';
import { CodeIAPage } from './CodeIAPage';
import { CodForm } from '@/components/preview/CodForm';

interface Props {
  page: LandingPage;
  productTitle: string;
  productPrice: string;
  productId: string | null; // VG40.2: nullable — standalone landing pages have no product
}

export function LandingPageRender({ page, productTitle, productPrice, productId }: Props) {
  return (
    <main className="lp-wrapper">
      {page.type === 'IMAGE_CANVA' ? (
        <CanvaImagePage page={page} />
      ) : (
        <CodeIAPage page={page} />
      )}

      {/* Formulaire COD natif ancré — commun aux deux modes.
          VG40: id changed from 'formulaire-cod' to 'order-form' per mandate.
          VG40.2: fallback to 'standalone' if productId is null (no product associated). */}
      <section id="order-form" className="lp-cod-section">
        <div className="lp-cod-container">
          <CodForm productId={productId || 'standalone'} productName={productTitle} productPrice={productPrice} />
        </div>
      </section>
    </main>
  );
}
