/// <reference types="vite/client" />

declare module "*.html" {
  const src: string;
  export default src;
}

declare module "*.json" {
  const src: object;
  export default src;
}
