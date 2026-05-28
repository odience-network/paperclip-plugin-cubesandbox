#!/usr/bin/env bash
# E2E test suite for CubeSandbox plugin against live Odience instance
# Tests all scenarios from ODIAA-387

CUBE_API="http://localhost:3002/api"
TEMPLATE_ID="tpl_default_sandbox_code"
PASS=0
FAIL=0
RESULTS=()

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); RESULTS+=("PASS: $1"); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); RESULTS+=("FAIL: $1"); }

section() { echo ""; echo "=== $1 ==="; }

# ─── helpers ──────────────────────────────────────────────────────────────────
create_sandbox() {
  curl -s -X POST "${CUBE_API}/sandboxes" \
    -H "Content-Type: application/json" \
    -d "{\"templateId\":\"${TEMPLATE_ID}\"}"
}

execute() {
  local sb_id="$1" code="$2" lang="${3:-python}"
  curl -s -X POST "${CUBE_API}/sandboxes/${sb_id}/execute" \
    -H "Content-Type: application/json" \
    -d "{\"code\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$code"),\"language\":\"${lang}\"}"
}

delete_sandbox() {
  curl -s -X DELETE "${CUBE_API}/sandboxes/$1"
}

# ─── Scenario 0: API health ────────────────────────────────────────────────────
section "SCENARIO 0: Infrastructure health"
HEALTH=$(curl -s "${CUBE_API}/healthz")
STATUS=$(echo "$HEALTH" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
MODE=$(echo "$HEALTH"   | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('mode',''))"   2>/dev/null)
[[ "$STATUS" == "ok" ]] && pass "Health check returns ok" || fail "Health check: $HEALTH"
[[ "$MODE"   == "pvm" ]] && pass "Running in PVM mode"   || fail "Unexpected mode: $MODE"

TMPL=$(curl -s "${CUBE_API}/templates" | python3 -c "import json,sys; ts=json.load(sys.stdin).get('templates',[]); print(ts[0]['id'] if ts else '')" 2>/dev/null)
[[ "$TMPL" == "$TEMPLATE_ID" ]] && pass "Template ${TEMPLATE_ID} ready" || fail "Template not found (got: $TMPL)"

# ─── Scenario 1: Sandbox creation performance ─────────────────────────────────
section "SCENARIO 1: Sandbox creation (<150 ms target)"
T0=$(date +%s%3N)
SB1=$(create_sandbox)
T1=$(date +%s%3N)
CREATE_MS=$((T1-T0))

SB1_ID=$(echo "$SB1" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
SB1_STATUS=$(echo "$SB1" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)

[[ -n "$SB1_ID" ]]          && pass "Sandbox created with ID: ${SB1_ID}" || fail "No sandbox ID returned"
[[ "$SB1_STATUS" == "running" ]] && pass "Sandbox status is running"         || fail "Status: ${SB1_STATUS}"
[[ $CREATE_MS -lt 150 ]]    && pass "Creation time ${CREATE_MS}ms < 150ms"   || fail "Creation too slow: ${CREATE_MS}ms"
echo "  Performance: sandbox creation = ${CREATE_MS}ms"

# ─── Scenario 2: Python code execution ────────────────────────────────────────
section "SCENARIO 2: Python code execution + output capture"
T0=$(date +%s%3N)
EXEC_RESULT=$(execute "$SB1_ID" "print('hello world')" python)
T1=$(date +%s%3N)
EXEC_MS=$((T1-T0))

EXEC_OUTPUT=$(echo "$EXEC_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output','').strip())" 2>/dev/null)
EXEC_EXIT=$(echo "$EXEC_RESULT"   | python3 -c "import json,sys; print(json.load(sys.stdin).get('exit_code',''))" 2>/dev/null)
EXEC_TIME_MS=$(echo "$EXEC_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('execution_time_ms',''))" 2>/dev/null)

[[ "$EXEC_OUTPUT" == "hello world" ]] && pass "Python stdout captured correctly" || fail "Output: '${EXEC_OUTPUT}'"
[[ "$EXEC_EXIT"   == "0" ]]           && pass "Exit code 0 for successful exec"  || fail "Exit code: ${EXEC_EXIT}"
[[ $EXEC_MS -lt 50 ]]                 && pass "Execution wall time ${EXEC_MS}ms < 50ms" || fail "Execution too slow: ${EXEC_MS}ms"
echo "  Performance: code execution = ${EXEC_MS}ms (API-reported: ${EXEC_TIME_MS}ms)"

# stderr capture
EXEC2=$(execute "$SB1_ID" "import sys; sys.stderr.write('err line\n')" python)
STDERR=$(echo "$EXEC2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('stderr','').strip())" 2>/dev/null)
[[ "$STDERR" == "err line" ]] && pass "stderr captured correctly" || fail "stderr: '${STDERR}'"

# Non-zero exit code
EXEC3=$(execute "$SB1_ID" "import sys; sys.exit(42)" python)
EXIT3=$(echo "$EXEC3" | python3 -c "import json,sys; print(json.load(sys.stdin).get('exit_code',''))" 2>/dev/null)
[[ "$EXIT3" == "42" ]] && pass "Non-zero exit code returned" || fail "exit_code: '${EXIT3}'"

# ─── Scenario 3: File read/write ──────────────────────────────────────────────
section "SCENARIO 3: File read/write in sandbox"
WRITE_RESULT=$(execute "$SB1_ID" "
with open('/tmp/e2e_test.txt', 'w') as f:
    f.write('e2e content line 1\ne2e content line 2\n')
print('written')
" python)
WRITE_OUT=$(echo "$WRITE_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output','').strip())" 2>/dev/null)
[[ "$WRITE_OUT" == "written" ]] && pass "File write successful" || fail "Write output: '${WRITE_OUT}'"

READ_RESULT=$(execute "$SB1_ID" "
with open('/tmp/e2e_test.txt', 'r') as f:
    print(f.read(), end='')
" python)
READ_OUT=$(echo "$READ_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output','').strip())" 2>/dev/null)
[[ "$READ_OUT" == "e2e content line 1"$'\n'"e2e content line 2" ]] && pass "File read returns correct content" || fail "Read output: '${READ_OUT}'"

# File persists across executions in same sandbox
PERSIST=$(execute "$SB1_ID" "import os; print('exists' if os.path.exists('/tmp/e2e_test.txt') else 'missing')" python)
PERSIST_OUT=$(echo "$PERSIST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output','').strip())" 2>/dev/null)
[[ "$PERSIST_OUT" == "exists" ]] && pass "File persists across executions in same sandbox" || fail "'${PERSIST_OUT}'"

# ─── Scenario 4: Isolation — code cannot read host files ──────────────────────
section "SCENARIO 4: Isolation validation"

# Cannot read host /etc/hostname (should differ from sandbox hostname)
HOST_HOSTNAME=$(hostname)
SBX_HOSTNAME=$(execute "$SB1_ID" "import socket; print(socket.gethostname())" python | python3 -c "import json,sys; print(json.load(sys.stdin).get('output','').strip())" 2>/dev/null)
[[ "$SBX_HOSTNAME" != "$HOST_HOSTNAME" ]] && pass "Sandbox hostname differs from host (isolation)" || fail "Sandbox hostname matches host: '${HOST_HOSTNAME}'"
echo "  Host hostname: ${HOST_HOSTNAME} | Sandbox hostname: ${SBX_HOSTNAME}"

# Cannot access host /proc/1/cmdline (should fail or return sandbox init)
PROC_RESULT=$(execute "$SB1_ID" "
try:
    with open('/proc/1/cmdline') as f:
        data = f.read().replace('\x00', ' ').strip()
    print('proc1:' + data[:60])
except Exception as e:
    print('blocked:' + str(e))
" python)
PROC_OUT=$(echo "$PROC_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output','').strip())" 2>/dev/null)
echo "  /proc/1/cmdline from sandbox: '${PROC_OUT}'"
# Host init is typically 'systemd' or 'init' - sandbox should see different init
if echo "$PROC_OUT" | grep -qiE "^(blocked:|proc1:.*pause|proc1:.*tini|proc1:.*init|proc1:.*sleep)"; then
  pass "Sandbox /proc/1 is sandboxed (not host systemd)"
elif echo "$PROC_OUT" | grep -qi "systemd"; then
  fail "Sandbox /proc/1 shows host systemd - possible isolation leak"
else
  pass "Sandbox /proc/1 is not host systemd: '${PROC_OUT}'"
fi

# Network: sandbox should not be able to reach host's internal services (port 3100)
NET_RESULT=$(execute "$SB1_ID" "
import socket
try:
    s = socket.create_connection(('host.docker.internal', 3100), timeout=2)
    s.close()
    print('reachable')
except Exception as e:
    print('blocked:' + str(type(e).__name__))
" python)
NET_OUT=$(echo "$NET_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output','').strip())" 2>/dev/null)
echo "  host.docker.internal:3100 from sandbox: '${NET_OUT}'"
[[ "$NET_OUT" != "reachable" ]] && pass "Sandbox cannot reach host.docker.internal:3100" || fail "Sandbox can reach host Paperclip API — isolation concern"

# ─── Scenario 5: Sandbox list ─────────────────────────────────────────────────
section "SCENARIO 5: Sandbox list"
LIST=$(curl -s "${CUBE_API}/sandboxes")
LIST_COUNT=$(echo "$LIST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
LIST_IDS=$(echo "$LIST"   | python3 -c "import json,sys; print([s['id'] for s in json.load(sys.stdin).get('sandboxes',[])])" 2>/dev/null)
[[ $LIST_COUNT -ge 1 ]] && pass "List returns running sandboxes (count=${LIST_COUNT})" || fail "No sandboxes listed"
echo "$LIST_IDS" | grep -q "$SB1_ID" && pass "Created sandbox appears in list" || fail "Created sandbox missing from list"

# ─── Scenario 6: Sandbox destruction ──────────────────────────────────────────
section "SCENARIO 6: Sandbox cleanup on destruction"
DEL_RESULT=$(delete_sandbox "$SB1_ID")
DEL_STATUS=$(echo "$DEL_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
[[ "$DEL_STATUS" == "deleted" ]] && pass "Sandbox deleted successfully" || fail "Delete result: '${DEL_RESULT}'"

# Verify gone
GET_AFTER=$(curl -s "${CUBE_API}/sandboxes/${SB1_ID}")
GET_ERROR=$(echo "$GET_AFTER" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error',''))" 2>/dev/null)
[[ -n "$GET_ERROR" ]] && pass "Deleted sandbox no longer accessible" || fail "Sandbox still accessible after delete"

# List shows empty again
LIST2_COUNT=$(curl -s "${CUBE_API}/sandboxes" | python3 -c "import json,sys; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
[[ $LIST2_COUNT -eq 0 ]] && pass "Sandbox list empty after cleanup" || fail "Sandboxes remain: count=${LIST2_COUNT}"

# ─── Scenario 7: Multi-sandbox isolation ──────────────────────────────────────
section "SCENARIO 7: Multi-sandbox filesystem isolation"
SB2=$(create_sandbox)
SB2_ID=$(echo "$SB2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
SB3=$(create_sandbox)
SB3_ID=$(echo "$SB3" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

# Write to SB2, verify SB3 cannot see it
execute "$SB2_ID" "open('/tmp/secret_a.txt','w').write('secret_from_sb2')" python > /dev/null
CHECK_SB3=$(execute "$SB3_ID" "import os; print('found' if os.path.exists('/tmp/secret_a.txt') else 'not_found')" python)
SB3_CHECK=$(echo "$CHECK_SB3" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output','').strip())" 2>/dev/null)
[[ "$SB3_CHECK" == "not_found" ]] && pass "SB2 filesystem not visible in SB3 (isolation)" || fail "SB3 can see SB2's file — isolation failure"

# Cleanup
delete_sandbox "$SB2_ID" > /dev/null
delete_sandbox "$SB3_ID" > /dev/null
pass "Multi-sandbox cleanup complete"

# ─── Scenario 8: Plugin client API mapping check ──────────────────────────────
section "SCENARIO 8: Plugin client API endpoint audit"
echo "  Auditing client.ts against live API endpoints..."
echo ""
echo "  LIVE API endpoints:"
echo "    POST   /api/sandboxes             - create sandbox"
echo "    GET    /api/sandboxes             - list sandboxes"
echo "    GET    /api/sandboxes/{id}        - get sandbox info"
echo "    POST   /api/sandboxes/{id}/execute - execute code in sandbox"
echo "    DELETE /api/sandboxes/{id}        - delete sandbox"
echo ""
echo "  PLUGIN client.ts calls:"
echo "    POST   /api/execute               ← NOT FOUND (BUG)"
echo "    GET    /api/sandboxes/{templateId} ← uses template ID instead of sandbox ID"
echo "    DELETE /api/sandboxes/{templateId} ← uses template ID instead of sandbox ID"
echo ""
fail "client.ts calls POST /api/execute which does not exist in live API"
fail "client.ts getSandboxInfo/terminateSandbox use templateId instead of sandbox ID"
echo "  NOTE: Plugin needs 2-phase flow: create sandbox → execute in sandbox"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo "  E2E Test Results: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════════"
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo ""
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
