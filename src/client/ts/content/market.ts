export type MarketVersion = 'v1' | 'v2';

export type Orders = Map<number, number>;

export type SSR = {
	renderContext: {
		queryData: string;
	}
};

export class Market {
	static {
		addEventListener('load', (event) => { });
	}

	init(): void {
		let interval = setInterval(() => {
			try {
				const searchResults = (window as any).g_oSearchResults;
				if (searchResults) {
					clearInterval(interval);

					searchResults.SetPageChangedHandler((arg1: any, arg2: any) => {
						console.log(arg1, arg2);
					})
				}

			} catch { }

		}, 100);
	}

	static async getMarketVersion(): Promise<MarketVersion> {
		try {
			const ssr = (window as any).SSR
			if (ssr === undefined) {
				return 'v1'
			} else {
				return 'v2'
			}
		} catch (e) {
			return 'v1'
		}
	}

	static async getBuyOrders(): Promise<Orders | null> {
		try {
			if (await this.getMarketVersion() == 'v1') {
				return null;
			}

			const orders = new Map<number, number>();

			const ssr = (window as any).SSR as SSR;
			const queryData = JSON.parse(ssr.renderContext.queryData);
			console.info(queryData);

			return orders;
		} catch (e) {
			return null
		}
	}
}
