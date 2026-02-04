declare module 'user-agents' {
  interface UserAgentOptions {
    deviceCategory?: string;
    [key: string]: unknown;
  }

  export default class UserAgent {
    constructor(options?: UserAgentOptions);
    toString(): string;
    data: Record<string, unknown>;
  }
}

declare module 'sql.js' {
  export interface SqlJsQueryResult {
    columns: string[];
    values: unknown[][];
  }

  export class Database {
    constructor(data?: Uint8Array);
    exec(sql: string, params?: unknown[]): SqlJsQueryResult[];
    run(sql: string, params?: unknown[]): void;
    export(): Uint8Array;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: unknown): Promise<SqlJsStatic>;
}
