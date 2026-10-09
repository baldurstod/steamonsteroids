import { createElement, createShadowRoot, I18n } from 'harmony-ui';
import { Map2 } from 'harmony-utils';
import marketHistoryCSS from '../../../css/markethistory.css';
import { MarketHistory, MarketTransactionType } from '../market/history';
import { ExtensionView } from './extensionview';

export class MarketHistoryView extends ExtensionView {
	#htmlMarketHistoryList?: HTMLElement;
	#filter = { name: '', };

	protected initHTML(): void {
		if (this.shadowRoot) {
			return;
		}
		this.shadowRoot = createShadowRoot('section', {
			adoptStyles: [marketHistoryCSS],
			parent: document.body,
			childs: [
				createElement('input', {
					$input: (event: InputEvent) => {
						this.#setNameFilter((event.target as HTMLInputElement).value);
					},
				}) as HTMLInputElement,
				this.#htmlMarketHistoryList = createElement('div', {
					class: 'market-history-list',
				}) as HTMLInputElement,
			]
		});
		I18n.observeElement(this.shadowRoot);
	}

	async #setNameFilter(name: string): Promise<void> {
		this.#filter.name = name;
		this.#refreshFilter();
	}

	async #refreshFilter(): Promise<void> {
		this.initHTML();
		this.#htmlMarketHistoryList!.innerText = '';

		const map = new Map2<MarketTransactionType, string, number>();

		for (const transaction of await MarketHistory.getAllTransactions()) {

			//console.info(transaction);

			//console.count('transaction');
			const asset = await MarketHistory.getAsset(transaction.appId, transaction.contextId, transaction.assetId);
			if (asset) {
				//console.info(transaction, asset);
				if (asset.asset.market_name === this.#filter.name || asset.asset.name === this.#filter.name) {
					/*
					createElement('div', {
						parent: this.#htmlMarketHistoryList,
					})
					*/

					let v = map.get(transaction.type, transaction.price);
					if (v === undefined) {
						v = 0;
					}
					map.set(transaction.type, transaction.price, v + 1);
				}
			}

		}
		console.info(this.#filter.name, map);
	}
}
