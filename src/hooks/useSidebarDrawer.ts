import { useState } from 'react';

export function useSidebarDrawer() {
  const [open, setOpen] = useState(false);
  return {
    open,
    toggle: () => setOpen(v => !v),
    close:  () => setOpen(false),
  };
}
