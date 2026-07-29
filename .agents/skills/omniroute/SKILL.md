---
name: omniroute
description: Open-source AI gateway and router for multi-provider API management, automatic rate-limit failovers, prompt compression, and model routing across Gemini, OpenAI, Claude, and 290+ providers.
---

# OmniRoute Skill

Use this skill when the user requests multi-provider AI model routing, setting up an AI gateway/proxy, managing API key fallbacks across Gemini/OpenAI/Anthropic, or compressing prompts to reduce token usage.

## Local Repository Location
- Repository Path: `c:\Users\skese\Downloads\antigravity\OmniRoute`
- Official Repo: `https://github.com/diegosouzapw/OmniRoute`

## Core Capabilities
- **Unified Gateway**: Aggregates 290+ AI providers and 500+ models under an OpenAI-compatible endpoint (`http://localhost:20128/v1`).
- **Smart Failover & Routing**: Automatically switches to fallback accounts/providers if rate limits or 429/5xx errors occur.
- **Format Translation**: Translates request & response payloads between Gemini, Claude, OpenAI, and Ollama formats.
- **Prompt Compression**: Built-in multi-mode token compression pipeline (saving 15-95% token overhead).
- **Control Plane**: Supports MCP (Model Context Protocol) and Agent-to-Agent (A2A) communications.

## How to Run / Use
1. Navigate to the repository directory: `c:\Users\skese\Downloads\antigravity\OmniRoute`
2. Install dependencies & start server according to project documentation.
3. Configure provider credentials / API keys in OmniRoute configuration file.
