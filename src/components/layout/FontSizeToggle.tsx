import { useState, useEffect } from 'react';
import { AArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SIZES = [
  { label: 'Normal', value: '100%' },
  { label: 'Grande', value: '112.5%' },
  { label: 'Extra', value: '125%' },
];

const STORAGE_KEY = 'samurai-font-scale';

export const FontSizeToggle = () => {
  const [sizeIndex, setSizeIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const idx = SIZES.findIndex(s => s.value === saved);
      if (idx >= 0) {
        setSizeIndex(idx);
        document.documentElement.style.setProperty('--font-scale', saved);
      }
    }
  }, []);

  const cycle = () => {
    const next = (sizeIndex + 1) % SIZES.length;
    setSizeIndex(next);
    const value = SIZES[next].value;
    document.documentElement.style.setProperty('--font-scale', value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      className="h-9 w-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
      title={`Tamaño de letra: ${SIZES[sizeIndex].label}`}
    >
      <AArrowUp className="w-4 h-4" />
    </Button>
  );
};
