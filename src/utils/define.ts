const define = async (elemCtor: CustomElementConstructor, queryName: string | null) => {
  const name = queryName || 'text-to-speech'
  let ctor = null

  if (!window.customElements) {
    throw new Error('Browser not supported.')
  }

  /**
   * Support defining multiple custom element names with the same constructor.
   * This also allows for clients to import the element using both the
   * `/defined.js` path and the `/element.js` path on the same page.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define#exceptions
   */
  customElements.define(name, class extends elemCtor {})

  ctor = await customElements.whenDefined(name)

  return ctor
}

export { define }
