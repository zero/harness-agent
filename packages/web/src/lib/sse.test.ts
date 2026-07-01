import { describe, expect, it } from "vitest";

import { parseSseEvents } from "./sse";

describe("parseSseEvents", () => {
  it("parses event-stream data lines into JSON events", () => {
    expect(
      parseSseEvents(
        [
          'data: {"type":"session.started","sessionId":"session-1"}',
          "",
          'data: {"type":"message.delta","messageId":"message-1","text":"hello"}',
          ""
        ].join("\n")
      )
    ).toEqual([
      { type: "session.started", sessionId: "session-1" },
      { type: "message.delta", messageId: "message-1", text: "hello" }
    ]);
  });
});
