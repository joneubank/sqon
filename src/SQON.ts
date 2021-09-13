enum ArrayFilterKey {
  In = 'in',
}
enum ScalarFilterKey {
  GreaterThan = 'gt',
  LesserThan = 'lt',
}

export enum CombinationKey {
  And = 'and',
  Or = 'or',
  Not = 'not',
}

interface ArrayFilterValue {
  field: string;
  value: Array<string | number>;
}

interface ScalarFilterValue {
  field: string;
  value: number;
}

interface ArrayFilter {
  op: ArrayFilterKey;
  content: ArrayFilterValue;
}

interface ScalarFilter {
  op: ScalarFilterKey;
  content: ScalarFilterValue;
}

interface Filter {
  op: ArrayFilterKey | ScalarFilterKey;
  content: {
    field: string;
    value: Array<string | number> | number;
  };
}

export interface Combination {
  op: CombinationKey;
  content: Operator[];
}

export type Operator = Filter | Combination;

export function combine(op: CombinationKey, content: Operator[]): Combination {
  return {
    op,
    content,
  };
}

// type ArrayFilterFunction = (op: ArrayFilterKey, field: string, value: Array<string | number>) => ArrayFilter;
// type ScalarFilterFunction = (op: ScalarFilterKey, field: string, value: number) => ScalarFilter;
export function filter(
  op: ArrayFilterKey | ScalarFilterKey,
  field: string,
  value: Array<string | number> | number,
): Filter {
  // TODO: typechecking for array or scalar, then casting to silence TS linter
  return {
    op,
    content: {
      field,
      value,
    },
  };
}

const combinationKeyValues: string[] = Object.values(CombinationKey);
function isCombination(operator: Operator) {
  return combinationKeyValues.includes(operator.op);
}

/**
 * Parse a string representation of a sqon into a SQON object.
 * If the provided string is a Filter, the output will be wrapped with an And Combination Operator
 * @param sqon {string}
 * @returns {SQON}
 */
function parseSQON(sqon: string): Combination {
  const parsed = JSON.parse(sqon);

  // TODO: Error checking and validation, and probably move parsing to its own file.
  if (isCombination(parsed)) {
    return parsed;
  } else {
    return { op: CombinationKey.And, content: parsed };
  }
}

class SQON implements Combination {
  op: CombinationKey;
  content: Operator[];

  constructor(sqon: SQON | Operator | string) {
    if (typeof sqon === 'string') {
      const parsed = parseSQON(sqon);
      this.op = parsed.op;
      this.content = parsed.content;
    } else if (sqon instanceof SQON) {
      this.op = sqon.op;
      this.content = [...sqon.content];
    } else {
      // sqon is an Operator
      if (isCombination(sqon)) {
        this.op = (<Combination>sqon).op;
        this.content = (<Combination>sqon).content;
      } else {
        // sqon is a Filter, so needs to be wrapped in an AND Combination
        this.op = CombinationKey.And;
        this.content = [sqon];
      }
    }
    // TODO: Flatten combinations
  }

  // ===== Combinations
  public and(content: SQON | SQON[]): SQON {
    const output = new SQON(this);
    if (output.op !== CombinationKey.And) {
      // IMPORTANT: Call this.toOperator BEFORE updating this.op
      output.content = [output.toOperator()];
      output.op = CombinationKey.And;
    }
    // Add requested content to output.content
    // But first, check if each of the operators in the content are an AND operator so we can flatter the content
    const contentAsArray: SQON[] = [].concat(content);
    contentAsArray.forEach((sqonToAdd) => {
      if (sqonToAdd.op === CombinationKey.And) {
        output.content = output.content.concat(sqonToAdd.content);
      } else {
        output.content.push(sqonToAdd.toOperator());
      }
    });

    return output;
  }
  public or(content: SQON | SQON[]): SQON {
    const output = new SQON(this);
    if (output.op !== CombinationKey.Or) {
      // IMPORTANT: Call this.toOperator BEFORE updating this.op
      output.content = [output.toOperator()];
      output.op = CombinationKey.Or;
    }
    // Add requested content to output.content
    // But first, check if each of the operators in the content are an Or operator so we can flatter the content
    const contentAsArray: SQON[] = [].concat(content);
    contentAsArray.forEach((sqonToAdd) => {
      if (sqonToAdd.op === CombinationKey.Or) {
        output.content = output.content.concat(sqonToAdd.content);
      } else {
        output.content.push(sqonToAdd.toOperator());
      }
    });

    return output;
  }
  public not(content: SQON | SQON[]): SQON {
    const output = new SQON(this);
    const operation = combine(CombinationKey.Not, [].concat(content));
    return output.and(new SQON(operation));
  }

  // ===== Filters
  public in(field: string, value: Array<string | number>): SQON {
    const output = new SQON(this);
    output.addFilter(filter(ArrayFilterKey.In, field, value));
    return output;
  }
  public gt(field: string, value: number): SQON {
    const output = new SQON(this);
    output.addFilter(filter(ScalarFilterKey.GreaterThan, field, value));
    return output;
  }
  public lt(field: string, value: number): SQON {
    const output = new SQON(this);
    output.addFilter(filter(ScalarFilterKey.LesserThan, field, value));
    return output;
  }

  // ===== Static SQON Creators

  /**
   * Create a SQON from a JSON or String representation
   * @param sqon {Operator | string}
   * @returns {SQON}
   */
  public static from(sqon: Operator | string): SQON {
    const content: Operator =
      typeof sqon === 'string' ? JSON.parse(sqon) : sqon;
    return new SQON(content);
  }

  // Combinators
  public static and(content: SQON | SQON[]): SQON {
    return new SQON(combine(CombinationKey.And, [].concat(content)));
  }
  public static or(content: SQON | SQON[]): SQON {
    return new SQON(combine(CombinationKey.Or, [].concat(content)));
  }
  public static not(content: SQON | SQON[]): SQON {
    return new SQON(combine(CombinationKey.Not, [].concat(content)));
  }

  // Filters
  public static in(field: string, value: Array<string | number>): SQON {
    return new SQON(filter(ArrayFilterKey.In, field, value));
  }
  public static gt(field: string, value: number): SQON {
    return new SQON(filter(ScalarFilterKey.GreaterThan, field, value));
  }
  public static lt(field: string, value: number): SQON {
    return new SQON(filter(ScalarFilterKey.LesserThan, field, value));
  }

  // ===== Output
  toString(): string {
    return JSON.stringify(this);
  }

  // ===== Internal tools
  private toOperator(): Combination {
    return {
      op: this.op,
      content: [...this.content],
    };
  }

  private addFilter(filter: Filter): void {
    if (this.op === CombinationKey.And) {
      this.content = this.content.concat(filter);
    } else {
      this.content = [this.toOperator(), filter];
      this.op = CombinationKey.And;
    }
  }
}

export default SQON;
