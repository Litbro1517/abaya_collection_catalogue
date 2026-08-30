'use client';

export function LandingCTAButton({ text }: { text: string }) {
  const handleClick = () => {
    // VG40: scroll to #order-form (was #formulaire-cod)
    document.getElementById('order-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  return (
    <button
      onClick={handleClick}
      className="lp-cta-button"
      data-cta="landing-cta"
    >
      {text}
    </button>
  );
}
