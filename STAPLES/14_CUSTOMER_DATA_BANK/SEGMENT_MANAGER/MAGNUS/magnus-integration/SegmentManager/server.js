var express = require('express');
var proxyMiddleware = require('http-proxy-middleware');
var path = require('path');
var open = require('open');
var exec = require('child_process').exec;
var config = require('./runconfig.json');

// configure proxy middleware options
var options = {
    target: config.gatewayURL[config.useGatewayEnv],
    onProxyReq: function(proxyReq, req, res){
        console.log(req.method+'-------->\n', req.url);
        proxyReq.setHeader('FIRSTNAME', config.authHeaders.FIRSTNAME);
        proxyReq.setHeader('LASTNAME', config.authHeaders.LASTNAME);
        proxyReq.setHeader('LANID', config.authHeaders.LANID);
        proxyReq.setHeader('EMPL_ID', config.authHeaders.EMPL_ID);
        proxyReq.setHeader('EMAIL', config.authHeaders.EMAIL);
        proxyReq.setHeader('GROUPS', config.authHeaders.GROUPS);
        proxyReq.setHeader('Content-Type', 'application/json');
    },
    onProxyRes: function(proxyRes, req, res) {
        proxyRes.headers['X-Authenticated'] = true;
        var buffers = [];
        proxyRes.on('data', function(chunk){
            buffers.push(chunk);
        });

        proxyRes.on('end', function(){
            var allBuffers = Buffer.concat(buffers);
        });
    },
    onError: function(err, req, res) {
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });
        res.end('Something went wrong.');
    }
};

// create the proxy
var proxy = proxyMiddleware('!/' + config.uiContext + '/**', options);

// use the configured `proxy` in web server
// use the configured `proxy` in web server
var app = express();
app.use(proxy);
app.use('/' + config.uiContext, express.static(path.join(__dirname, 'dist')));
console.log('Building Distributable Code...');
exec('gulp default', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    console.log('Building Distributable Code Complete...');
    console.log('Starting Server...');
    app.listen(config.usePort, function () {
        console.log('Opening Browser...');
        open('http://localhost:' + config.usePort + '/' + config.uiContext + '/', function (err) {
            if (err) throw err;
            console.log('Browser Opened.');
        });
    });
});