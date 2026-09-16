/// <reference types="vite/client" />

type ImportMetaEnv = {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_NODE_ENV: string;
};

type ImportMeta = {
  readonly env: ImportMetaEnv;
};
