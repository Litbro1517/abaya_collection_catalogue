'use client';

export function LandingCTAButton({ text }: { text: string }) {
  const handleClick = () => {
    document.getElementById('formulaire-cod')?.scrollIntoView({
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
