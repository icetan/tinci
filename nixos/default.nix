{ pkgs, config, lib, ... }: with lib; {
  options.tinci = {
    enable = mkEnableOption "tinci";

    port = mkOption {
      type = types.int;
      default = 4567;
      description = ''
        TCP port for HTTP server to listen to.
      '';
    };

    repoPath = mkOption {
      type = types.path;
      default = "/var/lib/tinci/repos";
      description = ''
        Path to directory of GIT repos.
      '';
    };

    secret = mkOption {
      type = types.str;
      example = "some secret password";
      description = ''
        Used to authenticate when installing hooks.
      '';
    };

    debug = mkOption {
      type = types.bool;
      default = false;
      description = ''
        Enable debug output.
      '';
    };
  };

  imports = [ ./tinci.nix ];
}
