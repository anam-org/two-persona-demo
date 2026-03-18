import type { AnamClient } from "@anam-ai/js-sdk";

export type ConversationState =
  | "idle"
  | "starting"
  | "persona-a-speaking"
  | "transitioning-to-b"
  | "persona-b-speaking"
  | "transitioning-to-a"
  | "stopped";

export interface ConversationMessage {
  speaker: "persona-a" | "persona-b";
  content: string;
  timestamp: Date;
}

type StateChangeCallback = (
  state: ConversationState,
  prevState: ConversationState
) => void;
type MessageCallback = (message: ConversationMessage) => void;
type DebugCallback = (type: string, message: string) => void;

export class ConversationManager {
  private clientA: AnamClient | null = null;
  private clientB: AnamClient | null = null;
  private humanName: string = "";

  private state: ConversationState = "idle";
  private messageHistoryA: Array<{ role: string; content: string }> = [];
  private messageHistoryB: Array<{ role: string; content: string }> = [];
  private lastProcessedMsgA: string = "";
  private lastProcessedMsgB: string = "";

  private onStateChange: StateChangeCallback | null = null;
  private onMessage: MessageCallback | null = null;
  private onDebug: DebugCallback | null = null;

  private maxTurns = 100;
  private onMaxTurnsReached: (() => void) | null = null;
  private turnCount = 0;
  private transitionTimeout: ReturnType<typeof setTimeout> | null = null;

  private currentStreamContent = "";

  // Track when a persona has called skip_turn so we can drop the acknowledgement
  private skipTurnPendingA = false;
  private skipTurnPendingB = false;

  // Patterns that indicate a persona is trying to skip/pass its turn
  private static SKIP_PATTERNS = [
    /^\[skip\]$/i,
    /^\[pass\]$/i,
    /^\(skip\)$/i,
    /^\(pass\)$/i,
    /^skip$/i,
    /^pass$/i,
  ];

  // Short acknowledgement phrases that indicate the persona is deferring
  private static ACK_PATTERNS = [
    /^okay[.,!]?\s*(i['']ll wait|i['']ll pass|sure|go ahead|you go|passing)/i,
    /^sure[.,!]?\s*(thing|go ahead|i['']ll wait|i['']ll pass|you go)/i,
    /^(i['']ll wait|i['']ll pass|passing|go ahead|your turn)/i,
    /^alright[.,!]?\s*(i['']ll wait|go ahead|passing|your turn)/i,
  ];

  setCallbacks(callbacks: {
    onStateChange?: StateChangeCallback;
    onMessage?: MessageCallback;
    onDebug?: DebugCallback;
    onMaxTurnsReached?: () => void;
  }) {
    this.onStateChange = callbacks.onStateChange || null;
    this.onMessage = callbacks.onMessage || null;
    this.onDebug = callbacks.onDebug || null;
    this.onMaxTurnsReached = callbacks.onMaxTurnsReached || null;
  }

  setClients(clientA: AnamClient, clientB: AnamClient) {
    this.clientA = clientA;
    this.clientB = clientB;
    this.setupEventListeners();
  }

  setHumanName(name: string) {
    this.humanName = name;
  }

  /** Called from main.ts when a TOOL_CALL_STARTED event fires with tool_name=skip_turn */
  notifySkipTurn(persona: "a" | "b") {
    this.log("skip", `Persona ${persona.toUpperCase()} called skip_turn`);
    if (persona === "a") {
      this.skipTurnPendingA = true;
    } else {
      this.skipTurnPendingB = true;
    }
  }

  /** Check if a message is a skip/pass signal (either explicit marker or short acknowledgement) */
  private isSkipMessage(content: string): boolean {
    const trimmed = content.trim();

    // Check explicit skip markers
    for (const pattern of ConversationManager.SKIP_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }

    // Check short acknowledgement patterns (only for short messages to avoid false positives)
    if (trimmed.length < 80) {
      for (const pattern of ConversationManager.ACK_PATTERNS) {
        if (pattern.test(trimmed)) return true;
      }
    }

    return false;
  }

  private log(type: string, message: string) {
    const now = new Date();
    const ts = now.toTimeString().split(' ')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0');
    console.log(`[${ts}] [ConvoMgr:${type}] ${message}`);
  }

  private setState(newState: ConversationState) {
    const prevState = this.state;
    this.state = newState;
    this.log("state", `${prevState} -> ${newState}`);
    this.onStateChange?.(newState, prevState);
  }

  private setupEventListeners() {
    if (!this.clientA || !this.clientB) return;

    const AnamEvent = {
      MESSAGE_HISTORY_UPDATED: "MESSAGE_HISTORY_UPDATED",
      MESSAGE_STREAM_EVENT_RECEIVED: "MESSAGE_STREAM_EVENT_RECEIVED",
      CONNECTION_ESTABLISHED: "CONNECTION_ESTABLISHED",
      VIDEO_PLAY_STARTED: "VIDEO_PLAY_STARTED",
    };

    // Persona A events
    this.clientA.addListener(
      AnamEvent.MESSAGE_HISTORY_UPDATED as any,
      (messages: Array<{ role: string; content: string }>) => {
        this.log("event", `Persona A history updated: ${messages.length} msgs`);
        this.handleHistoryUpdate("a", messages);
      }
    );

    this.clientA.addListener(
      AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED as any,
      (event: { role: string; content: string }) => {
        if (event.role === "persona") {
          const content = event.content.trim();
          if (content) {
            this.log("stream", `A: "${content}"`);
          } else {
            this.log("stream-end", `A: [end of speech]`);
          }
        }
      }
    );

    // Persona B events
    this.clientB.addListener(
      AnamEvent.MESSAGE_HISTORY_UPDATED as any,
      (messages: Array<{ role: string; content: string }>) => {
        this.log("event", `Persona B history updated: ${messages.length} msgs`);
        this.handleHistoryUpdate("b", messages);
      }
    );

    this.clientB.addListener(
      AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED as any,
      (event: { role: string; content: string }) => {
        if (event.role === "persona") {
          const content = event.content.trim();
          if (content) {
            this.log("stream", `B: "${content}"`);
          } else {
            this.log("stream-end", `B: [end of speech]`);
          }
        }
      }
    );
  }

  private handleHistoryUpdate(
    persona: "a" | "b",
    messages: Array<{ role: string; content: string }>
  ) {
    const personaMessages = messages.filter((m) => m.role === "persona");
    if (personaMessages.length === 0) {
      this.log("history", `${persona.toUpperCase()}: No persona messages in history`);
      return;
    }

    const latestPersonaMsg = personaMessages[personaMessages.length - 1];
    const lastProcessed = persona === "a" ? this.lastProcessedMsgA : this.lastProcessedMsgB;

    if (latestPersonaMsg.content === lastProcessed) {
      this.log("history", `${persona.toUpperCase()}: Already processed this message, skipping`);
      return;
    }

    this.log("history", `${persona.toUpperCase()}: New message detected (${personaMessages.length} total persona msgs)`);

    if (persona === "a") {
      this.lastProcessedMsgA = latestPersonaMsg.content;
      this.messageHistoryA = messages;
    } else {
      this.lastProcessedMsgB = latestPersonaMsg.content;
      this.messageHistoryB = messages;
    }

    this.log(
      "message",
      `Persona ${persona.toUpperCase()} said: "${latestPersonaMsg.content.slice(0, 80)}..."`
    );

    // Check 1: Tool-based skip detection (if TOOL_CALL_STARTED fired)
    const toolSkipped = persona === "a" ? this.skipTurnPendingA : this.skipTurnPendingB;
    // Check 2: Client-side skip detection (marker phrase or short acknowledgement)
    const contentSkipped = this.isSkipMessage(latestPersonaMsg.content);

    if (toolSkipped || contentSkipped) {
      if (persona === "a") this.skipTurnPendingA = false;
      else this.skipTurnPendingB = false;
      const reason = toolSkipped ? "tool_call" : "content_match";
      this.log("skip", `Persona ${persona.toUpperCase()} skipped turn (${reason}), dropping "${latestPersonaMsg.content.slice(0, 60)}". NOT relaying.`);
      // Go back to the other persona speaking so the relay loop picks up from there
      if (persona === "a") {
        this.setState("persona-b-speaking");
      } else {
        this.setState("persona-a-speaking");
      }
      return;
    }

    try {
      this.onMessage?.({
        speaker: persona === "a" ? "persona-a" : "persona-b",
        content: latestPersonaMsg.content,
        timestamp: new Date(),
      });
    } catch (err) {
      this.log("error", `onMessage threw: ${err}`);
    }

    try {
      this.log("debug", `About to call handleTurnComplete for ${persona}`);
      this.handleTurnComplete(persona, latestPersonaMsg.content);
    } catch (err) {
      this.log("error", `handleTurnComplete threw: ${err}`);
    }
  }

  private handleTurnComplete(persona: "a" | "b", message: string) {
    this.log("turn", `handleTurnComplete called: persona=${persona}, state=${this.state}`);

    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }

    if (persona === "a" && this.state === "persona-a-speaking") {
      this.log("turn", "Condition met: A finished speaking, transitioning to B");
      this.turnCount++;
      if (this.turnCount >= this.maxTurns) {
        this.log("limit", `Max turns (${this.maxTurns}) reached, stopping`);
        this.stop();
        this.onMaxTurnsReached?.();
        return;
      }

      this.setState("transitioning-to-b");
      this.sendToPersonaB(message);
    } else if (persona === "b" && this.state === "persona-b-speaking") {
      this.log("turn", "Condition met: B finished speaking, transitioning to A");
      this.turnCount++;
      if (this.turnCount >= this.maxTurns) {
        this.log("limit", `Max turns (${this.maxTurns}) reached, stopping`);
        this.stop();
        this.onMaxTurnsReached?.();
        return;
      }

      this.setState("transitioning-to-a");
      this.sendToPersonaA(message);
    } else {
      this.log("turn", `No condition matched! persona=${persona}, state=${this.state}`);
    }
  }

  private async sendToPersonaB(message: string) {
    this.log("send", `sendToPersonaB called, state=${this.state}, clientB=${!!this.clientB}`);

    if (!this.clientB) {
      this.log("error", "clientB is null!");
      return;
    }
    if (this.state === "stopped") {
      this.log("error", "state is stopped, aborting");
      return;
    }

    this.log("send", `Sending to Persona B: "${message.slice(0, 50)}..."`);

    try {
      if (this.clientA) {
        this.clientA.interruptPersona();
        this.log("interrupt", "Interrupted Persona A");
      }

      this.log("send", "Calling sendUserMessage on clientB...");
      this.clientB.sendUserMessage(message);
      this.log("send", "sendUserMessage called successfully");
      this.setState("persona-b-speaking");
    } catch (err) {
      this.log("error", `Failed to send to B: ${err}`);
    }
  }

  private async sendToPersonaA(message: string) {
    this.log("send", `sendToPersonaA called, state=${this.state}, clientA=${!!this.clientA}`);

    if (!this.clientA) {
      this.log("error", "clientA is null!");
      return;
    }
    if (this.state === "stopped") {
      this.log("error", "state is stopped, aborting");
      return;
    }

    this.log("send", `Sending to Persona A: "${message.slice(0, 50)}..."`);

    try {
      if (this.clientB) {
        this.clientB.interruptPersona();
        this.log("interrupt", "Interrupted Persona B");
      }

      this.log("send", "Calling sendUserMessage on clientA...");
      this.clientA.sendUserMessage(message);
      this.log("send", "sendUserMessage called successfully");
      this.setState("persona-a-speaking");
    } catch (err) {
      this.log("error", `Failed to send to A: ${err}`);
    }
  }

  start() {
    if (this.state !== "idle") {
      this.log("warn", "Cannot start, not in idle state");
      return;
    }

    this.turnCount = 0;
    this.messageHistoryA = [];
    this.messageHistoryB = [];
    this.setState("starting");

    // Persona A has greeting enabled, so it will start speaking automatically
    this.setState("persona-a-speaking");
    this.log("info", "Started - Persona A greeting will begin");
  }

  stop() {
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }
    this.setState("stopped");
    this.log("info", "Conversation stopped");
  }

  reset() {
    this.stop();
    this.turnCount = 0;
    this.messageHistoryA = [];
    this.messageHistoryB = [];
    this.lastProcessedMsgA = "";
    this.lastProcessedMsgB = "";
    this.skipTurnPendingA = false;
    this.skipTurnPendingB = false;
    this.setState("idle");
  }

  getState() {
    return this.state;
  }

  getTurnCount() {
    return this.turnCount;
  }
}
