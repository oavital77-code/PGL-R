import { describe, expect, it, vi } from "vitest";
import { makeReleaser, type Scheduler } from "@/lib/db/release";

describe("makeReleaser", () => {
  it("arranges one release per response however many statements run", async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const schedule: Scheduler = (cb) => void callbacks.push(cb);
    const release = vi.fn(async () => undefined);
    const onStatement = makeReleaser(schedule, release);

    onStatement();
    onStatement();
    onStatement();
    expect(callbacks).toHaveLength(1);
    expect(release).not.toHaveBeenCalled();

    await callbacks[0]!();
    expect(release).toHaveBeenCalledTimes(1);

    // the next request arranges its own release again
    onStatement();
    expect(callbacks).toHaveLength(2);
  });

  it("lets a statement that runs during a release arrange the next one", async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const schedule: Scheduler = (cb) => void callbacks.push(cb);
    let onStatement: () => void = () => undefined;
    const release = vi.fn(async () => {
      onStatement();
    });
    onStatement = makeReleaser(schedule, release);

    onStatement();
    await callbacks[0]!();
    expect(callbacks).toHaveLength(2);
  });

  it("does nothing outside a request scope", () => {
    const schedule: Scheduler = () => {
      throw new Error("`after` was called outside a request scope");
    };
    const release = vi.fn(async () => undefined);
    const onStatement = makeReleaser(schedule, release);
    expect(() => onStatement()).not.toThrow();
    expect(release).not.toHaveBeenCalled();
  });
});
