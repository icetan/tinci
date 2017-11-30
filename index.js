#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    parse = require('url').parse,
    http = require('http'),
    crypto = require('crypto'),
    spawn = require('child_process').spawn,

    rootpath = path.resolve(process.argv[2] || '.'),
    port = parseInt(process.argv[3] || process.env.TINCI_PORT || 4567),
    secret = process.env.TINCI_SECRET || null,
    tmplpath = process.env.TINCI_TEMPLATE || require.resolve('./template.html'),
    tmpl = fs.readFileSync(tmplpath, 'utf8'),
    hookpath = require.resolve('./hooks/post-receive'),
    hookVersion = parseHookVersion(hookpath),
    guiVersion = require('./package.json').version,
    ansiRe = new RegExp('\033\\[(\\d+)m', 'g'),
    statusChars = ['✓', '✗', '—'];

function esc(str) {
  return str.replace(new RegExp("'", "g", '"'));
}

function fdate(d) {
  return d.toDateString() + ' ' + d.toLocaleTimeString();
}

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
  var sconf = process.TINCI_DEBUG
    ? {}
    : { stdio: ['ignore', 'ignore', 'ignore'] };

  console.log('Execting shell command:', cmd);

  var child = spawn("sh", ["-c", cmd], sconf);
  if (process.TINCI_DEBUG) {
    child.stdout.on('data', (data) => {
      console.log(data.toString('utf8'));
    });
    child.stderr.on('data', (data) => {
      console.error(data.toString('utf8'));
    });
  }
  child.on('error', (err) => {
    console.error('Failed to execute command', err);
    if (callback) callback(err)
  });
  child.on('close', function(code) {
    var err = code !== 0
      ? new Error("logExec: shell exited with non-zero: " + code)
      : null;
    if (err) console.error(err)
    if (callback) callback(err)
  })
}

function copyHook(to, runner, match, callback) {
  var eto = esc(to), er = esc(runner), em = esc(match);
  logExec("cp '"+esc(hookpath)+"' '"+eto+"/hooks/post-receive' && "+
    "git config -f '"+eto+"/config' --replace-all tinci.runner '"+er+"' && "+
    "git config -f '"+eto+"/config' --replace-all tinci.match '"+em+"'",
  callback);
}

function invokeHook(to, before, after, ref, callback) {
  var eref = esc(ref);
  logExec("cd '"+esc(to)+"' && git fetch -f origin '"+eref+":"+eref+"' && "+
    "echo '"+esc(before+" "+after+" "+ref)+"' | hooks/post-receive",
  callback);
}

function parseHookVersion(hookpath) {
  var m;
  if (!fs.existsSync(hookpath)) return;
  m = fs.readFileSync(hookpath, 'utf8').match(/TINCIV=([\d.]+)/);
  return m !== null ? m[1] : false;
}

function template(model) {
  var html = tmpl, i;
  for (i in model) html = html.split('{{'+i+'}}').join(model[i]);
  return html;
}

function logToHtml(log) {
  return '<article><h2><span class="' + statusChars[log.status] + '">' +
    statusChars[log.status] + '</span> ' + log.ref +
    ' <small>'+ fdate(log.ctime) + ' <a href="?log='+log.rev+'">' + log.rev +
    '</a></small></h2>' + '<pre>' +
    colorize(log.log.replace(/\r?\n/g, '<br>')) + '</pre></article>';
}

function parseLog(log) {
  var refm;
  if (!log.log) {
    log.log = fs.readFileSync(log.path, 'utf8').trim();
    log.ref = (refm = /# ref refs\/(?:heads|tags)\/(.*)/.exec(log.log), refm ? refm[1] : '');
    log.exitcode = log.log.slice(log.log.lastIndexOf('\n')+1).split(' ').slice(-1)[0];
    log.status = /^\d+$/.test(log.exitcode) ? (log.exitcode==='0' ? 0 : 1) : 2;
  }
  return log;
}

function logs(tincipath) {
  var res = {logs:[], dict:{}};
  if (fs.existsSync(tincipath)) {
    res.logs = fs.readdirSync(tincipath).filter(function(file){
      return file.slice(-4) === '.log';
    }).map(function(file) {
      var filepath = path.join(tincipath, file),
          rev = path.basename(file, '.log');
      return res.dict[rev] = {
        path: filepath,
        rev: rev,
        ctime: fs.statSync(filepath).ctime
      };
    }).sort(function(a, b){ return a.ctime - b.ctime; });
  }
  return res;
}

http.createServer(function(req, res) {
  var url = parse(req.url, true),
      pathname = path.resolve(rootpath, './'+url.pathname),
      format = url.query.format || 'html',
      model = {}, data = '', logs_, ls, dict,
      page, reponame, tincipath, hookv;
  if (pathname.indexOf(rootpath) === 0 && fs.existsSync(pathname)) {
    reponame = path.basename(pathname, '.git');
    if (fs.existsSync(path.join(pathname, 'hooks'))) {
      if ('invoke' in url.query) {
        req.on('data', function(chunk) { data += chunk; })
        .on('end', function() {
          var gitinfo, payload, pass;
          try {
            if (secret == null) {
              pass = true;
            } else if (req.headers['x-hub-signature'] == null) {
              pass = false;
            } else {
              sig = req.headers['x-hub-signature'].split('=')
              hmac = crypto.createHmac(sig[0], secret).update(data).digest('hex')
              pass = hmac.toLowerCase() === sig[1].toLowerCase();
            }
            if (pass) {
              gitinfo = JSON.parse(parse('?'+data, true).query.payload);
              invokeHook(pathname, gitinfo.before, gitinfo.after, gitinfo.ref);
              res.writeHead(200);
            } else {
              res.writeHead(403);
            }
          } catch (err) {
            res.writeHead(500);
            console.error('Error on invoke call:', err);
          }
          res.end();
        });
        return;
      }
      hookv = parseHookVersion(path.resolve(pathname, 'hooks', 'post-receive'));
      model = {
          title: reponame,
          status: 2,
          logs: [],
          guiVersion: guiVersion,
          hookVersion: hookVersion,
          installedVersion: hookv
      };
      if ('update' in url.query) {
        if (url.query.runner) {
          copyHook(
            pathname,
            url.query.runner,
            url.query.match||'master',
            function () {
              res.writeHead(302, { 'Location': url.pathname });
              res.end();
            }
          );
          return;
        } else {
          if (hookv != null) model.overwrite = 'show';
          model.config = 'show';
        }
      } else if (hookv) {
        tincipath = path.join(pathname, '.tinci');
        logs_ = logs(tincipath);
        ls = logs_.logs;
        dict = logs_.dict;
        if (ls.length) model.status = parseLog(ls[ls.length-1]).status;
        model.logs = (function(){
          if (url.query.log) {
            var log = dict[url.query.log];
            return log ? [log] : [];
          } else {
            page = (url.query.page || Math.max(0,ls.length-10)+',').split(',');
            return ls.slice(
              page[0],
              page[1] === ''
                ? undefined
                : parseInt(page[0])+(parseInt(page[1])||10)
            );
          }
        })().map(function(log) { return parseLog(log); }).reverse();
      } else {
        res.writeHead(302, { 'Location': url.pathname+'?update' });
        res.end();
        return;
      }
      if (format === 'html') {
        model.status = statusChars[model.status];
        model.logs = model.logs.map(function(log) {
          return log ? logToHtml(log) : '';
        }).join('');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(template(model));
      } else if (url.query.log && format === 'text') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(model.logs[0].log);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(model));
      }
    } else {
      res.writeHead(500);
      res.end("Directory not a bare git repo?");
    }
  } else {
    res.writeHead(404);
    res.end("Directory not found.");
  }
}).listen(port);

console.log('tinci vision at http://localhost:'+port);
