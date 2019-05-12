{ pkgs, config, lib, ... }: with pkgs; let
  cfg = config.tinci;
  name = "tinci";
  user = "tinci";

  tinci = import ../. { inherit pkgs; };
  tinci-wrapper = writeScript "tinci-wrapper" ''
    #!${dash}/bin/dash
    set -e

    keyfile="''${1-`pwd`/id_rsa}"
    test -f "$keyfile" || ${openssh}/bin/ssh-keygen -t rsa -f "$keyfile" -N ""
    eval $(${openssh}/bin/ssh-agent)
    ${openssh}/bin/ssh-add "$keyfile"
    exec ${tinci}/bin/tinci
  '';
in {

  config = lib.mkIf cfg.enable {
    systemd.services.tinci = {
      enable = true;
      description = "Tin CI HTTP server";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      environment = {
        TINCI_SECRET = cfg.secret;
        TINCI_PORT = toString cfg.port;
        TINCI_ROOT = cfg.repoPath;
        NIX_REMOTE = "daemon";
      } // (if cfg.debug then { TINCI_DEBUG = "true"; } else {});

      serviceConfig = {
        Type = "simple";
        User = user;
        Group = user;
        WorkingDirectory = "/var/lib/${name}";
        PermissionsStartOnly = true;
        Restart = "on-failure";
        ExecStart = "${dash}/bin/dash -lc ${tinci-wrapper}";
      };
    };

    users.extraUsers = [
      {
        name = user;
        group = user;
        home = "/var/lib/${user}";
        createHome = true;
        shell = "${bash}/bin/bash";
        isSystemUser = true;
      }
    ];

    users.extraGroups = [
      { name = "${user}"; }
    ];
  };
}
