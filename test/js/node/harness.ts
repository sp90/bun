/**
 * @note this file patches `node:test` via the require cache.
 */
import { AnyFunction } from "bun";
import os from "node:os";
import { hideFromStackTrace } from "harness";
import assertNode from "node:assert";

type DoneCb = (err?: Error) => any;
function noop() {}
export function createTest(path: string) {
  const { expect, test, it, describe, beforeAll, afterAll, beforeEach, afterEach, mock } = Bun.jest(path);

  hideFromStackTrace(expect);

  // Assert
  const strictEqual = (...args: Parameters<typeof assertNode.strictEqual>) => {
    assertNode.strictEqual(...args);
    expect(true).toBe(true);
  };

  const notStrictEqual = (...args: Parameters<typeof assertNode.notStrictEqual>) => {
    assertNode.notStrictEqual(...args);
    expect(true).toBe(true);
  };

  const deepStrictEqual = (...args: Parameters<typeof assertNode.deepStrictEqual>) => {
    assertNode.deepStrictEqual(...args);
    expect(true).toBe(true);
  };

  const throws = (...args: Parameters<typeof assertNode.throws>) => {
    assertNode.throws(...args);
    expect(true).toBe(true);
  };

  const ok = (...args: Parameters<typeof assertNode.ok>) => {
    assertNode.ok(...args);
    expect(true).toBe(true);
  };

  const ifError = (...args: Parameters<typeof assertNode.ifError>) => {
    assertNode.ifError(...args);
    expect(true).toBe(true);
  };

  const match = (...args: Parameters<typeof assertNode.match>) => {
    assertNode.match(...args);
    expect(true).toBe(true);
  };

  interface NodeAssert {
    (args: any): void;
    strictEqual: typeof strictEqual;
    deepStrictEqual: typeof deepStrictEqual;
    notStrictEqual: typeof notStrictEqual;
    throws: typeof throws;
    ok: typeof ok;
    ifError: typeof ifError;
    match: typeof match;
  }
  const assert = function (...args: any[]) {
    // @ts-ignore
    assertNode(...args);
  } as NodeAssert;

  hideFromStackTrace(strictEqual);
  hideFromStackTrace(notStrictEqual);
  hideFromStackTrace(deepStrictEqual);
  hideFromStackTrace(throws);
  hideFromStackTrace(ok);
  hideFromStackTrace(ifError);
  hideFromStackTrace(match);
  hideFromStackTrace(assert);

  Object.assign(assert, {
    strictEqual,
    deepStrictEqual,
    notStrictEqual,
    throws,
    ok,
    ifError,
    match,
  });

  // End assert

  const createCallCheckCtx = (done: DoneCb) => {
    var timers: Timer[] = [];
    const createDone = createDoneDotAll(done, undefined, timers);

    // const mustCallChecks = [];

    // failed.forEach(function (context) {
    //   console.log(
    //     "Mismatched %s function calls. Expected %s, actual %d.",
    //     context.name,
    //     context.messageSegment,
    //     context.actual
    //   );
    //   console.log(context.stack.split("\n").slice(2).join("\n"));
    // });

    // TODO: Implement this to be exact only
    function mustCall(fn?: (...args: any[]) => any, exact?: number) {
      return mustCallAtLeast(fn!, exact!);
    }

    function closeTimers() {
      timers.forEach(t => clearTimeout(t));
    }

    function mustNotCall(reason: string = "function should not have been called", optionalCb?: (err?: any) => void) {
      const localDone = createDone();
      timers.push(setTimeout(() => localDone(), 200));

      return () => {
        closeTimers();
        if (optionalCb) optionalCb.apply(undefined, reason ? [reason] : []);

        done(new Error(reason));
      };
    }

    function mustSucceed(fn: () => any, exact?: number) {
      return mustCall(function (err, ...args) {
        ifError(err);
        // @ts-ignore
        if (typeof fn === "function") return fn(...(args as []));
      }, exact);
    }

    function mustCallAtLeast(fn: AnyFunction, minimum: number) {
      return _mustCallInner(fn, minimum, "minimum");
    }

    function _mustCallInner(fn: AnyFunction, criteria = 1, field: string) {
      // @ts-ignore
      if (process._exiting) throw new Error("Cannot use common.mustCall*() in process exit handler");
      if (typeof fn === "number") {
        criteria = fn;
        fn = noop;
      } else if (fn === undefined) {
        fn = noop;
      }

      if (typeof criteria !== "number") throw new TypeError(`Invalid ${field} value: ${criteria}`);

      let actual = 0;
      let expected = criteria;

      // mustCallChecks.push(context);
      const done = createDone();
      const _return = (...args: any[]) => {
        try {
          // @ts-ignore
          const result = fn(...args);
          actual++;
          if (actual >= expected) {
            closeTimers();
            done();
          }

          return result;
        } catch (err) {
          if (err instanceof Error) done(err);
          else if (err?.toString) done(new Error(err?.toString()));
          else {
            console.error("Unknown error", err);
            done(new Error("Unknown error"));
          }
          closeTimers();
        }
      };
      // Function instances have own properties that may be relevant.
      // Let's replicate those properties to the returned function.
      // Refs: https://tc39.es/ecma262/#sec-function-instances
      Object.defineProperties(_return, {
        name: {
          value: fn.name,
          writable: false,
          enumerable: false,
          configurable: true,
        },
        length: {
          value: fn.length,
          writable: false,
          enumerable: false,
          configurable: true,
        },
      });
      return _return;
    }
    return {
      mustSucceed,
      mustCall,
      mustCallAtLeast,
      mustNotCall,
      closeTimers,
    };
  };

  function createDoneDotAll(done: DoneCb, globalTimeout?: number, timers: Timer[] = []) {
    let toComplete = 0;
    let completed = 0;
    const globalTimer = globalTimeout
      ? (timers.push(
          setTimeout(() => {
            console.log("Global Timeout");
            done(new Error("Timed out!"));
          }, globalTimeout),
        ),
        timers[timers.length - 1])
      : undefined;
    function createDoneCb(timeout?: number) {
      toComplete += 1;
      const timer =
        timeout !== undefined
          ? (timers.push(
              setTimeout(() => {
                console.log("Timeout");
                done(new Error("Timed out!"));
              }, timeout),
            ),
            timers[timers.length - 1])
          : timeout;
      return (result?: Error) => {
        if (timer) clearTimeout(timer);
        if (globalTimer) clearTimeout(globalTimer);
        if (result instanceof Error) {
          done(result);
          return;
        }
        completed += 1;
        if (completed === toComplete) {
          done();
        }
      };
    }
    return createDoneCb;
  }

  return {
    expect,
    test,
    it,
    describe,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    createDoneDotAll,
    strictEqual,
    notStrictEqual,
    deepStrictEqual,
    throws,
    ok,
    ifError,
    createCallCheckCtx,
    match,
    assert,
    mock,
  };
}

declare namespace Bun {
  function jest(path: string): typeof import("bun:test");
}

const normalized = os.platform() === "win32" ? Bun.main.replaceAll("\\", "/") : Bun.main;
if (normalized.includes("node/test/parallel")) {
  function createMockNodeTestModule() {
    interface TestError extends Error {
      testStack: string[];
    }
    type Context = {
      filename: string;
      testStack: string[];
      failures: Error[];
      successes: number;
      addFailure(err: unknown): TestError;
      recordSuccess(): void;
    };
    const contexts: Record</* requiring file */ string, Context> = {};

    // @ts-ignore
    let activeSuite: Context = undefined;

    function createContext(key: string): Context {
      return {
        filename: key, // duplicate for ease-of-use
        // entered each time describe, it, etc is called
        testStack: [],
        failures: [],
        successes: 0,
        addFailure(err: unknown) {
          const error: TestError = (err instanceof Error ? err : new Error(err as any)) as any;
          error.testStack = this.testStack;
          const testMessage = `Test failed: ${this.testStack.join(" > ")}`;
          error.message = testMessage + "\n" + error.message;
          this.failures.push(error);
          console.error(error);
          return error;
        },
        recordSuccess() {
          const fullname = this.testStack.join(" > ");
          console.log("✅ Test passed:", fullname);
          this.successes++;
        },
      };
    }

    function getContext() {
      const key: string = Bun.main; // module.parent?.filename ?? require.main?.filename ?? __filename;
      return (activeSuite = contexts[key] ??= createContext(key));
    }

    async function test(
      label: string | Function,
      optionsOrFn: Record<string, any> | Function,
      fn?: Function | undefined,
    ) {
      let options = optionsOrFn;
      if (arguments.length === 2) {
        assertNode.equal(typeof optionsOrFn, "function", "Second argument to test() must be a function.");
        fn = optionsOrFn as Function;
        options = {};
      }
      if (typeof fn !== "function" && typeof label === "function") {
        fn = label;
        label = fn.name;
        options = {};
      }

      const ctx = getContext();
      const { skip } = options;

      if (skip) return;
      try {
        ctx.testStack.push(label as string);
        await fn();
        ctx.recordSuccess();
      } catch (err) {
        const error = ctx.addFailure(err);
        throw error;
      } finally {
        ctx.testStack.pop();
      }
    }

    function describe(labelOrFn: string | Function, maybeFnOrOptions?: Function, maybeFn?: Function) {
      const [label, fn] =
        typeof labelOrFn == "function" ? [labelOrFn.name, labelOrFn] : [labelOrFn, maybeFn ?? maybeFnOrOptions];
      if (typeof fn !== "function") throw new TypeError("Second argument to describe() must be a function.");

      getContext().testStack.push(label);
      try {
        fn();
      } catch (e) {
        getContext().addFailure(e);
        throw e;
      } finally {
        getContext().testStack.pop();
      }

      const failures = getContext().failures.length;
      const successes = getContext().successes;
      console.error(`describe("${label}") finished with ${successes} passed and ${failures} failed tests.`);
      if (failures > 0) {
        throw new Error(`${failures} tests failed.`);
      }
    }

    return {
      test,
      it: test,
      describe,
      suite: describe,
    };
  }

  require.cache["node:test"] ??= {
    exports: createMockNodeTestModule(),
    loaded: true,
    isPreloading: false,
    id: "node:test",
    parent: require.main,
    filename: "node:test",
    children: [],
    path: "node:test",
    paths: [],
    require,
  };
}
