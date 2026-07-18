/**
 * Last line of defence for the collaboration build.  The UI must never make an
 * outbound request, even if a newly added component accidentally calls fetch.
 */
export const installDemoNetworkGuard = () => {
  window.fetch = async (input: RequestInfo | URL) => {
    console.info('[demo] blocked outbound request', typeof input === 'string' ? input : input.toString());
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  class DemoWebSocket extends EventTarget {
    static readonly CONNECTING = 0; static readonly OPEN = 1; static readonly CLOSING = 2; static readonly CLOSED = 3;
    readonly CONNECTING = 0; readonly OPEN = 1; readonly CLOSING = 2; readonly CLOSED = 3;
    readyState = DemoWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    constructor(_url: string) { super(); queueMicrotask(() => { this.readyState = DemoWebSocket.OPEN; this.onopen?.(new Event('open')); }); }
    send(_data: string) {}
    close() { this.readyState = DemoWebSocket.CLOSED; this.onclose?.(new CloseEvent('close', { code: 1000 })); }
  }
  // Some older UI hooks instantiate WebSocket directly; replace it with a local no-op transport.
  window.WebSocket = DemoWebSocket as unknown as typeof WebSocket;
};
