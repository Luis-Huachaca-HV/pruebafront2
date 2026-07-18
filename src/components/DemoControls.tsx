import { RotateCcw } from 'lucide-react';

/** Clears the local demo session and reloads the in-memory fixtures. */
export const DemoControls = () => <button type="button" onClick={() => { localStorage.clear(); window.location.reload(); }}
  className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-medium shadow-lg hover:bg-muted">
  <RotateCcw className="h-3.5 w-3.5" />Restablecer demo
</button>;
