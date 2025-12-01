#!/bin/bash
#
# Manual Testing Script for KOE Backend API
#
# This script tests all endpoints to verify that the refactoring
# did not introduce any regressions.
#
# Usage:
#   1. Start the backend: python backend/app.py
#   2. Run this script: bash backend/scripts/manual_testing.sh
#
# Prerequisites:
#   - jq (for JSON formatting): brew install jq / apt install jq
#   - curl (usually pre-installed)

set -e  # Exit on error

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

log_success() {
    echo -e "${GREEN}✓${NC}  $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}✗${NC}  $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

separator() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5
    local headers=$6

    ((TESTS_TOTAL++))

    log_info "Testing: $description"

    # Build curl command
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method"

    if [ -n "$headers" ]; then
        curl_cmd="$curl_cmd $headers"
    fi

    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi

    curl_cmd="$curl_cmd $BASE_URL$endpoint"

    # Execute request
    if [ "$VERBOSE" = "true" ]; then
        log_info "Command: $curl_cmd"
    fi

    response=$(eval $curl_cmd)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    # Verify status code
    if [ "$http_code" = "$expected_status" ]; then
        log_success "Status $http_code (expected $expected_status)"
        if [ "$VERBOSE" = "true" ] && [ -n "$body" ]; then
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        fi
        return 0
    else
        log_error "Status $http_code (expected $expected_status)"
        if [ -n "$body" ]; then
            echo "Response: $body"
        fi
        return 1
    fi
}

# Start testing
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  KOE Backend API - Manual Testing Suite                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
log_info "Base URL: $BASE_URL"
log_info "Verbose: $VERBOSE"
separator

# ============================================================================
# 1. Health Check
# ============================================================================
echo "📊 Testing Health Endpoints"
separator

test_endpoint \
    "GET" \
    "/api/health" \
    "200" \
    "Health check endpoint"

# ============================================================================
# 2. CSRF Token
# ============================================================================
separator
echo "🔒 Testing CSRF Token Endpoint"
separator

CSRF_RESPONSE=$(curl -s "$BASE_URL/api/csrf-token")
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ -n "$CSRF_TOKEN" ] && [ "$CSRF_TOKEN" != "null" ]; then
    log_success "CSRF token obtained: ${CSRF_TOKEN:0:20}..."
    ((TESTS_PASSED++))
else
    log_error "Failed to obtain CSRF token"
    ((TESTS_FAILED++))
    log_warning "Some tests will be skipped due to missing CSRF token"
fi
((TESTS_TOTAL++))

# ============================================================================
# 3. Magic Link Generation
# ============================================================================
separator
echo "🔗 Testing Magic Link Generation"
separator

# Note: This requires a valid Catenda topic GUID
# For testing, we'll just verify the endpoint responds correctly
TOPIC_GUID="00000000000000000000000000000000"  # Placeholder

test_endpoint \
    "GET" \
    "/api/magic-link/generate?topic_guid=$TOPIC_GUID" \
    "200" \
    "Magic link generation (may fail if topic doesn't exist)" \
    "" \
    "" || log_warning "Expected if test topic doesn't exist in Catenda"

# ============================================================================
# 4. Case Retrieval
# ============================================================================
separator
echo "📁 Testing Case Retrieval"
separator

# Test with non-existent case (should return 404)
test_endpoint \
    "GET" \
    "/api/cases/NONEXISTENT-CASE-ID" \
    "404" \
    "Get non-existent case (should return 404)"

# ============================================================================
# 5. Draft Saving (requires CSRF token)
# ============================================================================
separator
echo "💾 Testing Draft Saving"
separator

if [ -n "$CSRF_TOKEN" ] && [ "$CSRF_TOKEN" != "null" ]; then
    DRAFT_DATA='{
        "sakstittel": "Test Draft Case",
        "varsel": {
            "dato_forhold_oppdaget": "2025-12-01",
            "hovedkategori": "Risiko",
            "underkategori": "Grunnforhold",
            "varsel_beskrivelse": "Test draft description"
        }
    }'

    test_endpoint \
        "POST" \
        "/api/cases/TEST-DRAFT-001/draft" \
        "200" \
        "Save draft (requires valid case)" \
        "$DRAFT_DATA" \
        "-H 'X-CSRF-Token: $CSRF_TOKEN'" || log_warning "Expected if case doesn't exist"
else
    log_warning "Skipping draft saving test (no CSRF token)"
    ((TESTS_TOTAL++))
fi

# ============================================================================
# 6. Varsel Submission (requires CSRF token)
# ============================================================================
separator
echo "📝 Testing Varsel Submission"
separator

if [ -n "$CSRF_TOKEN" ] && [ "$CSRF_TOKEN" != "null" ]; then
    VARSEL_DATA='{
        "sakId": "TEST-CASE-001",
        "formData": {
            "sak": {
                "sakstittel": "Test Varsel Case",
                "prosjektnavn": "Test Project",
                "rolle": "TE"
            },
            "varsel": {
                "dato_forhold_oppdaget": "2025-12-01",
                "hovedkategori": "Risiko",
                "underkategori": "Grunnforhold",
                "varsel_beskrivelse": "Automated test varsel"
            }
        }
    }'

    test_endpoint \
        "POST" \
        "/api/varsel-submit" \
        "200" \
        "Submit varsel (requires valid case)" \
        "$VARSEL_DATA" \
        "-H 'X-CSRF-Token: $CSRF_TOKEN'" || log_warning "Expected if case doesn't exist"
else
    log_warning "Skipping varsel submission test (no CSRF token)"
    ((TESTS_TOTAL++))
fi

# ============================================================================
# 7. KOE Submission (requires CSRF token)
# ============================================================================
separator
echo "📋 Testing KOE Submission"
separator

if [ -n "$CSRF_TOKEN" ] && [ "$CSRF_TOKEN" != "null" ]; then
    KOE_DATA='{
        "sakId": "TEST-CASE-001",
        "formData": {
            "koe": {
                "tiltak_beskrivelse": "Test KOE tiltak",
                "kostnad": 100000,
                "tidsfrist": "2025-12-31"
            }
        }
    }'

    test_endpoint \
        "POST" \
        "/api/koe-submit" \
        "200" \
        "Submit KOE (requires valid case)" \
        "$KOE_DATA" \
        "-H 'X-CSRF-Token: $CSRF_TOKEN'" || log_warning "Expected if case doesn't exist or wrong status"
else
    log_warning "Skipping KOE submission test (no CSRF token)"
    ((TESTS_TOTAL++))
fi

# ============================================================================
# 8. BH Svar Submission (requires CSRF token)
# ============================================================================
separator
echo "💬 Testing BH Svar Submission"
separator

if [ -n "$CSRF_TOKEN" ] && [ "$CSRF_TOKEN" != "null" ]; then
    SVAR_DATA='{
        "sakId": "TEST-CASE-001",
        "formData": {
            "bh_svar": {
                "godkjent": true,
                "kommentar": "Test BH svar kommentar"
            }
        }
    }'

    test_endpoint \
        "POST" \
        "/api/svar-submit" \
        "200" \
        "Submit BH svar (requires valid case)" \
        "$SVAR_DATA" \
        "-H 'X-CSRF-Token: $CSRF_TOKEN'" || log_warning "Expected if case doesn't exist or wrong status"
else
    log_warning "Skipping BH svar submission test (no CSRF token)"
    ((TESTS_TOTAL++))
fi

# ============================================================================
# 9. PDF Upload (requires CSRF token)
# ============================================================================
separator
echo "📄 Testing PDF Upload"
separator

if [ -n "$CSRF_TOKEN" ] && [ "$CSRF_TOKEN" != "null" ]; then
    # Create a minimal base64-encoded PDF for testing
    PDF_BASE64="JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PD4+Pj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDQvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyMDUKJSVFT0Y="

    PDF_DATA="{
        \"sakId\": \"TEST-CASE-001\",
        \"pdfData\": \"$PDF_BASE64\",
        \"filename\": \"test-koe.pdf\",
        \"catendaTopicId\": \"00000000000000000000000000000000\"
    }"

    test_endpoint \
        "POST" \
        "/api/upload-pdf" \
        "200" \
        "Upload PDF (requires valid case and topic)" \
        "$PDF_DATA" \
        "-H 'X-CSRF-Token: $CSRF_TOKEN'" || log_warning "Expected if case/topic doesn't exist"
else
    log_warning "Skipping PDF upload test (no CSRF token)"
    ((TESTS_TOTAL++))
fi

# ============================================================================
# 10. Webhook Endpoint (without valid token - should fail)
# ============================================================================
separator
echo "🔌 Testing Webhook Endpoint"
separator

WEBHOOK_DATA='{
    "event": "topic_created",
    "topic_id": "test-topic-123"
}'

# This should fail with 404 or 403 because we don't have the secret path
test_endpoint \
    "POST" \
    "/webhook/catenda/invalid-secret" \
    "404" \
    "Webhook with invalid secret (should fail)" \
    "$WEBHOOK_DATA" \
    "" || log_warning "Webhook security test"

# ============================================================================
# Summary
# ============================================================================
separator
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Test Summary                                                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Total tests:  $TESTS_TOTAL"
echo -e "Passed:       ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed:       ${RED}$TESTS_FAILED${NC}"
echo ""

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Note: Some failures are expected if:"
    echo "  - Test cases don't exist in the database"
    echo "  - Catenda integration is not configured"
    echo "  - This is running in a development environment"
    echo ""
    exit 1
fi
