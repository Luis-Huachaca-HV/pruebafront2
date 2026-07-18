/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BACKEND_URL: string;
    readonly VITE_MERCADOPAGO_PUBLIC_KEY: string;
    // Añade aquí otras variables si las tienes, por ejemplo:
    // readonly VITE_MAPBOX_TOKEN: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}