const { createProxyMiddleware } = require('http-proxy-middleware');

const target = process.env.REACT_APP_API_PROXY || 'http://127.0.0.1:5001';

module.exports = function (app) {
  [
    '/auth',
    '/user',
    '/project',
    '/person',
    '/institution',
    '/department',
    '/tag',
    '/project_tag',
    '/api',
    '/health',
  ].forEach((pathPrefix) => {
    app.use(
      pathPrefix,
      createProxyMiddleware({
        target,
        changeOrigin: true,
      })
    );
  });
};