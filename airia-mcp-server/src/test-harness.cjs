const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
const child = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => { stdout += data.toString(); });
child.stderr.on('data', (data) => { stderr += data.toString(); });

// Step 1: Send initialize
const initMsg = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-harness", version: "1.0.0" }
  }
}) + '\n';

child.stdin.write(initMsg);

// Step 2: After short delay, send initialized notification then tools/list
setTimeout(() => {
  const initializedNotif = JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized"
  }) + '\n';
  child.stdin.write(initializedNotif);

  const listToolsMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }) + '\n';
  child.stdin.write(listToolsMsg);
}, 500);

// Step 3: After another delay, call get_device_location
setTimeout(() => {
  const callToolMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get_device_location",
      arguments: { imei: "TEST-IMEI-12345" }
    }
  }) + '\n';
  child.stdin.write(callToolMsg);
}, 1000);

// Step 4: Call get_device_alarms
setTimeout(() => {
  const callAlarmsMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "get_device_alarms",
      arguments: { imei: "TEST-IMEI-12345" }
    }
  }) + '\n';
  child.stdin.write(callAlarmsMsg);
}, 1500);

// Step 5: Call send_device_command
setTimeout(() => {
  const callCmdMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "send_device_command",
      arguments: { imei: "TEST-IMEI-12345", commandType: "RelayCutoff" }
    }
  }) + '\n';
  child.stdin.write(callCmdMsg);
}, 2000);

// Collect results and print
setTimeout(() => {
  child.stdin.end();
  child.kill();

  console.log("=== MCP SERVER TEST RESULTS ===");
  console.log("");

  // Parse individual JSON-RPC responses from stdout
  const responses = stdout.trim().split('\n').filter(line => line.trim());
  
  responses.forEach((line, i) => {
    try {
      const parsed = JSON.parse(line);
      console.log("--- Response " + (i + 1) + " (id: " + parsed.id + ") ---");
      
      if (parsed.id === 1) {
        console.log("TEST: Server Initialization");
        const name = parsed.result && parsed.result.serverInfo && parsed.result.serverInfo.name;
        const version = parsed.result && parsed.result.serverInfo && parsed.result.serverInfo.version;
        console.log("  Server Name:", name);
        console.log("  Server Version:", version);
        console.log("  RESULT: " + (parsed.result ? "PASS" : "FAIL"));
      } else if (parsed.id === 2) {
        console.log("TEST: Tools Listing");
        const tools = (parsed.result && parsed.result.tools) || [];
        console.log("  Tools Found:", tools.length);
        tools.forEach(function(t) { console.log("    - " + t.name + ": " + (t.description || '').substring(0, 60)); });
        console.log("  RESULT: " + (tools.length === 4 ? "PASS (4 tools registered)" : "FAIL (expected 4 tools, got " + tools.length + ")"));
      } else if (parsed.id === 3) {
        console.log("TEST: get_device_location('TEST-IMEI-12345')");
        const content = parsed.result && parsed.result.content && parsed.result.content[0] && parsed.result.content[0].text;
        if (content) {
          const data = JSON.parse(content);
          console.log("  Response:", JSON.stringify(data.data, null, 2));
          console.log("  RESULT: " + (data.success && data.data && data.data.lat ? "PASS" : "FAIL"));
        }
      } else if (parsed.id === 4) {
        console.log("TEST: get_device_alarms('TEST-IMEI-12345')");
        const content = parsed.result && parsed.result.content && parsed.result.content[0] && parsed.result.content[0].text;
        if (content) {
          const data = JSON.parse(content);
          console.log("  Response:", JSON.stringify(data.data, null, 2));
          console.log("  RESULT: " + (data.success && Array.isArray(data.data) ? "PASS" : "FAIL"));
        }
      } else if (parsed.id === 5) {
        console.log("TEST: send_device_command('TEST-IMEI-12345', 'RelayCutoff')");
        const content = parsed.result && parsed.result.content && parsed.result.content[0] && parsed.result.content[0].text;
        if (content) {
          const data = JSON.parse(content);
          console.log("  Response:", JSON.stringify(data.data, null, 2));
          console.log("  RESULT: " + (data.success && data.data && data.data.success ? "PASS" : "FAIL"));
        }
      }
      console.log("");
    } catch (e) {
      console.log("  Raw line:", line);
    }
  });

  // Summary
  console.log("=== STDERR (Server Logs) ===");
  const logLines = stderr.trim().split('\n').filter(function(l) { return l.trim(); });
  logLines.forEach(function(l) {
    try {
      const log = JSON.parse(l);
      console.log("  [" + log.level + "] " + log.message + (log.imei ? " (imei: " + log.imei + ")" : ""));
    } catch(ex) {
      console.log("  ", l);
    }
  });

  console.log("");
  console.log("=== FINAL SUMMARY ===");
  console.log("Total JSON-RPC responses:", responses.length);
  console.log("Total log entries:", logLines.length);
}, 3000);
