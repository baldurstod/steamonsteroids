import { JSONObject } from 'harmony-types';

const historyDbVersion = 1
const historyDbName = 'market-history';
const historyAssetStore = 'market-assets';
const historyTransactionsStore = 'market-transactions';

export type MarketAsset = {
	appId: string;
	contextId: string;
	assetId: string;
	asset: JSONObject;
}

export type MarketTransaction = {
	userId: string;
	transactionId: string;
	appId: string;
	contextId: string;
	assetId: string;
	listed: string;
	acted: string;
	price: string;
	type: 'gain' | 'loss';
}

export class MarketHistory {
	#dbPromiseResolve: (value: IDBDatabase | null) => void = () => { };
	#dbPromise = new Promise<IDBDatabase | null>((resolve) => this.#dbPromiseResolve = resolve);
	#dbOpenRequest?: IDBOpenDBRequest;

	async #getDb(): Promise<IDBDatabase | null> {
		if (!this.#dbOpenRequest) {
			this.#dbOpenRequest = window.indexedDB.open(historyDbName, historyDbVersion);
			this.#dbOpenRequest.addEventListener('error', () => {
				this.#dbPromiseResolve(null);
			});
			this.#dbOpenRequest.addEventListener('success', () => {
				this.#dbPromiseResolve(this.#dbOpenRequest!.result);
			});
			this.#dbOpenRequest.addEventListener('upgradeneeded', () => {
				const db = this.#dbOpenRequest!.result;

				// Create the stores
				db.createObjectStore(historyAssetStore, {
					keyPath: ["appId", "contextId", "assetId"],
				});

				db.createObjectStore(historyTransactionsStore, {
					keyPath: ["userId", "transactionId"],
				});
			});
		}

		return this.#dbPromise;
	}

	async insertTransaction(transaction: MarketTransaction): Promise<boolean> {
		return this.#insert(historyTransactionsStore, transaction);
	}

	async insertAsset(asset: MarketAsset): Promise<boolean> {
		return this.#insert(historyAssetStore, asset);
	}

	async #insert(store: string, data: MarketTransaction | MarketAsset): Promise<boolean> {
		const db = await this.#getDb();
		if (!db) {
			return false;
		}

		return new Promise<boolean>((resolve) => {
			const objectStore = db.transaction(store, 'readwrite').objectStore(store);

			const request = objectStore.put(data);

			request.addEventListener('success', () => resolve(true));
			request.addEventListener('error', () => resolve(false));
		});
	}
}
