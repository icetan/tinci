{ pkgs ? import (builtins.fetchTarball {
    name = "nixos-unstable-2018-09-12";
    url = https://github.com/nixos/nixpkgs/archive/ca2ba44cab47767c8127d1c8633e2b581644eb8f.tar.gz;
    sha256 = "1jg7g6cfpw8qvma0y19kwyp549k1qyf11a5sg6hvn6awvmkny47v";
  }) {}
}: with pkgs;

let
  inherit (stdenv) mkDerivation;
  inherit (lib) cleanSource makeBinPath importJSON;
  inherit (importJSON ./package.json) version;
in mkDerivation rec {
  inherit version;
  name = "tinci-${version}";
  buildInputs = [ makeWrapper ];
  src = cleanSource ./.;
  phases = "unpackPhase installPhase fixupPhase";

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin $out/src
    cp -r hooks template.html index.js package.json UNLICENSE $out/src
    makeWrapper ${nodejs}/bin/node $out/bin/tinci \
      --add-flags "$out/src/index.js" \
      --prefix PATH : ${makeBinPath [ openssh git nodejs ]}

    runHook postInstall
  '';

  fixupPhase = ''
    runHook preFixup

    sed -i"" 's|#!/bin/sh|#!${dash}/bin/dash|' `find $out/src -type f -executable -maxdepth 1`

    runHook postFixup
  '';
}
