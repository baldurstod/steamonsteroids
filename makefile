.PHONY: build clean

build:
	rollup -c

firefox:
	rollup -c --environment BROWSER:firefox

prod:
	cd ./build && zip -r "../dist/prod_$(shell jq '.version' build/manifest.json)_$(shell date '+%Y_%m_%d').zip" .

clean:
	go clean
