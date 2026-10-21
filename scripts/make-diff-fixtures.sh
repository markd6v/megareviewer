#!/usr/bin/env bash
# Regenerates src/domain/diff/fixtures/*.diff: real `git diff` output for every input the diff
# parser handles. Each fixture is one commit on a throwaway repo, diffed against its parent.
set -euo pipefail

out="$(cd "$(dirname "$0")/.." && pwd)/src/domain/diff/fixtures"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
g() { git -c user.name=fixture -c user.email=fixture@example.com -c core.abbrev=7 "$@"; }

# fixture NAME [DIFF OPTIONS...]: commits the working tree and writes its diff to NAME.diff.
fixture() {
  local name="$1"
  shift
  g add --all
  g commit --quiet --allow-empty --message "$name"
  g diff --no-color --no-ext-diff -M "$@" HEAD~1 HEAD >"$out/$name.diff"
}

# fresh: starts each fixture from an empty repo with one base commit.
fresh() {
  rm -rf "$work/repo"
  mkdir "$work/repo"
  cd "$work/repo"
  g init --quiet
  g commit --quiet --allow-empty --message base
}

lines() { seq -f "line %g" "$1" "$2"; }

mkdir -p "$out"
rm -f "$out"/*.diff

fresh
lines 1 5 >notes.txt
fixture added

fresh
lines 1 5 >notes.txt
g add --all && g commit --quiet --message seed
rm notes.txt
fixture deleted

fresh
lines 1 9 >notes.txt
g add --all && g commit --quiet --message seed
sed -i.bak 's/^line 5$/line five/' notes.txt && rm notes.txt.bak
fixture modified

fresh
lines 1 9 >old.txt
g add --all && g commit --quiet --message seed
g mv old.txt new.txt
fixture renamed

fresh
lines 1 20 >old.txt
g add --all && g commit --quiet --message seed
g mv old.txt new.txt
sed -i.bak 's/^line 10$/line ten/' new.txt && rm new.txt.bak
fixture renamed-modified

fresh
lines 1 20 >original.txt
g add --all && g commit --quiet --message seed
cp original.txt copy.txt
fixture copied -C -C

fresh
printf 'GIF89a\001\000\001\000\000\377\000,' >pixel.gif
fixture binary
g diff --no-color --no-ext-diff --binary HEAD~1 HEAD >"$out/binary-patch.diff"

fresh
printf '#!/bin/sh\necho hi\n' >run.sh
g add --all && g commit --quiet --message seed
chmod +x run.sh
fixture mode-only

fresh
: >empty.txt
fixture empty-file-added

fresh
printf 'one\ntwo' >tail.txt
g add --all && g commit --quiet --message seed
printf 'one\ntwo\n' >tail.txt
fixture no-newline-old

fresh
printf 'one\ntwo\n' >tail.txt
g add --all && g commit --quiet --message seed
printf 'one\ntwo' >tail.txt
fixture no-newline-new

fresh
printf 'one\ntwo' >tail.txt
g add --all && g commit --quiet --message seed
printf 'one\nthree' >tail.txt
fixture no-newline-both

fresh
printf 'one\r\ntwo\r\nthree\r\n' >windows.txt
g add --all && g commit --quiet --message seed
printf 'one\r\ntwo\nthree\r\n' >windows.txt
fixture crlf

fresh
mkdir "dir with space"
printf 'hello\n' >"dir with space/$(printf 'with space\tand \303\251.txt')"
fixture quoted-path

fresh
mkdir "dir with space"
printf 'hello\n' >"dir with space/plain name.txt"
g add --all && g commit --quiet --message seed
printf 'hello there\n' >"dir with space/plain name.txt"
fixture spaced-path

fresh
cat >shapes.c <<'EOF'
#include <math.h>

double area(double r)
{
	double a = M_PI * r * r;
	return a;
}

double circumference(double r)
{
	double c = 2 * M_PI * r;
	return c;
}

double diameter(double r)
{
	double d = 2 * r;
	return d;
}
EOF
g add --all && g commit --quiet --message seed
sed -i.bak -e 's/double a = /const double a = /' -e 's/double d = /const double d = /' shapes.c
rm shapes.c.bak
fixture multiple-hunks

fresh
printf 'only\n' >single.txt
g add --all && g commit --quiet --message seed
printf 'changed\n' >single.txt
fixture no-counts

fresh
lines 1 1000 >big.txt
g add --all && g commit --quiet --message seed
seq -f "row %g" 1 1000 >big.txt
fixture large-hunk
