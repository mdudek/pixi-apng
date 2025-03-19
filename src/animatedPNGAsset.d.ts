import { AnimatedPNG, AnimatedPNGOptions } from './animatedPNG';
import type { AssetExtension } from 'pixi.js';
/**
 * Handle the loading of animated PNG images. Registering this loader plugin will
 * load `.png` images as an ArrayBuffer and transform into an
 * AnimatedPNG object.
 * @ignore
 */
declare const AnimatedPNGAsset: AssetExtension<AnimatedPNG, AnimatedPNGOptions>;
export { AnimatedPNGAsset };
