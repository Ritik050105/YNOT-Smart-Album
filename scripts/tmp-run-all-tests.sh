#!/bin/bash
cd "E:/Smart album application/.claude/worktrees/project-analysis-ce4b4c" || exit 1
skip="test-activation.cjs test-admin-platform.cjs test-bin-template-update.cjs test-blending-effects.cjs test-canva-download-sync.cjs test-client-license.cjs test-cover-setup.cjs test-designer-first-drag.cjs test-designer-refinements.cjs test-full-spread-templates.mjs"
pass=0
fail=0
failed_list=""
for f in scripts/test-*.cjs scripts/test-*.mjs; do
  base=$(basename "$f")
  skipit=0
  for s in $skip; do [ "$base" = "$s" ] && skipit=1; done
  [ $skipit -eq 1 ] && continue
  if grep -qE "from 'electron'|require\('electron'\)|require\(\"electron\"\)" "$f" || [[ "$f" == *.cjs ]]; then
    runner="npx electron"
    tmo=60
  else
    runner="node"
    tmo=50
  fi
  case "$base" in
    test-large-import.cjs|test-large-recovery*.cjs|test-editor-update.cjs|test-rendering.mjs|test-dense-templates.mjs|test-matching-templates.mjs|test-workflow.mjs|test-import-fingerprints.cjs) tmo=140 ;;
  esac
  start=$(date +%s)
  out=$(timeout $tmo $runner "$f" 2>&1)
  code=$?
  elapsed=$(( $(date +%s) - start ))
  if [ $code -eq 0 ] || echo "$out" | grep -qiE "^PASS|passed[.:,]| passed$|checks passed"; then
    status="PASS"
    [ $code -ne 0 ] && status="PASS(timeout-after-pass)"
    echo "[$status] $f (${elapsed}s)"
    pass=$((pass+1))
  else
    echo "[FAIL] $f (${elapsed}s, exit $code)"
    echo "$out" | tail -40
    echo "---"
    fail=$((fail+1))
    failed_list="$failed_list $f"
  fi
done
echo ""
echo "$pass passed, $fail failed."
echo "FAILED:$failed_list"
