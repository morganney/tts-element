You can assign event listeners, attributes, and properties to `tts-element` dynamically from your scripts. You can also assign content attributes in the HTML directly, these are mapped to their associated IDL attributes (JavaScript properties), and vice-versa. See the [difference between content and IDL attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes#content_versus_idl_attributes).

```html
<script type="module">
  /**
   * Due to top level await, this import will wait unitl all associated HTML/CSS
   * has been loaded for the component before executing subsequent code.
   */
  import 'https://unpkg.com/tts-element/dist/text-to-speech/defined.js'

  const tts = document.getElementsByTagName('text-to-speech')[0]

  tts.volume = 0.5
  tts.setAttribute('alignment', 'vertical')
  tts.addEventListener('boundary', (evt) => {
    console.log(evt.detail.boundary)
  })
</script>
```
