# tinci

*TINy Continuous Integration script for use with GIT hooks*

Runs command, depending on exit code passes or fails the build.

## How

With a bare GIT repo and a Makefile.

```
$ git clone git://github.com/icetan/tinci
$ cp tinci/hooks/tinci my/repo.git/hooks/post-receive
$ git config -f my/repo.git/config --add tinci.runner "make test"
```

tinci will now run each time someone pushes to your repos master branch.

To run tinci on another branch.

```
$ git config -f my/repo.git/config --add tinci.branch my-feature
```

## tinci vision

You can view tinci logs for a GIT repo over HTTP.

```
$ node tinci/index.js
```

Or.

```
$ npm install -g tinci
$ tinci
```
