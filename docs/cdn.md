You can load the `tts-element` package from a CDN and [`define`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define) the custom element in a couple of ways. `tts-element` must be loaded as a [JavaScript module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) (ES module).

You can use a `<script type="module">` element setting the `src` to a path using `defined.js` and accept the default element name of `text-to-speech`:

```html
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <title>tts-element default defined name</title>
    <style>
      text-to-speech:not(:defined) {
        display: none;
      }
    </style>
    <script type="module" src="https://unpkg.com/tts-element/dist/text-to-speech/defined.js"></script>
  </head>
  <body>
    <text-to-speech>The default element name is text-to-speech.</text-to-speech>
  </body>
</html>
```

Similarly, you can load `defined.js` with a query parameter of `name` to use a custom name for the element. Note, the CDN has been changed to a provider that does not remove query parameters from the request URL (see this [issue](https://github.com/mjackson/unpkg/issues/348) with unpkg.com):

```html
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <title>tts-element custom name</title>
    <style>
      my-tts:not(:defined) {
        display: none;
      }
    </style>
    <script type="module" src="https://cdn.jsdelivr.net/npm/tts-element@0.0.3-beta/dist/text-to-speech/defined.js?name=my-tts"></script>
  </head>
  <body>
    <my-tts>Use the query parameter "name" to define a custom name for the element when loading.</my-tts>
  </body>
</html>
```

If you want to control when the element is registered and defined you can use an `import` statement to load `element.js` and call `customElements.define()` while passing the returned element constructor:

```html
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <title>tts-element manual define</title>
    <style>
      speech-synth:not(:defined) {
        display: none;
      }
    </style>
    <script type="module">
      import ctor from 'https://unpkg.com/tts-element/dist/text-to-speech/element.js'

      customElements.define('speech-synth', ctor)
    </script>
  </head>
  <body>
    <speech-synth>You can import element.js to control when the element is defined.</speech-synth>
  </body>
</html>
```

You can (wrecklessly) combine all three approaches:

```html
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <title>tts-element combined example</title>
    <style>
      text-to-speech:not(:defined), my-tts:not(:defined), speech-synth:not(:defined) {
        display: none;
      }
    </style>
    <script type="module" src="https://unpkg.com/tts-element/dist/text-to-speech/defined.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/tts-element@0.0.3-beta/dist/text-to-speech/defined.js?name=speech-synth"></script>
    <script type="module">
      import ctor from 'https://unpkg.com/tts-element/dist/text-to-speech/element.js'

      customElements.define('speech-synth', ctor)
    </script>
  </head>
  <body>
    <text-to-speech>Your run-of-the-mill text-to-speech example.</text-to-speech>
    <my-tts>Example using the "name" query parameter.</my-tts>
    <speech-synth>Example using element.js.</speech-synth>
  </body>
</html>
```
