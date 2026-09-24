const environments = Object.freeze({
  production: Object.freeze({
    name: 'production',
    repository: 'ruban-labs/mobile-site',
    repositoryName: 'mobile-site',
    host: 'mobile.ruban-labs.work',
    url: 'https://mobile.ruban-labs.work/',
    robots: 'User-agent: *\nAllow: /\n',
    preview: false,
  }),
  preview: Object.freeze({
    name: 'preview',
    repository: 'ruban-labs/mobile-site-preview',
    repositoryName: 'mobile-site-preview',
    host: 'mobile-preview.ruban-labs.work',
    url: 'https://mobile-preview.ruban-labs.work/',
    robots: 'User-agent: *\nDisallow: /\n',
    preview: true,
  }),
});

export function resolveSiteEnvironment(name = 'production') {
  if (!Object.hasOwn(environments, name)) {
    throw new Error('RUBAN_SITE_ENV must be production or preview');
  }
  return environments[name];
}
