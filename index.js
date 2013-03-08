#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    parse = require('url').parse,
    http = require('http'),
    exec = require('child_process').exec,
    rootpath = path.resolve(process.argv[2] || '.'),
    port = parseInt(process.argv[3]) || 4567,
    tmpl = fs.readFileSync(require.resolve('./template.html'), 'utf8'),
    hookpath = require.resolve('./hooks/tinci');

function copyHook(to, runner, branch) {
  var cmd = 'cp '+hookpath+' '+to+'/hooks/post-receive && git config -f '+
    to+'/config --add tinci.runner "'+runner+'" && git config -f ' +
    to+'/config --add tinci.branch "'+branch+'" && mkdir -p '+to+'/.tinci';
  console.log(cmd);
  exec(cmd, function (err, stdout, stderr) {
    console.log(err, stdout, stderr);
  });
}

function template(model) {
  var html = tmpl, i;
  for (i in model) html = html.split('{{'+i+'}}').join(model[i]);
  return html;
}

function logToHtml(log) {
  var lines = fs.readFileSync(log.path, 'utf8').trim().split('\n'),
      exitcode = lines.slice(-1)[0],
      success = /^\d+$/.test(exitcode) ? (exitcode === '0') : undefined;
  return '<article><h2 class="' +
    (success ? 'success' : (success != null ? 'failed' : 'incomplete')) + '">' +
    (success ? '✓ ' : (success != null ? '✗ ' : '- ')) + log.ctime + '</h2>' +
    '<h3><a href="?log='+log.rev+'">' + log.rev + '</a></h3>' +
    '<pre>'+lines.slice(0,-2).join('<br>')+'</pre></article>';
}

function logs(tincipath) {
  var dict = {};
  return {
    dict: dict,
    logs: fs.readdirSync(tincipath).filter(function(file){
      return file.slice(-4) === '.log';
    }).map(function(file) {
      var filepath = path.join(tincipath, file),
          rev = path.basename(file, '.log');
      return dict[rev] = {
        path: filepath,
        rev: rev,
        ctime: fs.statSync(filepath).ctime
      };
    }).sort(function(a, b){ return a.ctime - b.ctime; })
  };
}

http.createServer(function(req, res) {
  var url = parse(req.url, true),
      pathname = path.resolve(rootpath, './'+url.pathname),
      reponame, tincipath, model = {}, logs_, page;
  if (pathname.indexOf(rootpath) === 0 && fs.existsSync(pathname)) {
    reponame = path.basename(pathname);
    if (fs.existsSync(path.join(pathname, '.git')))
      pathname = path.join(pathname, '.git');
    if (fs.existsSync(path.join(pathname, 'hooks'))) {
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      model.title = reponame;
      model.logs = "No logs";
      tincipath = path.join(pathname, '.tinci');
      if (fs.existsSync(tincipath)) {
        logs_ = logs(tincipath);
        model.logs = (function(){
          if (url.query.log) {
            return [logs_.dict[url.query.log]];
          } else {
            page = (url.query.page || (logs.length-10)+',').split(',');
            return logs_.logs.slice(
              page[0],
              page[1] === ''
                ? undefined
                : parseInt(page[0])+(parseInt(page[1])||10)
            );
          }
        })().map(function(log) {
          return log ? logToHtml(log) : '';
        }).reverse().join('') || model.logs;
      } else {
        if (url.query.runner) {
          copyHook(pathname, url.query.runner, url.query.branch||'master');
        } else {
          model.config = 'show';
          model.logs = '';
        }
      }
      res.end(template(model));
    } else {
      res.writeHead(500);
      res.end("Directory not a git repo?");
    }
  } else {
    res.writeHead(404);
    res.end("Directory not found.");
  }
}).listen(port);

console.log('tinci vision at http://localhost:'+port+'/your/git/repo');
