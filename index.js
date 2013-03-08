var fs = require('fs'),
    path = require('path'),
    parse = require('url').parse,
    http = require('http'),
    port = process.argv[2],
    tmpl = fs.readFileSync(require.resolve('./template.html'), 'utf8');

function template(model) {
  var html = tmpl, i;
  for (i in model) html = html.split('{{'+i+'}}').join(model[i]);
  return html;
}

function logToHtml(file) {
  var lines = fs.readFileSync(file, 'utf8').trim().split('\n'),
      success = lines.slice(-1)[0] === '0',
      rev = path.basename(file, '.log'),
      ctime = fs.statSync(file).ctime;
  return {
    ctime: ctime,
    html: '<h2 class="' + (success ? 'success' : 'failed') + '">' +
        (success ? '✓ ' : '✗ ') + ctime + '</h2>' +
      '<h3>' + rev + '</h3>' +
      '<pre>'+lines.slice(0,-2).join('<br>')+'</pre>'
  };
}

http.createServer(function(req, res) {
  var pathname = parse(req.url).pathname,
      tincipath, model = {};
  if (fs.existsSync(pathname)) {
    if (fs.existsSync(path.join(pathname, '.git')))
      pathname = path.join(pathname, '.git');
    tincipath = path.join(pathname, '.tinci');
    if (fs.existsSync(tincipath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      model.title = path.basename(pathname);
      model.logs = fs.readdirSync(tincipath).filter(function(file){
        return file.slice(-4) === '.log';
      })
      .map(function(file) {
        return logToHtml(path.join(tincipath, file));
      })
      .sort(function(a, b){return b.ctime-a.ctime})
      .map(function(log){return log.html;})
      .join('');
      res.end(template(model));
    } else {
      res.writeHead(500);
      res.end("tinci not installed in git repo "+pathname+"?");
    }
  } else {
    res.writeHead(404);
    res.end("Directory "+pathname+" not found.");
  }
}).listen(parseInt(port || 4567));
