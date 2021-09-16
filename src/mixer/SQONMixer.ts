import SQON, { Operator, CombinationKey } from '../SQON';
import SQONMixerEntry, { ReferenceSQON } from './SQONMixerEntry';

function isSQONMixerEntry(obj: any): boolean {
  return obj?._class === 'SQONMixerEntry';
}

class SQONMixer {
  content: { [id: string]: SQONMixerEntry } = {};
  private _refCounter: number = 0;
  private _label: string;

  constructor(label?: string) {
    this._label = (label ? `${label}_` : '') + `${Date.now()}`;
  }

  getNextId(): string {
    return `${this._label}_${this._refCounter++}`;
  }

  /**
   * Check if this mixer has an entry with the provided ID
   * @param id
   */
  has(id: string): boolean {
    return this.content.hasOwnProperty(id);
  }

  put(sqon: SQON | ReferenceSQON): SQONMixerEntry {
    // Get reference ID and increment counter
    const entry: SQONMixerEntry = new SQONMixerEntry(this, sqon);

    this.content[entry.id] = entry;
    return entry;
  }

  get(id: string): SQONMixerEntry | SQON {
    return this.content[id];
  }

  remove(id: string): void {
    if (this.has(id)) {
      delete this.content[id];
    }
  }

  combine(
    op: CombinationKey,
    sqons: Array<SQON | SQONMixerEntry | string>,
  ): ReferenceSQON {
    const references: Set<string> = new Set<string>();

    const combinedSqon: ReferenceSQON = { op, content: [] };

    // Do checks for type and if references are not part of this mixer
    const resolvedEntries = sqons.map((sqon) => {
      if (sqon instanceof String) {
        // sqon is string id
        const resolvedSqon = this.get(<string>sqon);
        if (!resolvedSqon) {
          throw new Error(
            `Provided id ${sqon} is not an entry in this SQONMixer`,
          );
        }
        return resolvedSqon;
      } else if (isSQONMixerEntry(sqon)) {
        if (!this.has((<SQONMixerEntry>sqon).id)) {
          throw new Error(
            `Provided SQONMixerEntry with id=${
              (<SQONMixerEntry>sqon).id
            } does not exist in this SQONMixer.`,
          );
        }
        return sqon;
      } else {
        return <SQON>sqon;
      }
    });

    const mixerEntries = <SQONMixerEntry[]>(
      resolvedEntries.filter((entry) => isSQONMixerEntry(entry))
    );

    if (this.hasLoops(mixerEntries)) {
      throw new Error(
        'Cannot combine provided references due to self reference loops.',
      );
    }

    // Add these type checked SQONs and SQONMixerEntries to the combine ReferenceSQON
    resolvedEntries.forEach((sqon: SQONMixerEntry) => {
      combinedSqon.content.push(sqon);
    });
    return combinedSqon;
  }

  private _combine(
    op: CombinationKey,
    sqons: Array<SQON | SQONMixerEntry | string>,
  ) {
    const refSqon = this.combine(op, sqons);

    // Go through our sorted sqons and add to combinedSqon
    const output: SQONMixerEntry = new SQONMixerEntry(this, refSqon);
    this.content[output.id] = output;
    return output;
  }

  and(sqons: Array<SQON | SQONMixerEntry | string>): SQONMixerEntry {
    return this._combine(CombinationKey.And, sqons);
  }
  not(sqons: Array<SQON | SQONMixerEntry | string>): SQONMixerEntry {
    return this._combine(CombinationKey.Not, sqons);
  }
  or(sqons: Array<SQON | SQONMixerEntry | string>): SQONMixerEntry {
    return this._combine(CombinationKey.Or, sqons);
  }

  resolve(id: string): SQON {
    const candidate = this.get(id);
    if ((<SQONMixerEntry>candidate)?._class !== 'SQONMixerEntry') {
      return <SQON>candidate;
    }

    const entry = <SQONMixerEntry>candidate;
    const compiledSqon: Operator = {
      op: entry.sqon.op,
      content: (entry.sqon as ReferenceSQON).content.map((internalSqon) => {
        if (isSQONMixerEntry(internalSqon)) {
          console.log(
            'Resolving internal sqon',
            (<SQONMixerEntry>internalSqon).id,
          );
          return this.resolve((<SQONMixerEntry>internalSqon).id);
        }
        return <SQON>internalSqon;
      }),
    };
    return new SQON(compiledSqon);
  }

  allReferences(id: string): string[] {
    const output = new Set<string>();

    const root = this.get(id);
    if (!root) {
      throw new Error(
        `Provided SQONMixerEntry with id=${id} does not exist in this SQONMixer.`,
      );
    }

    if (!isSQONMixerEntry(root)) {
      return [];
    }

    const refsToCheck: string[] = [];

    (<SQONMixerEntry>root).references.forEach((reference) =>
      refsToCheck.push(reference),
    );

    for (let i = 0; i < refsToCheck.length; i++) {
      const ref = refsToCheck[i];
      output.add(ref);
      const entry = this.get(ref);

      if (!isSQONMixerEntry(entry)) {
        // is SQON, no references here, continue.
        continue;
      }

      (<SQONMixerEntry>entry).references.forEach((entryRef) => {
        output.add(entryRef);
        if (!refsToCheck.includes(entryRef)) {
          refsToCheck.push(entryRef);
        }
      });
    }

    return Array.from(output);
  }

  hasLoops(entries: SQONMixerEntry[]): boolean {
    const references = entries.reduce(
      (acc: { [x: string]: string[] }, entry) => {
        acc[entry.id] = this.allReferences(entry.id);
        return acc;
      },
      {},
    );

    entries.forEach((entry) => {
      const otherEntries = entries.filter((i) => i === entry);
      otherEntries.forEach((other) => {
        if (references[other.id].includes(entry.id)) {
          return true;
        }
      });
    });
    return false;
  }
}

export default SQONMixer;
