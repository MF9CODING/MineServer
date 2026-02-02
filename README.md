<div align="center">

![Mineserver Logo](https://raw.githubusercontent.com/MF9CODING/Mineserver/main/src-tauri/icons/icon.png)

# MineServer
### Protocol 1: Protect the Pilot. Protocol 2: Run the Server.
**The modern, lightning-fast Minecraft Server Manager you've been waiting for.**

[![Version](https://img.shields.io/badge/Version-1.0.0-green?style=for-the-badge)](https://github.com/MF9CODING/Mineserver/releases)
[![Downloads](https://img.shields.io/github/downloads/MF9CODING/Mineserver/total?style=for-the-badge&color=orange)](https://github.com/MF9CODING/Mineserver/releases)
[![Built With Rust](https://img.shields.io/badge/Backend-Rust-orange?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![Powered By Tauri](https://img.shields.io/badge/Native-Tauri_v2-blue?style=for-the-badge&logo=tauri)](https://tauri.app/)

[**Download Latest**](https://github.com/MF9CODING/Mineserver/releases/latest) • [**Changelog**](#-whats-new-in-v100) • [**Report Bug**](https://github.com/MF9CODING/Mineserver/issues)

---
</div>

## 🆕 What's New in v1.0.0

> **Major Release - February 2026** 🎉

| Feature | Description |
|---------|-------------|
| ⚡ **NeoForge Support** | Full support for NeoForge modded servers (modern Forge fork for 1.20.1+) |
| 🔧 **Auto Installer** | NeoForge/Forge installers run automatically - no manual setup required! |
| 📦 **Mods Tab** | Browse & install mods from Modrinth with smart loader detection |
| 🚀 **Smart Scripts** | Auto-detects `run.bat`/`run.sh` for modded server startup |

<details>
<summary><b>📋 Full Changelog</b></summary>

### ✨ New Features
- **NeoForge Support**: One-click installation with automatic installer execution
- **Mods Tab**: Integrated with Modrinth using `neoforge` loader filter
- **Auto Setup**: Creates `mods` folder and EULA automatically
- **Run Script Detection**: Uses `run.bat`/`run.sh` for NeoForge/Forge servers
- **JVM_ARGS**: Custom Java flags via environment variable

### 🐛 Bug Fixes
- Fixed scheduler thread lifetime issues
- Fixed server event emitter type mismatches
- Resolved unused import warnings

### 🔧 Improvements
- ModManager detects NeoForge loader for Modrinth
- Mods tab visible for NeoForge servers
- Updated ServerType definitions

</details>

---

## 👋 Introduction

Welcome to **MineServer**. We believe running a Minecraft server shouldn't require a degree in networking or hours of config file editing. Whether you're a parent setting up a world for your kids, a streamer playing with viewers, or a power user managing a modded SMP, MineServer is built for **you**.

Powered by **Rust** 🦀 and **Tauri** 🚀, it's incredibly lightweight (using less RAM than a web browser tab) while giving you professional-grade tools wrapped in a beautiful, modern interface.

---

## 🌟 Why MineServer?

| Feature | Description |
|---------|-------------|
| 🚀 **Performance First** | Native app that opens instantly and uses minimal RAM |
| 🛡️ **Security Center** | Tunnel Guard + Panic Mode to protect your network |
| 🎥 **Streamer Mode** | Auto-mask IPs and sensitive info on stream |
| 🧩 **Plugin Store** | Install from Modrinth, Hangar, SpigotMC, Polymart |
| 🌍 **Easy Networking** | Built-in Playit.gg tunneling - no port forwarding needed |

---

## 💻 Supported Server Software

| Platform | Type | Best For | Status |
|----------|------|----------|--------|
| **Paper** | Java | 🚀 High Performance & Plugins | ✅ Supported |
| **Purpur** | Java | ⚙️ Extreme Customization | ✅ Supported |
| **Vanilla** | Java | 🍦 Pure Experience | ✅ Supported |
| **Fabric** | Java | 🛠️ Lightweight Mods | ✅ Supported |
| **Forge** | Java | 🏗️ Heavy Modpacks | ✅ Supported |
| **NeoForge** | Java | ⚡ Modern Forge (1.20.1+) | ✅ **NEW!** |
| **Bedrock** | Bedrock | 📱 Cross-play with Consoles | ✅ Supported |
| **NukkitX** | Bedrock | 🔌 Bedrock with Plugins | ✅ Supported |

---

## 🔥 Key Features

### 🖥️ Server Management
- **Smart Creation Wizard** - Auto-detects hardware for optimal settings
- **Version Manager** - One-click install for any Minecraft version
- **Live Console** - Color-coded logs with command history

### 🧩 Plugin & Mod Powerhouse
- **Integrated Store** - Browse Modrinth, Hangar, SpigotMC, Polymart
- **Safe Installs** - Auto-places files in correct folders
- **NeoForge/Forge** - Full mod support with auto-installer

### 🗺️ World Management
- **Visual Cards** - See worlds beautifully, not as folder names
- **Regenerator** - New seed + level type in seconds
- **Drag & Drop** - Import `.zip` or `.mcworld` instantly

### 📁 Pro File Manager
- **Code Editor** - Syntax highlighting for YAML, JSON, Properties
- **Archive & Backup** - Zip/extract with one click

---

## 🚀 Getting Started

1. **Download** `MineServer_1.0.0_x64-setup.exe` from [Releases](https://github.com/MF9CODING/Mineserver/releases)
2. **Install** - Run the installer
   > 🛡️ See "Windows protected your PC"? Click **More info** → **Run anyway**
3. **Create** - Click "Create Server", choose your type, hit Start
4. **Play** - Copy the IP from Network tab and join!

---

## ❓ FAQ

<details>
<summary><b>Is this free?</b></summary>
Yes! MineServer is 100% free and open source.
</details>

<details>
<summary><b>How do I install plugins/mods?</b></summary>

- **Plugins**: Go to "Plugins" tab → Search → Install (Paper, Spigot, Purpur)
- **Mods**: Go to "Mods" tab → Search → Install (Fabric, Forge, NeoForge)
</details>

<details>
<summary><b>Why can't my friends join?</b></summary>
Use the "Network" tab → Enable "Playit.gg" tunnel for instant public address - no port forwarding needed!
</details>

<details>
<summary><b>How much RAM should I allocate?</b></summary>

- Vanilla/Paper: 2-4GB
- Modded: 6-8GB+
- The wizard auto-recommends based on your PC
</details>

<details>
<summary><b>Do I need Java?</b></summary>
Yes. Install Java 21 (for 1.21+) or Java 17 (for 1.18+).
</details>

---

## ❤️ Contributing

We love the community! Developers (Rust/React) welcome.

1. Fork the repo
2. Create a branch (`git checkout -b feature/cool-thing`)
3. Commit changes
4. Open a Pull Request!

---

<div align="center">

**Built with ❤️ by MF9CODING**

*Not affiliated with Mojang or Microsoft.*

</div>
