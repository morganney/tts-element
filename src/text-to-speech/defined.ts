import TextToSpeech from './element.js'
import { define } from '../utils/define.js'

export default await define(
  TextToSpeech,
  new URL(import.meta.url).searchParams.get('name')
)
