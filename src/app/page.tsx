'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setSrc(`/pricer.html${window.location.hash}`);
  }, []);

  if (!src) return null;

  return (
    <iframe
      key={src}
      src={src}
      className="w-full border-0"
      style={{ height: '100dvh' }}
      title="Options Pricer"
    />
  );
}
