#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MOOD_LOG_PATH = path.join(DATA_DIR, 'mood_log.json');
const JOURNAL_PATH = path.join(DATA_DIR, 'journal.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(MOOD_LOG_PATH)) {
    fs.writeFileSync(MOOD_LOG_PATH, JSON.stringify({ entries: [] }, null, 2));
  }

  if (!fs.existsSync(JOURNAL_PATH)) {
    fs.writeFileSync(JOURNAL_PATH, JSON.stringify({ entries: [] }, null, 2));
  }
}

ensureDataFiles();

let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  parseMessages();
});

function parseMessages() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return;
    }

    const header = buffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length: (\d+)/i);
    if (!match) {
      buffer = Buffer.alloc(0);
      return;
    }
    const length = Number(match[1]);
    const totalLength = headerEnd + 4 + length;
    if (buffer.length < totalLength) {
      return;
    }

    const body = buffer.slice(headerEnd + 4, totalLength).toString('utf8');
    buffer = buffer.slice(totalLength);

    try {
      const message = JSON.parse(body);
      handleMessage(message);
    } catch (error) {
      console.error('Failed to parse message', error);
    }
  }
}

function sendMessage(message) {
  const payload = Buffer.from(JSON.stringify(message));
  const header = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(Buffer.concat([header, payload]));
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { entries: [] };
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function handleMessage(message) {
  if (message.method) {
    handleRequest(message);
  } else if (message.id !== undefined) {
    // Unknown message type, respond with error
    sendMessage({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32601,
        message: 'Invalid message type'
      }
    });
  }
}

function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      sendMessage({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'MentalHealthCompanion',
            version: '0.1.0'
          },
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false, read: { streaming: false } }
          }
        }
      });
      break;
    case 'tools/list':
      sendMessage({
        jsonrpc: '2.0',
        id,
        result: {
          tools: getToolsList()
        }
      });
      break;
    case 'tools/call':
      handleToolCall(id, params || {});
      break;
    case 'resources/list':
      sendMessage({
        jsonrpc: '2.0',
        id,
        result: {
          resources: getResourcesList()
        }
      });
      break;
    case 'resources/read':
      handleResourceRead(id, params || {});
      break;
    case 'shutdown':
      sendMessage({ jsonrpc: '2.0', id, result: null });
      break;
    case 'exit':
      process.exit(0);
      break;
    default:
      sendMessage({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown method: ${method}`
        }
      });
  }
}

function getToolsList() {
  return [
    {
      name: 'mood_tracker',
      description: 'Log your current mood with optional reflection notes to build awareness over time.',
      inputSchema: {
        type: 'object',
        required: ['mood'],
        properties: {
          mood: {
            type: 'string',
            description: 'A word or short phrase describing how you feel right now.'
          },
          notes: {
            type: 'string',
            description: 'Optional details about what is influencing your mood.'
          }
        }
      }
    },
    {
      name: 'check_in',
      description: 'Receive gentle, open-ended questions designed to help you explore your current emotional state.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'coping_tools',
      description: 'Get tailored self-care practices based on your current stress level.',
      inputSchema: {
        type: 'object',
        required: ['stress_level'],
        properties: {
          stress_level: {
            type: 'integer',
            minimum: 0,
            maximum: 10,
            description: 'How intense is your stress or overwhelm right now on a 0-10 scale?'
          }
        }
      }
    }
  ];
}

function handleToolCall(id, params) {
  const { name, arguments: args = {} } = params;

  switch (name) {
    case 'mood_tracker':
      handleMoodTracker(id, args);
      break;
    case 'check_in':
      handleCheckIn(id);
      break;
    case 'coping_tools':
      handleCopingTools(id, args);
      break;
    default:
      sendMessage({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown tool: ${name}`
        }
      });
  }
}

function handleMoodTracker(id, args) {
  const mood = (args.mood || '').trim();
  const notes = typeof args.notes === 'string' ? args.notes.trim() : '';

  if (!mood) {
    sendMessage({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: 'The "mood" field is required.'
      }
    });
    return;
  }

  const log = readJson(MOOD_LOG_PATH);
  const entry = {
    timestamp: new Date().toISOString(),
    mood,
    notes
  };
  log.entries.unshift(entry);
  writeJson(MOOD_LOG_PATH, log);

  sendMessage({
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: `Thank you for checking in. I saved that you are feeling "${mood}" today${notes ? ` and noted: ${notes}` : ''}. Your awareness is a powerful step toward caring for yourself.`
        }
      ]
    }
  });
}

function handleCheckIn(id) {
  const prompts = [
    'What emotions are most present for you right now?',
    'What has felt especially heavy or encouraging today?',
    'Is there a small act of care you can offer yourself in this moment?'
  ];

  sendMessage({
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: `Let\'s take a gentle pause together. ${prompts.join(' ')} I\'m here to listen to whatever you choose to share.`
        }
      ]
    }
  });
}

function handleCopingTools(id, args) {
  const level = typeof args.stress_level === 'number' ? args.stress_level : Number(args.stress_level);

  if (Number.isNaN(level)) {
    sendMessage({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: 'Please share your stress level as a number between 0 and 10.'
      }
    });
    return;
  }

  const stressLevel = Math.max(0, Math.min(10, Math.round(level)));

  let suggestion;
  if (stressLevel <= 3) {
    suggestion = 'Try a mindful check-in: breathe slowly, notice three things you can see, two things you can feel, and one thing you can hear. Celebrate a small win from today.';
  } else if (stressLevel <= 6) {
    suggestion = 'Consider a five-minute reset. Step away from screens, stretch your body, and practice five counted breaths in and seven counted breaths out. Jot down one supportive thought you want to carry forward.';
  } else {
    suggestion = 'You deserve immediate care. Pause for box breathing (inhale 4, hold 4, exhale 4, hold 4) and reach out to someone you trust. If you feel unsafe, please contact a crisis line right away; you are not alone.';
  }

  sendMessage({
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: suggestion
        }
      ]
    }
  });
}

function getResourcesList() {
  const moodLog = readJson(MOOD_LOG_PATH);
  const journal = readJson(JOURNAL_PATH);

  return [
    {
      uri: 'mcp://mental-health/mood-log',
      name: 'Mood log',
      description: 'Your saved mood entries with timestamps and optional reflections.',
      mimeType: 'application/json',
      metadata: {
        entries: moodLog.entries.length
      }
    },
    {
      uri: 'mcp://mental-health/journal',
      name: 'Emotional journal',
      description: 'Long-form reflections stored privately for you.',
      mimeType: 'application/json',
      metadata: {
        entries: journal.entries.length
      }
    }
  ];
}

function handleResourceRead(id, params) {
  const { uri } = params || {};

  if (!uri) {
    sendMessage({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: 'A resource URI is required.'
      }
    });
    return;
  }

  let data;
  if (uri === 'mcp://mental-health/mood-log') {
    data = readJson(MOOD_LOG_PATH);
  } else if (uri === 'mcp://mental-health/journal') {
    data = readJson(JOURNAL_PATH);
  } else {
    sendMessage({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Unknown resource: ${uri}`
      }
    });
    return;
  }

  sendMessage({
    jsonrpc: '2.0',
    id,
    result: {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2)
        }
      ]
    }
  });
}

process.stdin.resume();
