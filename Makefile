# Run this command: make build
build:
	sam build

# Run this command: make deploy
deploy:
	sam deploy --guided

# Run this command: make test
test:
	PYTHONPATH=lambda python3 -m unittest discover tests
