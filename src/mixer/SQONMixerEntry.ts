import SQONMixer from './SQONMixer';
import SQON, { CombinationKey } from '../SQON';

export interface ReferenceSQON {
  op: CombinationKey;
  content: Array<SQON | SQONMixerEntry>;
}

class SQONMixerEntry {
  _class = 'SQONMixerEntry';
  id: string;
  sqon: SQON | ReferenceSQON;
  references: Set<string>;
  private _mixer: SQONMixer; // Maintain a reference to its parent

  constructor(mixer: SQONMixer, sqon: SQON | ReferenceSQON) {
    this.id = mixer.getNextId();
    this._mixer = mixer;
    this.references = new Set<string>();
    this.sqon = sqon;

    //Build reference list
    sqon.content.forEach((sqon) => {
      if ((<SQONMixerEntry>sqon).id) {
        this.references.add((<SQONMixerEntry>sqon).id);
      }
    });
  }

  mixer() {
    return this._mixer;
  }

  resolve() {
    return this._mixer.resolve(this.id);
  }

  and(sqons: Array<SQON | SQONMixerEntry | string>) {
    return this._mixer.and([this, ...sqons]);
  }
  not(sqons: Array<SQON | SQONMixerEntry | string>) {
    return this._mixer.not([this, ...sqons]);
  }
  or(sqons: Array<SQON | SQONMixerEntry | string>) {
    return this._mixer.or([this, ...sqons]);
  }

  hasLoops(entries: SQONMixerEntry[]) {
    return this._mixer.hasLoops([this, ...entries]);
  }

  allReferences() {
    return this._mixer.allReferences(this.id);
  }
}

export default SQONMixerEntry;
