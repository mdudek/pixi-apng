# @mdudek/pixi-apng

Let Pixi.js support apng images. And allow control of its operation.

### Important changes:   
 - Depends on pixi.js v8
 - The source code was converted to typescript 
 - Bundled by webpack 

## DEMO

- [**Use the demo**](http://jsbin.com/nodeto/edit?html,js,output)

# USE

### ES6

```bash

# Support pixi8.0+
npm install @mdudek/pixi-apng
```

```javascript
import '@mdudek/pixi-apng'
import { Application, TickerPlugin, Renderer, BatchRenderer, Loader, LoaderResource } from 'pixi.js';

Application.registerPlugin(TickerPlugin);
Renderer.registerPlugin('batch', BatchRenderer);
const app = new Application({
    width: 800,
    height: 600,
    backgroundAlpha: 0,
    backgroundColor: 0x000000,
    preserveDrawingBuffer: false,
    antialias: false,
});

const loader = Loader.shared,
    title = document.title,
    loadOption = {
        loadType: LoaderResource.LOAD_TYPE.XHR,
        xhrType: LoaderResource.XHR_RESPONSE_TYPE.BUFFER,
        crossOrigin: ''
    },
    imgs = {
        apng: 'http://isparta.github.io/compare/image/dongtai/apng/1.png'
        // apng:'./1.png'
    };


loader.add(imgs.apng, loadOption);

loader.load((progress, resources) => {
    document.title = title;

    window['apng'] = new Image(imgs.apng, resources);

    let apngSprite = window['apng'].sprite;

    apngSprite.x = 450;
    apngSprite.y = 160;
~~~~
    app.stage.addChild(apngSprite);

});

loader.onProgress.add(() => {
    document.title = Math.round(loader.progress).toString();
});

document.body.appendChild(app.view);
```

## API

### `.play(bout,callback)`

Play animation
`bout`Used to specify the number of plays
`callback`Callback executed after the specified number of plays has been completed

### `.pause()`

Pause animation

### `.stop()`

Stop animation

### `.jumpToFrame(frame)`

Jump to the specified frame

### `.getDuration()`

Get the total duration of an animation single play

### `.getFramesLength()`

Get the number of animation frames

### `.on(status,callback)`

Used to invoke the specified method in the specified phase of the animation
`status`Four states(`playing`、`played`、`pause`、`stop`)
`callback`Callback, there is a parameter. The status of the current animation is recorded.
