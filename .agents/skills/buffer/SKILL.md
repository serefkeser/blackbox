---
name: buffer
description: Connects to Buffer GraphQL API to automatically post, schedule, and manage content across connected social media accounts (Twitter/X, Instagram, LinkedIn, Facebook, Pinterest).
---

# Buffer Automatic Social Media Publishing Skill

This skill allows the agent to automatically publish content to social media accounts managed via Buffer.

## Accounts & Channels Config
- **User Email**: `seref.keser@gmail.com`
- **Access Token**: `TzKTJgJ-5MqnfzY8Ugx-1xmbZfb9CQ24rSFCCeyrf9G`
- **GraphQL Endpoint**: `https://api.buffer.com/graphql`
- **Connected Channels**:
  - **Twitter / X**: `serefkeser` (`ID: 6a50b10040483446288e397b`)
  - **Instagram**: `keser4881` (`ID: 69f5d9145c4c051afa01c2f7`)
  - **LinkedIn**: `serefkeser1967` (`ID: 6a3fa3b05ab6d2f1067a03e6`)

## Capabilities
1. **List Channels**: Retrieve all social channels connected to Buffer.
2. **Post to Twitter/X**: Send automated tweets to `@serefkeser`.
3. **Post to Instagram**: Send updates to `@keser4881`.
4. **Post to LinkedIn**: Publish articles or updates to `@serefkeser1967`.
5. **Multi-Channel Broadcast**: Send a post simultaneously to all connected channels (`shareNow` or `addToQueue`).

## Example Node Execution Script
To post via Buffer GraphQL API from a script or subagent:

```javascript
import { BufferService } from './buffer_service.js';

// Post to all channels instantly
const result = await BufferService.postToAllChannels(
  "OTONOM AI ile otomatik oluşturulan haber özeti 🚀 #AI #Otonom"
);
console.log(result);
```
