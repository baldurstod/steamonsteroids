.PHONY: build

build:
	rollup -c

firefox:
	rollup -c --environment BROWSER:firefox
	$(call make_zip)

prod:
	rollup -c
	$(call make_zip)

define make_zip
	mkdir dist
	cd ./build && zip -r "../dist/steamonsteroids_$(shell jq '.version' build/client/manifest.json)_$(shell date '+%Y_%m_%d').zip" .
endef
