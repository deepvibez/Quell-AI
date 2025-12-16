// src/hooks/useDebouncedValue.ts
import { useEffect, useState } from 'react';

export default function useDebouncedValue<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);

  return debounced;
}
