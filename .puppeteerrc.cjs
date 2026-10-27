// `puppeteer` é só devDependency (Chrome para desenvolvimento local).
// Na Vercel o navegador vem do @sparticuz/chromium, então não faz sentido
// baixar ~150 MB de Chrome durante o build.
module.exports = {
  skipDownload: Boolean(process.env.VERCEL),
};
