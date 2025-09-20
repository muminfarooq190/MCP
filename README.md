# Mental Health MCP Server

This project implements a Model Context Protocol (MCP) server focused on compassionate mental health support. The server is designed to offer empathetic conversational prompts, personalized coping strategies, and structured mood tracking so that users can quickly access grounding tools when they need them most.

## Features

- **Three dedicated MCP tools** to assist with self-care in the moment:
  - `mood_tracker` – capture how you feel with optional notes for context.
  - `check_in` – receive gentle reflective prompts to better understand your emotional state.
  - `coping_tools` – get tailored grounding or mindfulness suggestions based on current stress.
- **Persistent resource storage** for mood logs and journal reflections saved as JSON resources under the `mcp://mental-health/*` namespace.
- **Empathetic language** throughout tool responses to foster a supportive, non-judgmental environment.

## Project Structure

```
.
├── data/
│   ├── journal.json        # Stored emotional journal entries (auto-created)
│   └── mood_log.json       # Stored mood tracker entries (auto-created)
├── src/
│   └── server.js           # MCP server implementation
├── package.json
└── README.md
```

## Getting Started

1. **Ensure Node.js 18+ is installed.**
2. **Run the server** from the project root:

   ```bash
   npm start
   ```

   The server communicates over STDIN/STDOUT using JSON-RPC with MCP-compatible clients.

## Tool Overview

### `mood_tracker`
Logs the user’s current mood with optional notes. Entries are timestamped and stored in `data/mood_log.json`, which is exposed as the resource `mcp://mental-health/mood-log`.

### `check_in`
Returns three open-ended questions designed to help the user gently explore their current emotional landscape.

### `coping_tools`
Accepts a `stress_level` from 0–10 and returns a tailored coping suggestion, ranging from mindful grounding to immediate crisis-oriented guidance.

## Resources

The server provides two MCP resources for clients that support resource browsing:

- `mcp://mental-health/mood-log`
- `mcp://mental-health/journal`

Each resource is delivered as formatted JSON for easy review or downstream visualization.

## Data Privacy

All logs are stored locally on disk and never transmitted elsewhere. Users maintain full control of their entries by managing the files in the `data/` directory.

## License

MIT
