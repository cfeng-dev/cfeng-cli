#!/usr/bin/env bash
set -e

# Build timestamp in UTC (ISO-like)
BUILD_TIME="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"

# Netlify provides the commit hash as $COMMIT_REF
COMMIT="${COMMIT_REF:-unknown}"

# Write file available in browser
cat > deploy-info.js <<EOF
window.lastDeploy = "${BUILD_TIME}";
window.lastCommit = "${COMMIT}";
EOF

echo "Wrote deploy-info.js with time=${BUILD_TIME}, commit=${COMMIT}"
