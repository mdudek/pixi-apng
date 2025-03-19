import { DOMAdapter, extensions, ExtensionType, Loader, path, ResolvedAsset } from 'pixi.js';
import { AnimatedPNG, AnimatedPNGOptions } from './animatedPNG';

import type { AssetExtension } from 'pixi.js';

// create the LoaderParser
const loader = {
  name: 'aPngLoader',
  extension: {
    type: ExtensionType.LoadParser,
  },
  async testParse(asset: any, options: ResolvedAsset) {
    // This function is used to test if the parse function should be run on the asset
    debugger;
    return true;
  },
  async parse(asset: any, options: ResolvedAsset, loader: Loader) {
    // Gets called on the asset it testParse passes. Useful to convert a raw asset into something more useful
    debugger;
  },
  unload(item: any) {
    // If an asset is parsed using this parser, the unload function will be called when the user requests an asset
    // to be unloaded. This is useful for things like sounds or textures that can be unloaded from memory
    debugger;
  },
};

/**
 * Handle the loading of animated PNG images. Registering this loader plugin will
 * load `.png` images as an ArrayBuffer and transform into an
 * AnimatedPNG object.
 * @ignore
 */
const AnimatedPNGAsset = {
  extension: ExtensionType.Asset,
  detection: {
    test: async (_) => {
      return true;
    },
    add: async (formats) => [...formats, 'apng'],
    remove: async (formats) => {
      return formats.filter((format) => format !== 'apng');
    },
  },
  //loader,
  loader: {
    name: 'aPngLoader',
    test: (url) => {
      return path.extname(url) === '.apng';
    },
    load: async (url, asset) =>
    {
      const response = await DOMAdapter.get().fetch(url);
      console.log(`response: ${JSON.stringify(response)}`);
      const buffer = await response.arrayBuffer();

      return AnimatedPNG.fromBuffer(buffer, asset?.data);
    },
    unload: async (asset) =>
    {
      asset.destroy();
    },
  },
} as AssetExtension<AnimatedPNG, AnimatedPNGOptions>;

extensions.add(AnimatedPNGAsset);

export { AnimatedPNGAsset };

