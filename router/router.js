const fs                = require('fs'),
      path              = require('path'),
      KoaStatic         = require('koa-static'),
      KoaMount          = require('koa-mount'),
      // KoaSend        = require('koa-send'),
      KoaRouter         = require('koa-router'),
      { Nuxt, Builder } = require('nuxt');

let   nuxt   = null;
const router = new KoaRouter();
const inject = function (app, config) {

    // init Nuxt Instance
    nuxt = new Nuxt({...require('../web/nuxt.config.js'), dev: config.dev});
    if (config.dev) {
        // new Builder(nuxt).build();
    }

    // insert more config
    config.startAt = Date.now();

    // make sure {Koa Instance} was passed in
    if (typeof app.use !== 'function') {
        console.error('[Error] Initialization of Koa Failed!');
        process.exit(1);
    }

    // search current directory for all route files.
    fs.readdirSync(__dirname).forEach(rt => {
        if (rt !== 'router.js' && (rt.endsWith(`.all.js`) || rt.endsWith(`.${config.db}.js`)) && !rt.startsWith('.')) {
            require(`./${rt}`).forEach(([method, uri, fn]) => {

                // register routes to /api
                if (!uri.startsWith('/')) uri = '/' + uri;
                if (['get', 'post', 'put', 'del', 'all'].includes(method)) router[method](`/api${uri}`, fn);
            
            });
            console.log(`[Route] Load Route Module ${rt.replace(`.${config.db}.js`, ``).replace(`.all.js`, ``)}`);
        }
    });

    app.use(async (ctx, next) => { ctx.state.config = config; await next(); })
       .use(async (ctx, next) => {
            ctx.set('Access-Control-Allow-Origin', '*');
            ctx.set('Access-Control-Allow-Methods', 'GET, OPTION');
            await next();
       })
       .use(async (ctx, next) => {
            if (ctx.path.startsWith("/api/")) {
                let cacheHits = false;
                
                // ## TODO ##
                // ## TO GET QUERY FROM REDIS ##
                if (!cacheHits) {
                    //console.log(ctx.url);
                    await next();
                    
                    // ## TODO ##
                    // ## TO SAVE RESULT TO CACHE ##
                }
            } else {
                await next();
            }
        })
       .use(router.routes())
       .use(router.allowedMethods())
       .use(KoaStatic(path.join(__dirname, "../web/static")))
       .use(KoaMount("/_nuxt", KoaStatic(path.join(__dirname, "../.nuxt/dist"))))
       .use(async ctx => {
            if (ctx.path.startsWith("/api/") || ctx.path.startsWith("/_nuxt/") || ctx.path.startsWith("/favicon.ico")) return;
            ctx.status = 200;
            ctx.respond = false;
            ctx.req.ctx = ctx;
            await nuxt.render(ctx.req, ctx.res);
       })
       .use(async (ctx, next) => {
            await next();
            if (ctx.status === 404 && ctx.path.startsWith("/api/")) {
                ctx.type = 'application/json';
                ctx.set('Access-Control-Allow-Origin', '*');
                ctx.set('Access-Control-Allow-Methods', 'GET, OPTION');
                ctx.body = { state: 0, error: 'Api Entry Not Found' };
            }
       });

}

module.exports = { inject };