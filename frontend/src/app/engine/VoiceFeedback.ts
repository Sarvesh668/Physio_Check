/**
 * Voice Feedback System (FINAL STABLE VERSION)
 */
import i18n from '../../i18n';

// Prevent Chrome Garbage Collection bug
const activeUtterances: SpeechSynthesisUtterance[] = [];

export class VoiceFeedback {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private ready: boolean = false;
  private lastAnnouncement: string = '';
  private lastAnnouncementTime: number = 0;
  private minTimeBetweenAnnouncements: number = 2000;
  private enabled: boolean = true;
  private pendingQueue: string[] = [];

  constructor() {
    this.synth = window.speechSynthesis;
    this.initializeVoices();
  }

  private initializeVoices(): void {
    const load = () => {
      const voices = this.synth.getVoices();
      if (voices.length > 0) {
        this.voices = voices;
        this.ready = true;
        console.log('[Voice] Engine Ready. Voices loaded:', voices.length);

        if (this.pendingQueue.length > 0) {
          const text = this.pendingQueue.shift();
          if (text) this.speak(text);
          this.pendingQueue = []; // Clear queue after first important flush
        }
      }
    };

    load();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = load;
    }

    // Fallback polling for initialization
    const interval = setInterval(() => {
      if (this.ready) clearInterval(interval);
      else load();
    }, 500);
  }

  private resolveLang(): string {
    const lang = i18n.language || 'en';
    if (lang.startsWith('hin') || lang.startsWith('hi')) return 'hi-IN';
    if (lang.startsWith('mar') || lang.startsWith('mr')) return 'mr-IN';
    if (lang.startsWith('es')) return 'es-ES';
    return 'en-US';
  }

  private getBestVoice(targetLang: string): SpeechSynthesisVoice | null {
    if (!this.voices.length) return null;

    // Direct match (prefers Female/Google)
    let voice = this.voices.find(v => v.lang === targetLang && (v.name.includes('Female') || v.name.includes('Google'))) ||
                this.voices.find(v => v.lang === targetLang);

    // Marathi -> Hindi fallback (Crucial for Windows/iOS where Marathi voices are often missing)
    if (!voice && targetLang === 'mr-IN') {
      console.warn('[Voice] Marathi voice missing, falling back to Hindi engine');
      voice = this.voices.find(v => v.lang === 'hi-IN' && v.name.includes('Google')) ||
              this.voices.find(v => v.lang === 'hi-IN');
    }

    return voice || null;
  }

  private speak(text: string): void {
    if (!this.enabled || !text) return;

    if (!this.ready) {
      console.log('[Voice] Queueing:', text);
      this.pendingQueue.push(text);
      return;
    }

    // Only cancel if already speaking to prevent "rapid-fire" overlapping
    if (this.synth.speaking) {
      this.synth.cancel();
      // Small timeout after cancel is safer for the browser hardware
      setTimeout(() => this.executeSpeak(text), 50);
    } else {
      this.executeSpeak(text);
    }
  }

  private executeSpeak(text: string): void {
    console.log('[Voice] Speaking:', text);
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = this.resolveLang();
    
    utterance.lang = lang;
    const voice = this.getBestVoice(lang);
    if (voice) utterance.voice = voice;

    utterance.rate = 0.9; // Slightly slower for better clarity in instructions
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // GC protection
    activeUtterances.push(utterance);
    utterance.onend = () => {
      const i = activeUtterances.indexOf(utterance);
      if (i > -1) activeUtterances.splice(i, 1);
    };

    this.synth.speak(utterance);
  }

  private canSpeak(message: string): boolean {
    const now = Date.now();
    // Prevent repeating the exact same message too fast
    if (message === this.lastAnnouncement && (now - this.lastAnnouncementTime < this.minTimeBetweenAnnouncements)) {
      return false;
    }
    // General rate limit
    if (now - this.lastAnnouncementTime < 1500) return false;

    this.lastAnnouncement = message;
    this.lastAnnouncementTime = now;
    return true;
  }

  public announceCorrectRep(repNumber: number): void {
    const message = i18n.t('workout.correctRep', { defaultValue: `Correct rep ${repNumber}`, count: repNumber });
    if (this.canSpeak(message)) this.speak(message);
  }

  public announceIncompleteRange(): void {
    const message = i18n.t('workout.incompleteROM', { defaultValue: 'Incomplete range of motion' });
    if (this.canSpeak(message)) this.speak(message);
  }

  public announceAlignment(instruction: string): void {
    if (this.canSpeak(instruction)) this.speak(instruction);
  }

  public announce(message: string): void {
    if (this.canSpeak(message)) this.speak(message);
  }

  public enable(): void { this.enabled = true; }
  public disable(): void { this.enabled = false; this.synth.cancel(); }
  public stop(): void { this.synth.cancel(); }
  public isEnabled(): boolean { return this.enabled; }
}

let instance: VoiceFeedback | null = null;
export function getVoiceFeedback(): VoiceFeedback {
  if (!instance) instance = new VoiceFeedback();
  return instance;
}