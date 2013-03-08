# tinci

*TINy Continuous Integration script for use with GIT hooks*

![Screenshot of tinci GUI](https://raw.github.com/icetan/tinci/gh-pages/tinci-screenshot.png)

## tinci vision

You can setup tinci for a GIT repo and view the build logs over HTTP.

```
$ git clone git://github.com/icetan/tinci
$ node tinci/index.js my/git/repo/dir
$ open http://localhost:4567
```

Or.

```
$ npm install -g tinci
$ tinci my/git/repo/dir
```

## Just the hook

If you don't want the GUI then you can just copy the hook script to your GIT
repo.

```
$ cp tinci/hooks/tinci my/.git/hooks/post-receive
$ git config -f my/.git/config --add tinci.runner "make test"
```

tinci will now run the shell command 'make test' each time someone pushes to
your repos master branch.

To run tinci on another branch.

```
$ git config -f my/.git/config --add tinci.branch my-feature
```
