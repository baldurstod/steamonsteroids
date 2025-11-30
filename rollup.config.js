import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import del from 'rollup-plugin-delete';

const isProduction = process.env.BUILD === 'production';
const isFirefox = process.env.BROWSER === 'firefox';

export default [
	{
		input: './src/client/ts/content/content.ts',
		output: {
			file: './build/client/content.js',
			format: 'esm',
		},
		plugins: [
			isProduction ? del({ targets: 'build/client/*' }) : null,
			/*styles({
				mode: [
					'inject',
					(varname) => `import { styleInject } from 'harmony-ui';styleInject(${varname});`
				],
			}),*/
			json({
				compact: true,
			}),
			typescript(),
			nodeResolve({ dedupe: ['harmony-ui'] }),
			isProduction ? terser() : null,
			copy({
				targets: [
					{ src: isFirefox ? 'src/client/manifest_firefox.json' : 'src/client/manifest.json', dest: 'build/client', rename: 'manifest.json' },
					{ src: 'src/client/html/popup.html', dest: 'build/client/popups/' },
					{ src: 'src/client/css/popup.css', dest: 'build/client/popups/' },
					{ src: 'src/client/css/content.css', dest: 'build/client/css/' },
					{ src: 'src/client/images/', dest: 'build/client/' },
				]
			}),
		],
	},
	{
		input: './src/client/ts/injected/injected.ts',
		output: {
			file: './build/client/injected.js',
			format: 'esm',
		},
		plugins: [
			typescript(),
			isProduction ? terser() : null,
		],
	},
	{
		input: './src/client/ts/background/background.ts',
		output: {
			file: './build/client/background.js',
			format: 'esm',
		},
		plugins: [
			typescript(),
			nodeResolve(),
			isProduction ? terser() : null,
		],
	},
	{
		input: './src/client/ts/options.ts',
		output: {
			file: './build/client/options/options.js',
			format: 'esm',
		},
		plugins: [
			typescript(),
			nodeResolve(),
			isProduction ? terser() : null,
			copy({
				targets: [
					{ src: 'src/client/html/options.html', dest: 'build/client/options/' },
					{ src: 'src/client/css/options.css', dest: 'build/client/options/' },
				]
			}),
		],
	},
];
