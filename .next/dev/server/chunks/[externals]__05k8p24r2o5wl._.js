module.exports = [
"[externals]/@sparticuz/chromium [external] (@sparticuz/chromium, esm_import, [project]/node_modules/@sparticuz/chromium, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/[externals]_@sparticuz_chromium_1y8okb7h86b0g._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[externals]/@sparticuz/chromium [external] (@sparticuz/chromium, esm_import, [project]/node_modules/@sparticuz/chromium)");
    });
});
}),
"[externals]/puppeteer-core [external] (puppeteer-core, esm_import, [project]/node_modules/puppeteer-core, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/[externals]_puppeteer-core_0qruir0w0q9vz._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[externals]/puppeteer-core [external] (puppeteer-core, esm_import, [project]/node_modules/puppeteer-core)");
    });
});
}),
];