import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/globals.css';
import { RegistryWorkbench } from '@/components/registry/registry-workbench';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RegistryWorkbench />
  </StrictMode>,
);
