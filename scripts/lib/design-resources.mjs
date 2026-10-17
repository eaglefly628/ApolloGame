// Single Design-export CDN -> local vendor table, shared by measuring and capture.
const VENDOR_FILES = Object.freeze({
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'react.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'react-dom.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': 'babel.js',
});
export function designResourceMap(origin) {
  const base = new URL('/__vendor/', origin);
  return Object.fromEntries(Object.entries(VENDOR_FILES).map(([url, file]) => [url, new URL(file, base).href]));
}
export async function installDesignResources(page, origin) {
  await page.addInitScript(resources => { window.__resources = resources; }, designResourceMap(origin));
}
