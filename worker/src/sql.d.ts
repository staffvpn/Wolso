/** Migration files are bundled in as strings by the Text rule in
 *  wrangler.toml — see admin/schemaHealth.ts, which serves the exact SQL
 *  for a migration that hasn't been applied yet. */
declare module '*.sql' {
  const content: string;
  export default content;
}
