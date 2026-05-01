#!/usr/bin/env bats
#
# Regression tests for the input-classification regexes in
# .github/workflows/dispatch-pr-preview-frontend.yml.
#
# These tests do NOT execute the workflow itself (no GitHub API calls).
# They pin the *classification logic* so future edits to the regexes
# cannot silently change which arm a given input falls into.

# ---------------------------------------------------------------------------
# Helpers under test (kept in lock-step with the workflow's regexes)
# ---------------------------------------------------------------------------
classify_pr_input() {
    local input="$1"
    if [[ "$input" =~ ^PR#([0-9]+)$ ]]; then
        echo "PR_HASH ${BASH_REMATCH[1]}"
    elif [[ "$input" =~ ^[0-9]+$ ]]; then
        echo "NUMERIC $input"
    else
        echo "INVALID"
    fi
}

classify_ref_input() {
    local input="$1"
    if [[ "$input" =~ ^PR#([0-9]+)$ ]]; then
        echo "PR_HASH ${BASH_REMATCH[1]}"
    else
        echo "REF $input"
    fi
}

is_valid_sha_override() {
    [[ "$1" =~ ^[0-9a-fA-F]{7,40}$ ]]
}

# ---------------------------------------------------------------------------
# PR-number classification (backend_pr_number / frontend_pr_number)
# ---------------------------------------------------------------------------
@test "PR: 'PR#289' parsed as PR_HASH 289" {
    run classify_pr_input "PR#289"
    [ "$output" = "PR_HASH 289" ]
}

@test "PR: bare '289' parsed as NUMERIC 289" {
    run classify_pr_input "289"
    [ "$output" = "NUMERIC 289" ]
}

@test "PR: 'PR#1' (single digit) parsed as PR_HASH 1" {
    run classify_pr_input "PR#1"
    [ "$output" = "PR_HASH 1" ]
}

@test "PR: '0' (zero) parsed as NUMERIC 0 (regex match; semantic check is later)" {
    run classify_pr_input "0"
    [ "$output" = "NUMERIC 0" ]
}

@test "PR: '00289' (leading zeros) parsed as NUMERIC 00289" {
    # Regex permits leading zeros; gh pr view will fail on a non-existent PR.
    run classify_pr_input "00289"
    [ "$output" = "NUMERIC 00289" ]
}

@test "PR: very large number '9999999999' parsed as NUMERIC" {
    run classify_pr_input "9999999999"
    [ "$output" = "NUMERIC 9999999999" ]
}

# Negative cases
@test "PR: 'PR#abc' rejected (alpha after PR#)" {
    run classify_pr_input "PR#abc"
    [ "$output" = "INVALID" ]
}

@test "PR: 'PR#' (empty number) rejected" {
    run classify_pr_input "PR#"
    [ "$output" = "INVALID" ]
}

@test "PR: '#289' (missing PR prefix) rejected" {
    run classify_pr_input "#289"
    [ "$output" = "INVALID" ]
}

@test "PR: 'pr#289' (lowercase) rejected: must be uppercase" {
    run classify_pr_input "pr#289"
    [ "$output" = "INVALID" ]
}

@test "PR: 'PR289' (no hash) rejected" {
    run classify_pr_input "PR289"
    [ "$output" = "INVALID" ]
}

@test "PR: 'PR#289 ' (trailing space) rejected: anchor enforced" {
    run classify_pr_input "PR#289 "
    [ "$output" = "INVALID" ]
}

@test "PR: ' 289' (leading space) rejected: anchor enforced" {
    run classify_pr_input " 289"
    [ "$output" = "INVALID" ]
}

@test "PR: empty string rejected" {
    run classify_pr_input ""
    [ "$output" = "INVALID" ]
}

@test "PR: 'main' rejected (branch name not a PR token)" {
    run classify_pr_input "main"
    [ "$output" = "INVALID" ]
}

@test "PR: '289-foo' rejected (extra suffix)" {
    run classify_pr_input "289-foo"
    [ "$output" = "INVALID" ]
}

@test "PR: '289.0' rejected (decimal)" {
    run classify_pr_input "289.0"
    [ "$output" = "INVALID" ]
}

@test "PR: '+289' (plus sign) rejected" {
    run classify_pr_input "+289"
    [ "$output" = "INVALID" ]
}

@test "PR: '-289' (negative) rejected" {
    run classify_pr_input "-289"
    [ "$output" = "INVALID" ]
}

@test "PR: 'PR#289#290' (double PR token) rejected" {
    run classify_pr_input "PR#289#290"
    [ "$output" = "INVALID" ]
}

@test "PR: tab-only string rejected" {
    run classify_pr_input "$(printf '\t')"
    [ "$output" = "INVALID" ]
}

@test "PR: input with embedded newline rejected" {
    # Use printf %b to embed a literal newline in the middle of the value.
    local val
    val=$(printf '28\n9')
    run classify_pr_input "$val"
    [ "$output" = "INVALID" ]
}

# ---------------------------------------------------------------------------
# Ref classification (backend_ref / frontend_ref) — collapsed SHA + branch arm
# ---------------------------------------------------------------------------
@test "Ref: 'PR#373' parsed as PR_HASH 373" {
    run classify_ref_input "PR#373"
    [ "$output" = "PR_HASH 373" ]
}

@test "Ref: 'main' resolves as REF (default branch)" {
    run classify_ref_input "main"
    [ "$output" = "REF main" ]
}

@test "Ref: 7-char hex SHA resolves as REF" {
    run classify_ref_input "abc1234"
    [ "$output" = "REF abc1234" ]
}

@test "Ref: 40-char full hex SHA resolves as REF" {
    run classify_ref_input "0123456789abcdef0123456789abcdef01234567"
    [ "$output" = "REF 0123456789abcdef0123456789abcdef01234567" ]
}

@test "Ref: branch literally named in hex chars resolves as REF (precedence: PR# > everything else)" {
    # Edge case noted in workflow comments. `commits/<ref>` is ref-type-
    # agnostic, so a branch named 'abc1234' resolves identically to a SHA.
    run classify_ref_input "deadbeef"
    [ "$output" = "REF deadbeef" ]
}

@test "Ref: feature branch 'feature/foo' resolves as REF" {
    run classify_ref_input "feature/foo"
    [ "$output" = "REF feature/foo" ]
}

@test "Ref: branch with multiple slashes 'feat/a/b/c' resolves as REF" {
    run classify_ref_input "feat/a/b/c"
    [ "$output" = "REF feat/a/b/c" ]
}

@test "Ref: branch with dashes and underscores resolves as REF" {
    run classify_ref_input "fix/my-cool_branch-2"
    [ "$output" = "REF fix/my-cool_branch-2" ]
}

@test "Ref: tag-like 'v1.0.0' resolves as REF" {
    run classify_ref_input "v1.0.0"
    [ "$output" = "REF v1.0.0" ]
}

@test "Ref: branch name with dot 'release.candidate' resolves as REF" {
    run classify_ref_input "release.candidate"
    [ "$output" = "REF release.candidate" ]
}

@test "Ref: 'PR#abc' falls through as REF (literal value sent to commits API)" {
    # The PR# regex requires digits, so this falls through to the REF arm.
    # commits/PR%23abc will 404 at runtime, which is the expected user error.
    run classify_ref_input "PR#abc"
    [ "$output" = "REF PR#abc" ]
}

@test "Ref: empty string resolves as REF (gh api 404 will catch at runtime)" {
    run classify_ref_input ""
    [ "$output" = "REF " ]
}

# ---------------------------------------------------------------------------
# SHA-override validation (backend_sha_override / frontend_sha_override)
# ---------------------------------------------------------------------------
@test "Override: 7-char lowercase hex passes" {
    is_valid_sha_override "abc1234"
}

@test "Override: 8-char lowercase hex passes" {
    is_valid_sha_override "abcdef12"
}

@test "Override: 40-char full SHA passes" {
    is_valid_sha_override "0123456789abcdef0123456789abcdef01234567"
}

@test "Override: mixed-case hex passes" {
    is_valid_sha_override "AbC1234dEf"
}

@test "Override: all-uppercase hex passes" {
    is_valid_sha_override "ABCDEF1234"
}

@test "Override: 6-char input fails (below min length)" {
    run is_valid_sha_override "abc123"
    [ "$status" -ne 0 ]
}

@test "Override: 41-char input fails (above max length)" {
    run is_valid_sha_override "0123456789abcdef0123456789abcdef012345678"
    [ "$status" -ne 0 ]
}

@test "Override: non-hex 'g' rejected" {
    run is_valid_sha_override "abcg123"
    [ "$status" -ne 0 ]
}

@test "Override: non-hex 'z' rejected" {
    run is_valid_sha_override "abczzzz"
    [ "$status" -ne 0 ]
}

@test "Override: empty string rejected" {
    run is_valid_sha_override ""
    [ "$status" -ne 0 ]
}

@test "Override: 'PR#289' rejected (override is not a PR token)" {
    run is_valid_sha_override "PR#289"
    [ "$status" -ne 0 ]
}

@test "Override: leading/trailing whitespace rejected" {
    run is_valid_sha_override " abc1234"
    [ "$status" -ne 0 ]
    run is_valid_sha_override "abc1234 "
    [ "$status" -ne 0 ]
}

@test "Override: branch name 'main' rejected" {
    run is_valid_sha_override "main"
    [ "$status" -ne 0 ]
}

@test "Override: SHA with embedded slash rejected" {
    run is_valid_sha_override "abc/1234"
    [ "$status" -ne 0 ]
}

# ---------------------------------------------------------------------------
# Cross-cutting: the resolver's contract guarantees
# ---------------------------------------------------------------------------
@test "Contract: PR# precedence holds even when number could also be a SHA" {
    # 'PR#1234567' has exactly 7 hex-compatible digits after the prefix.
    # The PR# arm must still win because it is checked first.
    run classify_ref_input "PR#1234567"
    [ "$output" = "PR_HASH 1234567" ]
}

@test "Contract: ref classifier never returns INVALID (always one of PR_HASH or REF)" {
    # This documents that the ref arm is tolerant: anything that is not a
    # PR# token falls through to gh api, which validates at runtime.
    for input in "main" "feat/x" "abc1234" "v1.0.0" "" "weird input" "PR#abc"; do
        result=$(classify_ref_input "$input")
        [[ "$result" == PR_HASH* || "$result" == REF* ]] || {
            echo "classifier returned unexpected value '$result' for input '$input'"
            return 1
        }
    done
}
