import { LanguageTags } from '../utils/languageTags.js'

enum UtteranceEvents {
  BOUNDARY = 'boundary',
  END = 'end',
  ERROR = 'error',
  PAUSE = 'pause',
  RESUME = 'resume',
  START = 'start'
}
enum SynthesisEvents {
  VOICESCHANGED = 'voiceschanged'
}
enum ElementEvents {
  TOGGLE_MUTE = 'togglemute'
}
enum Positions {
  TL = 'topLeft',
  TR = 'topRight',
  BL = 'bottomLeft',
  BR = 'bottomRight',
  TC = 'topCenter',
  RC = 'rightCenter',
  BC = 'bottomCenter',
  LC = 'leftCenter'
}
enum Alignments {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical'
}
enum Sizes {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

type Events = UtteranceEvents | SynthesisEvents | ElementEvents
type icons =
  | 'play'
  | 'stop'
  | 'pause'
  | 'replay'
  | 'volumeUp'
  | 'volumeOff'
  | 'volumeDown'
interface TTSBoundary {
  word: string
  startChar: number
  endChar: number
}
interface TTSState {
  isPlaying: boolean
  isPaused: boolean
  isMuted: boolean
  isError: boolean
  boundary: TTSBoundary
  previousAudibleVolume: number
}
interface TTSListenerRecord {
  target: EventTarget
  type: string
  listener: EventListener
}
interface TTSBoundaryUpdate {
  evt: SpeechSynthesisEvent
  boundary: TTSBoundary
}
type ToggleMuteListener = (evt: CustomEvent<{ wasMuted: boolean }>) => void
type TTSListener = (
  evt: CustomEvent<SpeechSynthesisEvent | SpeechSynthesisErrorEvent>
) => void
type TTSBoundaryListener = (evt: CustomEvent<TTSBoundaryUpdate>) => void

const defaultBoundary = { word: '', startChar: 0, endChar: 0 }
const defaultState: TTSState = {
  isPlaying: false,
  isPaused: false,
  isMuted: false,
  isError: false,
  boundary: defaultBoundary,
  previousAudibleVolume: 1
}
const setup = async () => {
  const url = new URL(import.meta.url)
  const directory = url.pathname.substring(0, url.pathname.lastIndexOf('/'))
  const baseUrl = `${url.origin}${directory}`
  const [html, css] = await Promise.all([
    fetch(`${baseUrl}/template`).then((resp) => resp.text()),
    fetch(`${baseUrl}/styles.css`).then((resp) => resp.text())
  ])
  const parser = new DOMParser()
  const template = parser
    .parseFromString(html, 'text/html')
    .querySelector('template') as HTMLTemplateElement
  const style = document.createElement('style')

  style.textContent = css
  template.content.prepend(style)

  return class TextToSpeech extends HTMLElement {
    #shadowRoot: ShadowRoot
    #template = template
    #synthesizer = window.speechSynthesis
    #utterance = new SpeechSynthesisUtterance()
    #state = Proxy.revocable(defaultState, {})
    #listeners: TTSListenerRecord[] = []
    #onBoundary: TTSBoundaryListener | null = null
    #onEnd: TTSListener | null = null
    #onResume: TTSListener | null = null
    #onStart: TTSListener | null = null
    #onToggleMute: ToggleMuteListener | null = null
    #punctuationRegex = /[^\P{P}'/-]+/gu
    #position: Positions = Positions.LC
    #alignment: Alignments = Alignments.HORIZONTAL
    #size: Sizes = Sizes.SMALL
    #highlight = false
    #selectors = {
      playToggleBtn: 'button[part="playToggle"]',
      replayBtn: 'button[part="replay"]',
      muteBtn: 'button[part="mute"]',
      playIcon: '[data-icon="play"]',
      pauseIcon: '[data-icon="pause"]',
      stopIcon: '[data-icon="stop"]',
      volumeDownIcon: '[data-icon="volumeDown"]',
      volumeOffIcon: '[data-icon="volumeOff"]',
      volumeUpIcon: '[data-icon="volumeUp"]'
    }

    /**
     * Observed attributes. Most are the properties on `SpeechSynthesisUtterance`.
     *
     * @see https://html.spec.whatwg.org/multipage/custom-elements.html#concept-custom-element-definition-observed-attributes
     * @see https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance#properties
     */
    static get observedAttributes() {
      const ux = ['highlight']
      const layout = ['position', 'alignment', 'size']
      const speechSynth = ['lang', 'pitch', 'rate', 'text', 'voice', 'volume']

      return [...ux, ...layout, ...speechSynth]
    }

    constructor() {
      super()

      if (!this.#synthesizer) {
        throw new Error('Browser does not support `speechSynthesis`.')
      }

      this.#shadowRoot = this.attachShadow({ mode: 'open' })
      this.#shadowRoot.appendChild(this.#template.content.cloneNode(true))
      this.#initVoices()
    }

    /**
     * Responds to `voiceschanged` event. Necessary for some browsers as
     * `SpeechSynthesis.getVoices` may return an empty list until a full list is known.
     * @see https://wicg.github.io/speech-api/#eventdef-speechsynthesis-voiceschanged
     * @see https://wicg.github.io/speech-api/#dom-speechsynthesis-getvoices
     */
    #initVoices() {
      this.#attachListener(this.#synthesizer, 'voiceschanged', () => {
        this.dispatchEvent(
          new CustomEvent(SynthesisEvents.VOICESCHANGED, {
            detail: this.#synthesizer.getVoices()
          })
        )

        if (this.hasAttribute('voice')) {
          this.voice = this.getAttribute('voice')
        }
      })
    }

    #attachListener(target: EventTarget, type: string, listener: EventListener) {
      target.addEventListener(type, listener)
      this.#listeners.push({ target, type, listener })
    }

    #removeListener(target: EventTarget, type: string, listener: EventListener) {
      target.removeEventListener(type, listener)
    }

    /**
     * Not all browsers return `evt.charLength` on SpeechSynthesisUtterance `boundary` events.
     */
    #getBoundaryWordCharLength(startIndex: number): number {
      const match = this.text.substring(startIndex).match(/.+?\b/)

      return match ? match[0].length : 0
    }

    #isPunctuation(text: string): boolean {
      const trimmed = text.trim()

      return this.#punctuationRegex.test(trimmed) && trimmed.length === 1
    }

    #stripPunctuation(text: string): string {
      return text.replace(this.#punctuationRegex, '')
    }

    #eachNode(root: Node, cb: (node: Node) => boolean | void): undefined | false {
      if (cb(root) === false) {
        return false
      }

      for (const node of root.childNodes) {
        if (this.#eachNode(node, cb) === false) {
          return
        }
      }
    }

    #speak() {
      this.#synthesizer.speak(this.#utterance)
    }

    #respeak() {
      this.#synthesizer.resume()
      this.#synthesizer.cancel()
      this.#synthesizer.speak(this.#utterance)
    }

    #pause() {
      this.#synthesizer.pause()
    }

    #resume() {
      this.#synthesizer.resume()
    }

    #cancel() {
      this.#synthesizer.cancel()
    }

    #clamp(value: number, min = 0, max = 1): number {
      return Math.max(min, Math.min(value, max))
    }

    #markBoundary(boundary: TTSBoundary) {
      let endScan = false
      //let match = null
      const text = { value: '' }

      this.#eachNode(this, (node) => {
        if (endScan) {
          return false
        }

        if (node instanceof Text) {
          const textContent = node.textContent?.replace(/\s+/g, ' ').trim()

          if (textContent) {
            const textLength = text.value.length

            text.value += `${textContent} `

            if (boundary.word) {
              const start = boundary.startChar - textLength
              const end = boundary.endChar - textLength
              //const prev = textContent.substring(0, start)
              const found = textContent.substring(start, end)
              //const after = textContent.substring(end, textContent.length)

              if (found) {
                const mark = document.createElement('mark')

                mark.append(document.createTextNode(found))
                //match = node
                endScan = true
              }
            }
          }
        }
      })
    }

    get state() {
      return this.#state.proxy
    }

    /**
     * Below is support for "event handler attributes". They are discouraged, but still
     * regularly used in practice:
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes#event_handler_attributes
     *
     * These handlers rely on their corresponding global attributes:
     * - onerror
     * - onpause
     */

    set onboundary(listener: TTSBoundaryListener | null) {
      if (typeof listener === 'function' || listener === null) {
        this.#onBoundary = listener
      }
    }

    get onboundary() {
      return this.#onBoundary
    }

    set onend(listener: TTSListener | null) {
      if (typeof listener === 'function' || listener === null) {
        this.#onEnd = listener
      }
    }

    get onend() {
      return this.#onEnd
    }

    set onresume(listener: TTSListener | null) {
      if (typeof listener === 'function' || listener === null) {
        this.#onResume = listener
      }
    }

    get onresume() {
      return this.#onResume
    }

    set onstart(listener: TTSListener | null) {
      if (typeof listener === 'function' || listener === null) {
        this.#onStart = listener
      }
    }

    get onstart() {
      return this.#onStart
    }

    set ontogglemute(listener: ToggleMuteListener | null) {
      if (typeof listener === 'function' || listener === null) {
        this.#onToggleMute = listener
      }
    }

    get ontogglemute() {
      return this.#onToggleMute
    }

    /**
     * Start the observed attributes setters/getters.
     * These are "IDL" attributes, i.e. JavaScript properties that reflect the corresponding
     * "content" attribute in the HTML. Both are mapped to the corresponding
     * `SpeechSynthesisUtterance` properties.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes#content_versus_idl_attributes
     */

    /**
     * Sets the lang for the `SpeechSynthesisUtterance`.
     * @see https://wicg.github.io/speech-api/#dom-speechsynthesisutterance-lang
     */
    set lang(value: string) {
      if (typeof value === 'string') {
        const found = Object.values(LanguageTags).find((tag) => value === tag)

        if (found) {
          const currentVoice = this.voice

          this.#utterance.lang = found
          // Reset the voice to ensure compatibility with set lang
          this.voice = currentVoice

          if (found !== this.getAttribute('lang')) {
            this.setAttribute('lang', found)
          }
        }
      }
    }

    get lang() {
      return this.#utterance.lang
    }

    /**
     * Sets the pitch for the `SpeechSynthesisUtterance`.
     * @see https://wicg.github.io/speech-api/#dom-speechsynthesisutterance-pitch
     */
    set pitch(value: number | string) {
      const pitch = this.#clamp(Number(parseFloat(value.toString()).toPrecision(2)), 0, 2)

      if (!Number.isNaN(pitch)) {
        const pitchStr = pitch.toString()

        this.#utterance.pitch = pitch

        if (pitchStr !== this.getAttribute('pitch')) {
          this.setAttribute('pitch', pitchStr)
        }
      }
    }

    get pitch() {
      return this.#utterance.pitch
    }

    /**
     * Sets the text for the `SpeechSynthesisUtterance`.
     * @see https://wicg.github.io/speech-api/#dom-speechsynthesisutterance-text
     */
    set text(value: string) {
      this.#utterance.text = value

      if (value !== this.getAttribute('text')) {
        this.setAttribute('text', value)
      }
    }

    get text() {
      return this.#utterance.text
    }

    /**
     * Sets the rate for the `SpeechSynthesisUtterance`.
     * @see https://wicg.github.io/speech-api/#dom-speechsynthesisutterance-rate
     */
    set rate(value: number | string) {
      const rate = this.#clamp(
        Number(parseFloat(value.toString()).toPrecision(3)),
        0.1,
        10
      )

      if (!Number.isNaN(rate)) {
        const rateStr = rate.toString()

        this.#utterance.rate = rate

        if (rateStr !== this.getAttribute('rate')) {
          this.setAttribute('rate', rateStr)
        }
      }
    }

    get rate() {
      return this.#utterance.rate
    }

    /**
     * Sets the voice for the `SpeechSynthesisUtterance`.
     * @see https://wicg.github.io/speech-api/#dom-speechsynthesisutterance-voice
     */
    set voice(value: string | SpeechSynthesisVoice | null) {
      const voices = this.#synthesizer.getVoices()
      const nullify = () => {
        this.#utterance.voice = null
        this.removeAttribute('voice')
      }

      if (value) {
        let found = null

        if (typeof value === 'string') {
          /**
           * The IDL (JavaScript property) will attempt to map the `voice` content (HTML) attribute to
           * the `name` of a `SpeechSynthesisVoice` supported by the user agent.
           */
          found = voices.find((voice) => voice.name === value)
        } else {
          found = voices.find((voice) => {
            return (
              voice.name === value.name &&
              voice.lang === value.lang &&
              voice.default === value.default &&
              voice.voiceURI === value.voiceURI &&
              voice.localService === value.localService
            )
          })
        }

        if (found) {
          if (this.lang) {
            if (found.lang === this.lang) {
              this.#utterance.voice = found
            } else {
              // The found voice must have the same lang as any set lang
              nullify()
            }
          } else {
            this.#utterance.voice = found
          }

          if (
            this.#utterance.voice &&
            this.#utterance.voice.name !== this.getAttribute('voice')
          ) {
            this.setAttribute('voice', this.#utterance.voice.name)
          }
        }
      } else {
        nullify()
      }
    }

    get voice() {
      return this.#utterance.voice
    }

    /**
     * Sets the volume for the `SpeechSynthesisUtterance`.
     * @see https://wicg.github.io/speech-api/#dom-speechsynthesisutterance-volume
     */
    set volume(value: number | string) {
      const volume = this.#clamp(Number(parseFloat(value.toString()).toPrecision(2)))

      if (!Number.isNaN(volume)) {
        const volStr = volume.toString()

        if (this.isConnected) {
          const isMuting = volume === 0

          /**
           * Check that we're not already in a muted state, so that when
           * the attribute needs to be reset to reflect the new prop change,
           * the `previousAudibleVolume` is not overwritten by the reflection update,
           * (thereby negating the utility of `previousAudibleVolume`).
           */
          if (isMuting && !this.state.isMuted) {
            const utterVolume = this.#utterance.volume
            /**
             * This can run during attributeChanged callback which
             * will run before the connected callback during the ctor initialization.
             *
             * Chrome sets default volume to -1, reset it to 1.
             * Otherwise (Safari, FF, etc.), use the SpeechSynthesisUtterance.volume.
             *
             * @see https://bugs.chromium.org/p/chromium/issues/detail?id=1385117
             */
            const prevVolume = utterVolume === -1 ? 1 : utterVolume

            this.#state.proxy.previousAudibleVolume = prevVolume
          }

          this.#state.proxy.isMuted = isMuting
        }

        this.#utterance.volume = volume

        if (volStr !== this.getAttribute('volume')) {
          this.setAttribute('volume', volStr)
        }
      }
    }

    get volume() {
      return this.#utterance.volume
    }

    set position(value: Positions) {
      if (Object.values(Positions).includes(value)) {
        this.#position = value

        if (value !== this.getAttribute('position')) {
          this.setAttribute('position', value)
        }
      }
    }

    get position() {
      return this.#position
    }

    set alignment(value: Alignments) {
      if (Object.values(Alignments).includes(value)) {
        this.#alignment = value

        if (value !== this.getAttribute('alignment')) {
          this.setAttribute('alignment', value)
        }
      }
    }

    get alignment() {
      return this.#alignment
    }

    set size(value: Sizes) {
      if (Object.values(Sizes).includes(value)) {
        this.#size = value

        if (value !== this.getAttribute('size')) {
          this.setAttribute('size', value)
        }
      }
    }

    get size() {
      return this.#size
    }

    set highlight(value: boolean) {
      if (value) {
        this.#highlight = true

        if (!this.hasAttribute('highlight')) {
          this.setAttribute('highlight', '')
        }
      } else {
        this.#highlight = false

        if (this.hasAttribute('highlight')) {
          this.removeAttribute('highlight')
        }
      }
    }

    get highlight() {
      return this.#highlight
    }

    /**
     * Start reaction lifecycle callbacks.
     * @see https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-reactions
     */

    connectedCallback() {
      const icons = [
        ...(this.#shadowRoot.querySelectorAll('[data-icon]') as NodeListOf<SVGElement>)
      ].reduce(
        (prev, curr) => ({
          ...prev,
          [curr.dataset.icon as string]: curr
        }),
        {} as Record<icons, SVGElement>
      )
      const playToggleBtn = this.#shadowRoot.querySelector(
        this.#selectors.playToggleBtn
      ) as HTMLButtonElement
      const replayBtn = this.#shadowRoot.querySelector(
        this.#selectors.replayBtn
      ) as HTMLButtonElement
      const muteBtn = this.#shadowRoot.querySelector(
        this.#selectors.muteBtn
      ) as HTMLButtonElement
      const renderVolumeDownIf = (condition: boolean) => {
        if (condition) {
          icons.volumeUp.removeAttribute('data-active')
          icons.volumeDown.setAttribute('data-active', 'true')
        }
      }
      const renderVolumeUpIf = (condition: boolean) => {
        if (condition) {
          icons.volumeDown.removeAttribute('data-active')
          icons.volumeUp.setAttribute('data-active', 'true')
        }
      }
      const renderOffIcon = (type: 'pause' | 'stop' = 'pause') => {
        icons.play.removeAttribute('data-active')
        icons[type].setAttribute('data-active', 'true')
      }
      const renderPlayIcon = () => {
        icons.stop.removeAttribute('data-active')
        icons.pause.removeAttribute('data-active')
        icons.play.setAttribute('data-active', 'true')
      }

      this.#attachListener(playToggleBtn, 'click', () => {
        if (this.#synthesizer.paused) {
          this.#resume()
        } else if (this.#synthesizer.speaking) {
          this.#pause()
        } else {
          this.#speak()
        }
      })
      this.#attachListener(replayBtn, 'click', () => {
        this.#respeak()
      })
      this.#attachListener(muteBtn, 'click', () => {
        const wasMuted = this.state.isMuted
        const customEvt = new CustomEvent(ElementEvents.TOGGLE_MUTE, {
          detail: { wasMuted }
        })

        if (wasMuted) {
          this.volume = this.state.previousAudibleVolume ?? 1
        } else {
          this.volume = 0
        }

        if (typeof this.#onToggleMute === 'function') {
          this.#onToggleMute(customEvt)
        }

        this.dispatchEvent(customEvt)
      })

      // Initialize UI/State/Listeners
      icons.play.setAttribute('data-active', 'true')
      icons.volumeDown.setAttribute('data-active', 'true')
      this.#utterance.text = this.hasAttribute('text')
        ? this.text
        : this.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      this.#state.revoke()
      this.#state = Proxy.revocable(defaultState, {
        set: (target, prop, newValue, receiver) => {
          switch (prop) {
            case 'isPlaying': {
              if (newValue === true) {
                renderOffIcon('pause')
                renderVolumeUpIf(!target.isMuted)
                replayBtn.removeAttribute('data-active')
              } else {
                renderPlayIcon()
                renderVolumeDownIf(!target.isMuted)
              }
              break
            }
            case 'isPaused': {
              if (newValue === true) {
                replayBtn.setAttribute('data-active', 'true')
              }
              break
            }
            case 'isMuted': {
              if (newValue === true) {
                icons.volumeDown.removeAttribute('data-active')
                icons.volumeUp.removeAttribute('data-active')
                icons.volumeOff.setAttribute('data-active', 'true')
              } else {
                icons.volumeOff.removeAttribute('data-active')

                if (this.#synthesizer.speaking && !this.#synthesizer.paused) {
                  icons.volumeDown.removeAttribute('data-active')
                  icons.volumeUp.setAttribute('data-active', 'true')
                } else {
                  icons.volumeUp.removeAttribute('data-active')
                  icons.volumeDown.setAttribute('data-active', 'true')
                }
              }
              break
            }
            case 'boundary': {
              if (this.#highlight) {
                this.#markBoundary(newValue)
              }

              break
            }
            case 'isError': {
              replayBtn.removeAttribute('data-active')
              break
            }
          }

          return Reflect.set(target, prop, newValue, receiver)
        }
      })

      // Update state to have DOM react to any attributes set during attributeChangedCallback
      this.#state.proxy.isMuted = this.volume === 0

      // Register listeners for `SpeechSynthesisUtterance` events.
      Object.values(UtteranceEvents).forEach((type) => {
        this.#attachListener(this.#utterance, type, (evt) => {
          if ([UtteranceEvents.START, UtteranceEvents.RESUME].includes(type)) {
            this.#state.proxy.isPaused = false
            this.#state.proxy.isPlaying = true
          }

          if ([UtteranceEvents.END, UtteranceEvents.PAUSE].includes(type)) {
            this.#state.proxy.isPlaying = false

            if (type === UtteranceEvents.PAUSE) {
              this.#state.proxy.isPaused = true
            }
          }

          if (type === UtteranceEvents.BOUNDARY) {
            const event = evt as SpeechSynthesisEvent
            const { charIndex: startChar } = event
            const charLength =
              event.charLength ?? this.#getBoundaryWordCharLength(startChar)
            const endChar = startChar + charLength
            const word = this.text.substring(startChar, endChar)

            if (word && !this.#isPunctuation(word)) {
              const boundary = { word, startChar, endChar }
              const customEvt = new CustomEvent(type, {
                detail: { boundary, evt: event }
              })

              this.#state.proxy.boundary = boundary
              this.#onBoundary?.(customEvt)
              this.dispatchEvent(customEvt)
            }
          } else {
            const customEvt = new CustomEvent(type, {
              detail: evt as SpeechSynthesisEvent | SpeechSynthesisErrorEvent
            })

            this[`on${type}`]?.(customEvt)
            this.dispatchEvent(customEvt)
          }
        })
      })
    }

    attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
      switch (attrName) {
        case 'lang':
          this.lang = newValue
          break
        case 'pitch':
          this.pitch = newValue
          break
        case 'rate':
          this.rate = newValue
          break
        case 'text':
          this.text = newValue
          break
        case 'voice':
          this.voice = newValue
          break
        case 'volume':
          this.volume = newValue
          break
        case 'position':
          this.position = newValue as Positions
          break
        case 'align':
          this.alignment = newValue as Alignments
          break
        case 'size':
          this.size = newValue as Sizes
          break
        case 'highlight': {
          if (newValue === null) {
            this.highlight = false
          } else {
            this.highlight = true
          }
          break
        }
      }
    }

    disconnectedCallback() {
      this.#state.revoke()
      this.#listeners.forEach(({ target, type, listener }) => {
        this.#removeListener(target, type, listener)
      })
    }

    // Public custom API

    speak(): void {
      this.#speak()
    }

    respeak(): void {
      this.#respeak()
    }

    pause(): void {
      this.#pause()
    }

    resume(): void {
      this.#resume()
    }

    cancel(): void {
      this.#cancel()
    }
  }
}

export type { Events }
export default await setup()
