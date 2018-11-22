tinci
=====

*TINy Continuous Integration script for use with Git hooks*

![Screenshot of tinci GUI](https://raw.github.com/icetan/tinci/gh-pages/tinci-screenshot.png)

Minimal Setup
-------------

If you don't want the GUI then you can just copy the hook script to your Git
repo manualy.

```sh
git clone https://github.com/icetan/tinci
git clone --bare my-project
cp tinci/hooks/post-receive my-project.git/hooks/
```

If there is a `.tinci` executable in the root of your repo then tinci will run
it and log the output.

```sh
echo "#!/bin/sh
make test" > my-project/.tinci
chmod +x my-project/.tinci
```

With HTTP Server
----------------

You can setup tinci for a bare Git repo and view the build logs over HTTP.

```
node tinci/index.js
open http://localhost:4567/my-project
```

tinci's Hooks
-------------

tinci will execute its own hooks after the `.tinci` script is done. Place
executable files in your repos `hooks` directory with the name `tinci` or
`tinci-pre`.

`hooks/tinci` is called with two arguments, the exit code of `.tinci` and the
path to the repos work tree.

`hooks/tinci-pre` is called with two arguments, the exit code of `.tinci` in
the previous commit and the path to the repos work tree.

Hooks also receive the last commit hash, the current commit hash and the current
ref on its STDIN.

Here are samples of how to integrate tinci with GitHubs WebHooks to get status
reports on commits:

- [hooks/tinci](https://raw.github.com/icetan/tinci/master/hooks/tinci.sample)
- [hooks/tinci-pre](https://raw.github.com/icetan/tinci/master/hooks/tinci-pre.sample).

Add to the `config` file in your bare repo and configure the values to match
your GitHub repo:

```
[tinci]
    status-api-token = abcdef0123456789...
    status-api-url = https://api.github.com/repos/me/my-project/statuses
    callback-url = https://tinci.example.org/my-project
```
