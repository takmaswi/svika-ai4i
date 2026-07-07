// .geojson files are bundled as JSON (see next.config.ts). They are parsed
// and validated at runtime by corridor.ts, so the module type stays unknown.
declare module "*.geojson" {
  const value: unknown;
  export default value;
}
