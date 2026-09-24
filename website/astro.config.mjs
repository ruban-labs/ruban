import {defineConfig} from 'astro/config';
import {resolveSiteEnvironment} from './site-environment.mjs';

const environment = resolveSiteEnvironment(process.env.RUBAN_SITE_ENV);

export default defineConfig({
  output: 'static',
  site: environment.url,
  trailingSlash: 'always',
});
