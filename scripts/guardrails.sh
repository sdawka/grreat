#!/usr/bin/env bash
# Design-system guardrails (docs/design-system.md §6). Three checks, each a
# few lines of grep — keeps the token/primitive system from regressing.
set -u
cd "$(dirname "$0")/.."
fail=0

echo "guardrail: hex codes outside src/styles/tokens/"
hits=$(grep -rnE '#[0-9a-fA-F]{3,6}\b' src --include='*.css' --include='*.astro' \
  | grep -v '^src/styles/tokens/' | grep -v 'name="theme-color"')
if [ -n "$hits" ]; then echo "$hits"; echo "FAIL: hex code(s) outside src/styles/tokens/"; fail=1; fi

echo "guardrail: inline style in .astro (excluding --custom-property injection)"
# Matches both style="..." attributes and Astro's style={`...`} expression syntax;
# --custom-property injection (the sanctioned mechanism) and comment lines are excluded.
hits=$(grep -rnE 'style=[{"]' src --include='*.astro' | grep -v -- '--' | grep -vE ':[0-9]+:[[:space:]]*//')
if [ -n "$hits" ]; then echo "$hits"; echo "FAIL: inline style attribute found"; fail=1; fi

echo "guardrail: max-width: inside @media"
media_fail=0
for f in $(grep -rl '@media' src --include='*.css' --include='*.astro'); do
  hit=$(awk '
    /@media/ { inmedia=1; depth=0 }
    inmedia && /max-width:/ { print FILENAME":"FNR": "$0 }
    inmedia { depth += gsub(/{/, "{") - gsub(/}/, "}"); if (depth <= 0) inmedia=0 }
  ' "$f")
  if [ -n "$hit" ]; then echo "$hit"; media_fail=1; fail=1; fi
done
[ "$media_fail" = 1 ] && echo "FAIL: max-width: found inside @media"

exit $fail
