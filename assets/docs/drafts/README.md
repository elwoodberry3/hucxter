# Drafts

```bash  

HUCXSTER/
├── CLAUDE.md                           # Project Memory & Operating System
├── .mcp.json                           # Model Context Protocol Server Connectors
└── .claude/
    └── skills/                         # Modular Subagent Workflows
        ├── hucxster-geo-radius/
        │   └── SKILL.md                # Haversine / PostGIS Geo-fencing logic
        ├── hucxster-valuation-agent/
        │   └── SKILL.md                # Multimodal visual comps & pricing engine
        ├── hucxster-bot-security/
        │   └── SKILL.md                # Zero-bot auth & signal verification
        └── hucxster-video-pipeline/
            └── SKILL.md                # Short-form video upload, transcoding & CDN

```  

1. Initialize the .claude/skills/ directory structure to store the domain workflows for spatial querying, AI valuation, and zero-bot security.
2. Connect .mcp.json to allow Claude Code to validate schema migrations and run spatial tests locally in real time.