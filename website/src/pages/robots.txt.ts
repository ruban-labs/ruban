import {resolveSiteEnvironment} from '../../site-environment.mjs';

export function GET() {
  const environment = resolveSiteEnvironment(process.env.RUBAN_SITE_ENV);
  return new Response(environment.robots, {
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
}
