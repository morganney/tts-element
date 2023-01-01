# [`tts-element`](https://www.npmjs.com/package/tts-element)

HTML custom element to convert text to speech using the [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) interface of the Web Speech API.

```html
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <title>tts-element CDN example</title>
    <style>
      text-to-speech:not(:defined) {
        display: none;
      }
    </style>
    <script type="module" src="https://unpkg.com/tts-element/dist/text-to-speech/defined.js"></script>
  </head>
  <body>
    <text-to-speech>Your run-of-the-mill text to speech example CDN example.</text-to-speech>
  </body>
</html>
```

Check out other [examples](./docs/examples.md).
