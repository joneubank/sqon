import SQON, { CombinationKey } from './SQON';

interface ReferenceSQON {
  op: CombinationKey;
  content: Array<SQON | string>; // strings here are the id of Mixer Entries
}

interface SQONMixerEntry {
  id: string;
  sqon: SQON | ReferenceSQON;
  references: string[];
}

class SQONMixer {
  content: { [id: string]: SQONMixerEntry } = {};
  private _refCounter: number = 0;

  private getNextId(): string {
    return `_${this._refCounter++}`;
  }

  put(sqon: SQON): SQONMixerEntry {
    // Get reference ID and increment counter
    const id = this.getNextId();
    const entry: SQONMixerEntry = { id, sqon, references: [] };

    this.content[id] = entry;
    return entry;
  }

  get(id: string): SQONMixerEntry {
    return this.content[id];
  }

  private _combine(op: CombinationKey, sqons: Array<SQON | SQONMixerEntry>) {
    // Since this is making a new MixerEntry, it can't be generating a loop, so no need to check :)
    const references: string[] = [];
    const id: string = this.getNextId();

    const refSqon: ReferenceSQON = { op, content: [] };

    sqons.forEach((sqon) => {
      if (sqon instanceof SQON) {
        refSqon.content.push(sqon);
      } else {
        if (!this.content.hasOwnProperty(sqon.id)) {
          throw new Error(
            `Provided SQON Mixer Entry with id=${sqon.id} does not exist in this SQONMixer.`,
          );
        }
        refSqon.content.push(sqon.id);
        references.push(sqon.id);
      }
    });

    const combinedRef: SQONMixerEntry = { references, id, sqon: refSqon };
    this.content[id] = combinedRef;
    return combinedRef;
  }
  and(sqons: Array<SQON | SQONMixerEntry>): SQONMixerEntry {
    return this._combine(CombinationKey.And, sqons);
  }
  not(sqons: Array<SQON | SQONMixerEntry>): SQONMixerEntry {
    return this._combine(CombinationKey.Not, sqons);
  }
  or(sqons: Array<SQON | SQONMixerEntry>): SQONMixerEntry {
    return this._combine(CombinationKey.Or, sqons);
  }

  resolve(id: string): SQON {
    const candidate = this.content[id];
    if (candidate instanceof SQON) {
      return candidate;
    }

    const compiledSqon = {
      op: candidate.sqon.op,
      content: (candidate.sqon as ReferenceSQON).content.map((internalSqon) => {
        if (internalSqon instanceof SQON) {
          return SQON;
        }
        return this.resolve(internalSqon);
      }),
    };
  }

  listReferences(id: string): string[] {
    const output = new Set<string>();

    const root = this.get(id);

    const refsToCheck: string[] = [];

    root.references.forEach((reference) => refsToCheck.push(reference));

    for (let i = 0; i < refsToCheck.length; i++) {
      const ref = refsToCheck[i];
      output.add(ref);
      const entry = this.get(ref);

      entry.references.forEach((entryRef) => {
        output.add(entryRef);
        if (!refsToCheck.includes(entryRef)) {
          refsToCheck.push(entryRef);
        }
      });
    }

    return Array.from(output);
  }
}

export default SQONMixer;
