tinci
=====

*TINy Continuous Integration script for use with Git hooks*

![Screenshot of tinci GUI](https://raw.github.com/icetan/tinci/gh-pages/tinci-screenshot.png)

For the looks
-------------

You can setup tinci for a bare Git repo and view the build logs over HTTP.

```
$ npm install -g tinci
$ tinci my/project.git/
$ open http://localhost:4567
```

Invoke a fetch and build with WebHooks by doing a HTTP POST
to ```http://localhost:4567?invoke```. More on [WebHooks and integration with
GitHub](https://help.github.com/articles/post-receive-hooks).


Just the hooks
--------------

If you don't want the GUI then you can just copy the hook script to your Git
repo manualy.

```
$ cp tinci/hooks/post-receive project.git/hooks/
$ git config -f project.git/config --add tinci.runner "make test"
```

tinci will now run the shell command 'make test' each time someone pushes to
your repos master branch.

To run tinci on another branch.

```
$ git config -f project.git/config --add tinci.branch my-feature
```

tinci will execute its own hooks on completion of a job. Place executable files
in your repos `hooks` directory with the name `tinci`, `tinci-success` or
`tinci-fail`.

Each hook will be called with the following parameters:

1. last job Git revision
1. current Git revision
1. current Git refs
1. last job exit code
1. current exit code

The `tinci` hook will be called on all completed jobs. `tinci-success` is only
called on a job that exits with a zero and `tinci-fail` will only be called
when a job exits with non-zero.

Here is a sample [fail hook](https://raw.github.com/icetan/tinci/master/hooks/tinci-fail.sample).
