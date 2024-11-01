import { setFetchFunction } from 'harmony-3d';

enum PageType {
	Unknown = 0,
	Market,
	Inventory,
	TradeOffer
}

class Application {
	#pageType: PageType = PageType.Unknown;
	constructor() {
		this.#initPageType();
		if (!isChromium()) {
			setFetchFunction(async (resource, options) => await this.#backgroundFetch(resource, options));
		}
	}

	async #backgroundFetch(resource: RequestInfo | URL, options?: RequestInit) {
		const result = await chrome.runtime.sendMessage({
			action: 'fetch',
			resource: resource,
			options: options,
		});
		const encoder = new TextEncoder(/*'x-user-defined'*/);
		let blob;
		try {
			blob = new File([result.body], '', { type: 'application/octet-stream' });
			const blobAB = await blob.arrayBuffer();
		} catch (e) {
			console.log(e);
		}

		const test = new Uint8Array(result.test);

		if (result.ab instanceof ArrayBuffer) {
			return new Response(result.ab, { status: result.status, statusText: result.statusText });
		}

		return new Response(test, { status: result.status, statusText: result.statusText });
	}

	#initPageType() {
		switch (true) {
			case document.URL.startsWith('https://steamcommunity.com/market/'):
				this.#pageType = PageType.Market;
				break;
			case document.URL.startsWith('https://steamcommunity.com/tradeoffer/'):
				this.#pageType = PageType.TradeOffer;
				break;
			case document.URL.includes('/inventory'):
				this.#pageType = PageType.Inventory;
				break;
			default:
				this.#pageType = PageType.Unknown;
		}
	}
}

async function injectScript(path: string, tag: string) {
	var node = document.getElementsByTagName(tag)[0];
	var script = document.createElement('script');
	script.setAttribute('type', 'text/javascript');
	script.setAttribute('src', path);
	node.appendChild(script);
}
injectScript(chrome.runtime.getURL('injected.js'), 'body');
