import { JSONObject } from 'harmony-types';

const historyDbVersion = 1
const historyDbName = 'market-history';
const historyAssetStore = 'market-assets';
const historyTransactionStore = 'market-transactions';
const userRowIndex = 'user-row';

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
	// 1 based index from the end of the history. The last transaction has the index 1 and so on
	row: number;
	listed: string;
	acted: string;
	price: string;
	type: 'gain' | 'loss' | 'unknown';
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
					keyPath: ['appId', 'contextId', 'assetId'],
				});

				const transactionStore = db.createObjectStore(historyTransactionStore, {
					keyPath: ['userId', 'transactionId', 'row'],
				});

				transactionStore.createIndex(userRowIndex, ['userId', 'row'], { unique: true });
			});
		}

		return this.#dbPromise;
	}

	async insertTransaction(transaction: MarketTransaction): Promise<boolean> {
		return this.#insert(historyTransactionStore, transaction);
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

	/**
	 * Return the last stored transaction
	 * @returns The last (most recent) row or -1 in case of error
	 */
	async getLastRow(): Promise<number> {
		const db = await this.#getDb();
		if (!db) {
			return -1;
		}

		return new Promise<number>((resolve) => {
			const objectStore = db.transaction(historyTransactionStore, 'readonly').objectStore(historyTransactionStore);

			// Open the cursor on the row index decreasing
			let index = objectStore.index(userRowIndex);
			let cursorRequest = index.openCursor(undefined, 'prev');

			cursorRequest.addEventListener('error', () => resolve(-1));
			cursorRequest.addEventListener('success', () => {
				const cursor = cursorRequest.result;
				if (cursor) {
					// Access the first record
					const value = cursor.value;
					if (value) {
						// Return the first row
						resolve((cursor.value as MarketTransaction).row);
						return;
					}
				}
				resolve(-1);
			});
		});
	}
}
