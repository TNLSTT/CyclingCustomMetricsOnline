declare module 'fit-file-parser' {
  interface FitParserOptions {
    force?: boolean;
    elapsedRecordField?: boolean;
    speedUnit?: string;
    lengthUnit?: string;
  }

  type FitParserResult = Record<string, unknown>;

  export default class FitParser {
    constructor(options?: FitParserOptions);
    parse(
      data: ArrayBuffer | Uint8Array | Buffer,
      callback: (error: unknown, data: FitParserResult) => void,
    ): void;
  }
}
