# Run this command: make build
build:
	sam build

# Run this command: make deploy
deploy:
	sam deploy --guided

# Run this command: make config-pages-demo
config-pages-demo:
	python tools/generate_dashboard_config.py pages-demo --output dashboard/config.js

# Run this command: make config-live STACK_NAME=receiptpulse-prod
config-live:
	python tools/generate_dashboard_config.py aws-live --stack-name "$(STACK_NAME)" --output dashboard/config.js

# Run this command: make test
test:
	PYTHONPATH=lambda python3 -m unittest discover tests
