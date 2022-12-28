# tts-element

HTML custom element to convert text to speech using the [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) interface of the Web Speech API.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>tts-element</title>
     <style>
        text-to-speech:not(:defined) {
          display: none;
        }
     </style>
    <script type="module" src="./dist/text-to-speech/defined.js"></script>
  </head>
  <body>
    <text-to-speech>Your run-of-the-mill text-to-speech example.</text-to-speech>
  </body>
</html>
```