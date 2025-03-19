import '../src';
import { Application, Assets } from 'pixi.js';


(async () => {
  const app = new Application();
  await app.init({
    width: 800,
    height: 600,
    backgroundAlpha: 0,
    backgroundColor: 0x000000,
    preserveDrawingBuffer: false,
    antialias: false,
  });

  const title = document.title,
    imgs = {
      //apng: 'http://isparta.github.io/compare/image/dongtai/apng/1.png'
      apng: './img/1.apng'
    };

  Assets.load([
    { src: imgs.apng },
  ], progress => {
    document.title = Math.round(progress).toString();
  }).then(loadedImages => {
    document.title = title;

    window['apng'] = loadedImages[imgs.apng];
    window['apng'].x = 450;
    window['apng'].y = 160;
    app.stage.addChild(loadedImages[imgs.apng]);
  });

  document.body.appendChild(app.canvas);
})();
