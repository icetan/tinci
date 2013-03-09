#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    parse = require('url').parse,
    http = require('http'),
    exec = require('child_process').exec,
    rootpath = path.resolve(process.argv[2] || '.'),
    port = parseInt(process.argv[3]) || 4567,
    tmpl = fs.readFileSync(require.resolve('./template.html'), 'utf8'),
    hookpath = require.resolve('./hooks/tinci'),
    ansiRe = new RegExp('\033\\[(\\d+)m', 'g');

function colorize(text) {
  var count = 0;
  return text.replace(ansiRe, function(_, code) {
    var res;
    if (code === '0') {
      res = new Array(count+1).join('</span>');
      count = 0;
    } else {
      res = '<span class="ansi'+code+'">';
      count++;
    }
    return res;
  })+new Array(count+1).join('</span>');
};

function logExec(cmd, callback) {
  console.log('Execting shell command:', cmd);
  exec(cmd, function (err, stdout, stderr) {
    console.log(err, stderr);
    if (callback) callback(err, stdout, stderr);
  });
}
function copyHook(to, runner, branch, callback) {
  logExec('cp "'+hookpath+'" "'+to+'/hooks/post-receive" && git config -f "'+
    to+'/config" --add tinci.runner "'+runner+'" && git config -f "'+
    to+'/config" --add tinci.branch "'+branch+'" && mkdir -p "'+to+'/.tinci"',
  callback);
}

function invokeHook(to, before, after, ref, callback) {
  logExec('cd "'+to+'" && git fetch origin '+ref+':'+ref+
    ' && echo "'+before+' '+after+' '+ref+'"|hooks/post-receive',
  callback);
}

function template(model) {
  var html = tmpl, i;
  for (i in model) html = html.split('{{'+i+'}}').join(model[i]);
  return html;
}

function parseLog(log) {
  var lines = fs.readFileSync(log.path, 'utf8').trim().split('\n'),
      exitcode = lines.slice(-1)[0],
      success = /^\d+$/.test(exitcode) ? (exitcode === '0') : undefined;
  log.success = success ? '✓' : (success != null ? '✗' : '—');
  log.html = log.html || '<article><h2><span class="' + log.success + '">' +
    log.success + '</span> ' + log.ctime +
    ' <small><a href="?log='+log.rev+'">' + log.rev + '</a></small></h2>' +
    '<pre>'+colorize(lines.slice(0,-2).join('<br>'))+'</pre></article>';
  return log;
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
      reponame, tincipath, model = {}, logs_, ls, dict, page, data = '?';
  if (pathname.indexOf(rootpath) === 0 && fs.existsSync(pathname)) {
    reponame = path.basename(pathname);
    if (fs.existsSync(path.join(pathname, 'hooks'))) {
      if ('invoke' in url.query) {
        req.on('data', function(chunk) { data += chunk; })
        .on('end', function() {
          var gitinfo;
          try {
            gitinfo = JSON.parse(parse(data, true).query.payload);
            invokeHook(pathname, gitinfo.before, gitinfo.after, gitinfo.ref);
            res.writeHead(200);
          } catch (ex) {
            res.writeHead(500);
            console.log('Error on invoke call: '+ex.message);
          }
          res.end();
        });
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      model.status = '—';
      model.title = reponame;
      model.logs = "No logs";
      tincipath = path.join(pathname, '.tinci');
      if (fs.existsSync(tincipath)) {
        logs_ = logs(tincipath);
        ls = logs_.logs;
        dict = logs_.dict;
        if (ls.length)
          model.status = parseLog(ls[ls.length-1]).success;
        model.logs = (function(){
          if (url.query.log) {
            return [dict[url.query.log]];
          } else {
            page = (url.query.page || Math.max(0,ls.length-10)+',').split(',');
            return ls.slice(
              page[0],
              page[1] === ''
                ? undefined
                : parseInt(page[0])+(parseInt(page[1])||10)
            );
          }
        })().map(function(log) {
          return log ? parseLog(log).html : '';
        }).reverse().join('') || model.logs;
      } else {
        if (url.query.runner) {
          copyHook(
            pathname,
            url.query.runner,
            url.query.branch||'master',
            function () {
              res.writeHead(302, { 'Location': url.pathname });
              res.end();
            }
          );
          return;
        } else {
          model.config = 'show';
          model.logs = '';
        }
      }
      res.end(template(model));
    } else {
      res.writeHead(500);
      res.end("Directory not a bare git repo?");
    }
  } else {
    res.writeHead(404);
    res.end("Directory not found.");
  }
}).listen(port);

console.log('tinci vision at http://localhost:'+port+'/your/git/repo');
