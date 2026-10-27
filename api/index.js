// Placeholder so Vercel can match the `functions` pattern; `npm run build:api` overwrites it with the bundled server.
export default function handler(_req, res) {
  res.statusCode = 503;
  res.end('API not built');
}
