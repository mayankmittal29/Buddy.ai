SEMGREP_VENV := .tools/semgrep-venv
SEMGREP := $(SEMGREP_VENV)/bin/semgrep

.PHONY: security-scan security-scan-setup

# Semgrep lives in its own isolated venv (.tools/semgrep-venv), never in
# backend/venv — installing it directly into the app's own venv once
# downgraded shared dependencies (mcp, opentelemetry, jsonschema) and broke
# the running backend. See .gitignore's note on this.
security-scan-setup:
	@test -x "$(SEMGREP)" || ( \
		python3 -m venv $(SEMGREP_VENV) && \
		$(SEMGREP_VENV)/bin/pip install --quiet --upgrade pip && \
		$(SEMGREP_VENV)/bin/pip install --quiet semgrep \
	)

security-scan: security-scan-setup
	$(SEMGREP) --config .semgrep.yml --config p/python --config p/security-audit --config p/secrets backend/
